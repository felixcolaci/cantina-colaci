# Page Load Performance — Auth & Cellar-Lookup Deduplication

**Date:** 2026-07-05
**Status:** Approved

---

## Overview

Pages take >2s to load despite an almost-empty database. Root cause: every page render performs several **serialized network round trips to the remote Supabase project** (`izcq***.supabase.co` — hosted, not local), none of which are cached or deduplicated within a single request:

1. `supabase.auth.getUser()` is called up to 4 times per page view — once each in `proxy.ts` (edge middleware), `app/(app)/layout.tsx`, `components/nav/top-bar.tsx`, and the page itself. `getUser()` always makes a real HTTP request to the Supabase Auth server to revalidate the JWT; it is not a local decode.
2. The "resolve the current user's `family_id` then `cellar_id`" lookup (`family_members` → `cellars`, two sequential dependent queries) is copy-pasted across ~10 pages and 12 server actions with no caching, so it's re-fetched from scratch on every navigation.

Measured round trip to this Supabase project from a warm connection: ~40–150ms. A typical page (e.g. `/cellar`) chains ~6-7 of these serially (proxy-auth → layout-auth → top-bar-auth → page-auth → membership → cellar → parallel data block) before it renders anything. That's the >2s, independent of row counts.

This spec covers three independent, additive fixes, applied in order:

1. **Dedupe `auth.getUser()` per request** via React `cache()`.
2. **Centralize & combine the `family_members` → `cellars` lookup** into a single cached helper backed by one Postgres RPC call instead of two sequential REST queries.
3. **Trust the middleware's auth check downstream** — switch the post-middleware helper from `getUser()` (network call) to `getSession()` (local cookie read), since `proxy.ts` has already revalidated the session against the Auth server for this exact request.

---

## Step 1 — Dedupe `auth.getUser()`

Add a request-scoped memoized wrapper in `lib/supabase/server.ts`:

```ts
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})
```

`React.cache()` memoizes by call signature for the lifetime of one server render — calling it from `layout.tsx`, `top-bar.tsx`, and a `page.tsx` in the same request returns the same in-flight/resolved promise instead of issuing 3 separate network calls. `proxy.ts` runs in a separate execution context (edge middleware, outside the React render) and keeps its own single `getUser()` call — that's the standard Supabase-in-Next.js pattern and is not touched.

Every call site currently doing:
```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```
switches to:
```ts
const { data: { user } } = await getAuthenticatedUser()
```
dropping `createClient()`/`supabase` entirely where nothing else in the file needs the client, keeping it where later code reuses `supabase` for other queries.

No behavior change: same network call, same security guarantee (still server-revalidated), just deduplicated.

---

## Step 2 — Centralize the membership/cellar lookup

### Discovered inconsistency (relevant to design, not fixed here)

Most pages resolve `family_id`/`cellar_id` via `createAdminClient()` (service-role, bypasses RLS). Three pages instead reuse the RLS-scoped `supabase` client for this lookup: `app/(app)/settings/api-keys/page.tsx`, `app/(app)/settings/locations/page.tsx`, `app/(app)/wine/new/page.tsx`. Per the comment in `lib/supabase/server.ts`, this project's Auth JWTs can't be verified by PostgREST, so `auth.uid()` is `NULL` and **all RLS policies depending on it silently return zero rows** — meaning these three pages' RLS-scoped `family_members`/`cellars`/`storage_locations` queries are likely already returning empty results in production. This spec fixes the `family_members`/`cellars` portion for two of the three (`settings/locations`, `wine/new`) as a side effect of centralizing onto the admin client. `settings/api-keys/page.tsx` needs `role`, not `cellar_id`, so it doesn't fit the shared helper (see Out of Scope) and its RLS-client bug is **not** fixed here — flagged for a separate follow-up.

### New RPC: `get_cellar_context`

Collapses the two sequential dependent queries (`family_members` then `cellars`) into one Postgres round trip:

```sql
create or replace function public.get_cellar_context(p_user_id uuid)
returns table (family_id uuid, cellar_id uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select fm.family_id, c.id as cellar_id
  from public.family_members fm
  left join public.cellars c on c.family_id = fm.family_id
  where fm.user_id = p_user_id
  order by c.created_at asc
  limit 1;
$$;
```

Semantics match the existing hand-written logic exactly: earliest cellar (`order by created_at asc`, implicit single row), `left join` so a family with no cellar yet still returns a row with `cellar_id = NULL` (matches call sites that tolerate a missing cellar). Zero rows means no `family_members` row at all for that user.

### New helper: `lib/cellar-context.ts`

```ts
export type CellarContext = {
  userId: string
  email: string | null
  familyId: string
  cellarId: string | null
}

export const getCellarContext = cache(async (): Promise<CellarContext | null> => {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .rpc('get_cellar_context', { p_user_id: user.id })
    .maybeSingle()

  if (!data) return null

  return { userId: user.id, email: user.email ?? null, familyId: data.family_id, cellarId: data.cellar_id }
})
```

Cached per request like `getAuthenticatedUser`. Callers that previously did:
```ts
if (!membership) redirect('/login')
...
if (!cellar) redirect('/login')
```
now do:
```ts
const context = await getCellarContext()
if (!context || !context.cellarId) redirect('/login')
```
and callers that tolerate a missing cellar do `if (!context) redirect(...)` then treat `context.cellarId` as optional, exactly as they treat `cellar` as optional today.

### Pages migrated to `getCellarContext()`

Only pages that need *just* `family_id` + `cellar_id` (no extra columns) qualify:

`app/(app)/page.tsx`, `app/(app)/cellar/page.tsx`, `app/(app)/history/page.tsx`, `app/(app)/wine/[id]/page.tsx`, `app/(app)/wine/new/page.tsx`, `app/(app)/trips/page.tsx`, `app/(app)/trips/[id]/page.tsx`, `app/(app)/settings/locations/page.tsx`.

Each file's existing redirect target and null-cellar tolerance is preserved exactly (e.g. `settings/locations/page.tsx` redirects to `/onboarding`, not `/login`, on missing membership — that stays as-is).

---

## Step 3 — Trust middleware, stop re-validating over the network

`proxy.ts` already calls `supabase.auth.getUser()` (network-validated) on every matched request before any Server Component runs, and redirects unauthenticated requests before the render even starts. Downstream code (layout, top-bar, pages) re-validating over the network again is redundant defense-in-depth that costs a full round trip.

Change `getAuthenticatedUser()`'s **implementation only** (no call site changes) to use the local, cookie-based `getSession()` instead of the network-bound `getUser()`:

```ts
export const getAuthenticatedUser = cache(async (): Promise<{ data: { user: User | null } }> => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return { data: { user: session?.user ?? null } }
})
```

The wrapper's return shape (`{ data: { user } }`) stays identical, so nothing calling `getAuthenticatedUser()` or `getCellarContext()` needs to change. This removes the last 1-3 redundant network round trips per page (layout + top-bar + page collapse to zero extra auth network calls, relying on the one the middleware already made).

**Security note:** this is a deliberate trade-off, done last and in isolation so it's trivially revertible. It relies on `proxy.ts`'s matcher covering every route that reaches a page needing auth (it does — the matcher excludes only static assets). If a route is ever added that bypasses the proxy matcher but still calls `getAuthenticatedUser()`, it would trust an unrevalidated cookie. Route Handlers and Server Actions are unaffected — they don't use this helper.

---

## Out of Scope

- `lib/actions/*.ts` (12 files) and `app/auth/callback/route.ts` — these are separate request lifecycles (Server Actions / Route Handlers), not part of a single page's React render, so `React.cache()` cannot dedupe across a page load and its subsequent action calls. Each already does its own single `getUser()` + membership/cellar lookup; centralizing them is a natural follow-up but a separate, larger change (12+ files) not required to fix page-load latency.
- `app/(app)/family/page.tsx` and `app/(app)/settings/api-keys/page.tsx` — their membership query needs `role` (and `families(name, is_demo)` for `family/page.tsx`), which `getCellarContext()` doesn't return. Forcing them onto the generic helper would require a second query for the missing columns, net negative. They still get Step 1's `getAuthenticatedUser()` dedup, just not Step 2.
- Fixing the RLS-scoped-client bug in `settings/api-keys/page.tsx` (unrelated to cellar/family lookup, needs its own fix).
- Swapping the *other* RLS-scoped business queries in `settings/locations/page.tsx` (final `storage_locations` query) and `wine/new/page.tsx` (trips/wines/storage_locations/cellar_entries queries) to the admin client — same latent RLS bug, separate scope.
- Combining the `Promise.all` data-fetching blocks further — those are already parallelized correctly.
- Changing Supabase project region/infra.
