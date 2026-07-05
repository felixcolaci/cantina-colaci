# Page Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut page-load latency by removing redundant, serialized network round trips to the remote Supabase project — deduplicate `auth.getUser()` per request, collapse the `family_members`→`cellars` lookup into one cached RPC call, then stop re-validating auth over the network downstream of middleware.

**Architecture:** Three layered changes to `lib/supabase/server.ts` and its callers: (1) a `React.cache()`-wrapped `getAuthenticatedUser()` used everywhere `supabase.auth.getUser()` was called directly; (2) a new `get_cellar_context` Postgres RPC plus a cached `lib/cellar-context.ts` helper that replaces the duplicated `family_members`→`cellars` query pair across 8 pages; (3) swapping `getAuthenticatedUser()`'s internals from `getUser()` (network) to `getSession()` (local), relying on `proxy.ts` having already network-validated the session for this request.

**Tech Stack:** Next.js App Router (Server Components), `@supabase/ssr`, Postgres RPC, Vitest.

## Global Constraints

- Every call site's existing redirect target and null-tolerance behavior must be preserved exactly (e.g. `settings/locations/page.tsx` redirects to `/onboarding`, others to `/login`; some pages tolerate a missing cellar, some redirect on it).
- `getAuthenticatedUser()` always returns `{ data: { user: User | null } }` regardless of internal implementation, so call sites never need to change between Task 1 and Task 7.
- `proxy.ts` is untouched — it keeps its own independent `getUser()` call.
- `lib/actions/*.ts` and `app/auth/callback/route.ts` are out of scope (separate request lifecycles — see spec).
- `app/(app)/family/page.tsx` and `app/(app)/settings/api-keys/page.tsx` are excluded from the `getCellarContext()` migration (they need `role`, which the helper doesn't return) — they still get Task 2's `getAuthenticatedUser()` swap.

---

### Task 1: Add cached `getAuthenticatedUser()` helper

**Files:**
- Modify: `lib/supabase/server.ts`

**Interfaces:**
- Produces: `getAuthenticatedUser(): Promise<{ data: { user: User | null }, error: AuthError | null }>` — same return shape as `supabase.auth.getUser()`, importable from `@/lib/supabase/server`.

- [ ] **Step 1: Add the `cache` import and the helper**

In `lib/supabase/server.ts`, change:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
```
to:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

export async function createClient() {
```

Then, immediately after the closing `}` of `createClient()` (before the `createAdminClient` comment block), add:
```ts

// Deduplicates auth.getUser() within a single request — layout, top-bar,
// and page Server Components all call this; React.cache() collapses
// them into one network round trip instead of three.
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the export is unused so far — that's fine, later tasks consume it).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/server.ts
git commit -m "perf: add request-scoped getAuthenticatedUser cache"
```

---

### Task 2: Migrate auth-only call sites to `getAuthenticatedUser()`

Covers every file where `supabase` (from `createClient()`) is used **only** for `auth.getUser()` — the client itself becomes unused and is dropped.

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `components/nav/top-bar.tsx`
- Modify: `app/(app)/page.tsx`
- Modify: `app/(app)/family/page.tsx`
- Modify: `app/(app)/wine/[id]/page.tsx`
- Modify: `app/(app)/history/page.tsx`
- Modify: `app/(app)/trips/[id]/page.tsx`
- Modify: `app/(app)/trips/page.tsx`
- Modify: `app/(app)/cellar/page.tsx`
- Modify: `app/(auth)/join/page.tsx`
- Modify: `app/(auth)/register/page.tsx`
- Modify: `app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `getAuthenticatedUser` from `@/lib/supabase/server` (Task 1)

- [ ] **Step 1: `app/(app)/layout.tsx`**

Change:
```ts
import { createClient } from '@/lib/supabase/server'
```
to:
```ts
import { getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 2: `components/nav/top-bar.tsx`**

Change:
```ts
import { createClient } from '@/lib/supabase/server'
```
to:
```ts
import { getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
```

- [ ] **Step 3: `app/(app)/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 4: `app/(app)/family/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 5: `app/(app)/wine/[id]/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 6: `app/(app)/history/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 7: `app/(app)/trips/[id]/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 8: `app/(app)/trips/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 9: `app/(app)/cellar/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
```
(Leave the `membership`/`cellar` block below untouched — Task 6 replaces it.)

- [ ] **Step 10: `app/(auth)/join/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
```

- [ ] **Step 11: `app/(auth)/register/page.tsx`**

Change:
```ts
import { createClient } from '@/lib/supabase/server'
```
to:
```ts
import { getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (user) redirect('/')
```

- [ ] **Step 12: `app/(auth)/login/page.tsx`**

Change:
```ts
import { createClient } from '@/lib/supabase/server'
```
to:
```ts
import { getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')
```
to:
```ts
  const { data: { user } } = await getAuthenticatedUser()
  if (user) redirect('/')
```

- [ ] **Step 13: Typecheck and smoke-test manually**

Run: `npx tsc --noEmit`
Expected: no errors (no unused `createClient` imports left in any of the 12 files).

Run: `npm run dev`, then in a browser:
- Visit `/login` while logged out → form renders (no redirect loop).
- Log in → redirected to `/` (dashboard), `TopBar` shows avatar initials.
- Visit `/cellar`, `/history`, `/trips`, `/family` → all render without redirecting to `/login`.
- Log out → visiting `/` redirects to `/login`.

- [ ] **Step 14: Commit**

```bash
git add app/\(app\)/layout.tsx components/nav/top-bar.tsx app/\(app\)/page.tsx app/\(app\)/family/page.tsx "app/(app)/wine/[id]/page.tsx" app/\(app\)/history/page.tsx "app/(app)/trips/[id]/page.tsx" app/\(app\)/trips/page.tsx app/\(app\)/cellar/page.tsx app/\(auth\)/join/page.tsx app/\(auth\)/register/page.tsx app/\(auth\)/login/page.tsx
git commit -m "perf: use deduplicated getAuthenticatedUser in auth-only call sites"
```

---

### Task 3: Migrate mixed call sites (client reused for other queries)

These three files keep `createClient()`/`supabase` because later code reuses the RLS-scoped client for other queries — only the `auth.getUser()` line changes.

**Files:**
- Modify: `app/(app)/settings/api-keys/page.tsx`
- Modify: `app/(app)/settings/locations/page.tsx`
- Modify: `app/(app)/wine/new/page.tsx`

**Interfaces:**
- Consumes: `getAuthenticatedUser` from `@/lib/supabase/server` (Task 1)

- [ ] **Step 1: `app/(app)/settings/api-keys/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createClient, createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const supabase = await createClient()
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 2: `app/(app)/settings/locations/page.tsx`**

Change:
```ts
import { createClient } from '@/lib/supabase/server'
```
to:
```ts
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const supabase = await createClient()
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 3: `app/(app)/wine/new/page.tsx`**

Change:
```ts
import { createClient } from '@/lib/supabase/server'
```
to:
```ts
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
Change:
```ts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
```
to:
```ts
  const supabase = await createClient()
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/settings/api-keys/page.tsx app/\(app\)/settings/locations/page.tsx app/\(app\)/wine/new/page.tsx
git commit -m "perf: use deduplicated getAuthenticatedUser in mixed-client call sites"
```

---

### Task 4: Add `get_cellar_context` RPC migration

**Files:**
- Create: `supabase/migrations/014_cellar_context_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Collapses the family_members -> cellars lookup (previously two sequential
-- REST round trips, repeated on nearly every page) into one RPC call.
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

revoke execute on function public.get_cellar_context(uuid) from public;
grant execute on function public.get_cellar_context(uuid) to authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: migration `014_cellar_context_rpc` applied successfully, no errors.

- [ ] **Step 3: Verify the function against real data**

Run (replace `<a-real-user-id>` with an existing `family_members.user_id` from the dashboard, or use the e2e test user from `e2e/helpers/constants.ts`):
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
admin.rpc('get_cellar_context', { p_user_id: '<a-real-user-id>' }).then(r => console.log(r));
"
```
Expected: `{ data: [ { family_id: '...', cellar_id: '...' } ], error: null }` (or `cellar_id: null` if that family has no cellar yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/014_cellar_context_rpc.sql
git commit -m "feat: add get_cellar_context RPC to collapse membership+cellar lookup"
```

---

### Task 5: Add `lib/cellar-context.ts` helper with tests

**Files:**
- Create: `lib/cellar-context.ts`
- Test: `lib/__tests__/cellar-context.test.ts`

**Interfaces:**
- Consumes: `createAdminClient`, `getAuthenticatedUser` from `@/lib/supabase/server` (Task 1)
- Produces: `CellarContext` type and `getCellarContext(): Promise<CellarContext | null>`, importable from `@/lib/cellar-context` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/cellar-context.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockGetAuthenticatedUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
  getAuthenticatedUser: mockGetAuthenticatedUser,
}))

function mockRpcResult(data: { family_id: string; cellar_id: string | null } | null) {
  mockRpc.mockReturnValueOnce({
    maybeSingle: () => Promise.resolve({ data, error: null }),
  })
}

// getCellarContext is wrapped in React.cache(), which memoizes by call
// signature for the module's lifetime outside of a real Next.js request
// scope. Re-importing the module fresh per test (via resetModules) avoids
// the second test seeing the first test's cached result.
describe('getCellarContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns null when there is no authenticated user', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: null } })
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns null when the user has no family membership', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    mockRpcResult(null)
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toBeNull()
  })

  it('returns familyId with null cellarId when membership exists but no cellar yet', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    mockRpcResult({ family_id: 'fam-1', cellar_id: null })
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toEqual({ userId: 'u1', email: 'a@b.com', familyId: 'fam-1', cellarId: null })
  })

  it('returns full context when membership and cellar exist', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    mockRpcResult({ family_id: 'fam-1', cellar_id: 'cellar-1' })
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toEqual({ userId: 'u1', email: 'a@b.com', familyId: 'fam-1', cellarId: 'cellar-1' })
    expect(mockRpc).toHaveBeenCalledWith('get_cellar_context', { p_user_id: 'u1' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/cellar-context.test.ts`
Expected: FAIL — `Cannot find module '../cellar-context'`.

- [ ] **Step 3: Implement `lib/cellar-context.ts`**

```ts
import { cache } from 'react'
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'

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

  return {
    userId: user.id,
    email: user.email ?? null,
    familyId: data.family_id,
    cellarId: data.cellar_id,
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/cellar-context.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cellar-context.ts lib/__tests__/cellar-context.test.ts
git commit -m "feat: add cached getCellarContext helper"
```

---

### Task 6: Migrate pages to `getCellarContext()`

**Files:**
- Modify: `app/(app)/page.tsx`
- Modify: `app/(app)/cellar/page.tsx`
- Modify: `app/(app)/history/page.tsx`
- Modify: `app/(app)/wine/[id]/page.tsx`
- Modify: `app/(app)/wine/new/page.tsx`
- Modify: `app/(app)/trips/page.tsx`
- Modify: `app/(app)/trips/[id]/page.tsx`
- Modify: `app/(app)/settings/locations/page.tsx`

**Interfaces:**
- Consumes: `getCellarContext`, `CellarContext` from `@/lib/cellar-context` (Task 5)

- [ ] **Step 1: `app/(app)/page.tsx`**

Change:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
export default async function DashboardPage() {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!cellar) redirect('/login')

  // wines first — needed for inStock count via .in()
  const { data: wines } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)
```
to:
```ts
export default async function DashboardPage() {
  const context = await getCellarContext()
  if (!context || !context.cellarId) redirect('/login')
  const { cellarId } = context

  const admin = createAdminClient()

  // wines first — needed for inStock count via .in()
  const { data: wines } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellarId)
```
Then update the two remaining `cellar.id` references further down:
```ts
      .eq('skus.wines.cellar_id', cellar.id)
```
to:
```ts
      .eq('skus.wines.cellar_id', cellarId)
```
and:
```ts
      .eq('cellar_id', cellar.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
```
to:
```ts
      .eq('cellar_id', cellarId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
```

- [ ] **Step 2: `app/(app)/cellar/page.tsx`**

Change:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
  const { type } = await searchParams
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) redirect('/login')

  const [flags, locationsResult, familyResult, winesResult, hintsResult] = await Promise.all([
    getFeatureFlags(membership.family_id),
    admin.from('storage_locations').select('id, name').eq('cellar_id', cellar.id).order('name'),
    admin.from('families').select('is_demo').eq('id', membership.family_id).maybeSingle(),
    (async () => {
      let query = admin
        .from('wines')
        .select('*, skus(id, vintage, quantity, photo_url, status, storage_location_id)')
        .eq('cellar_id', cellar.id)
        .order('name')
      if (type) query = (query as any).eq('type', type)
      return query
    })(),
    admin.from('wines').select('name, producer').eq('cellar_id', cellar.id),
  ])
```
to:
```ts
  const { type } = await searchParams
  const context = await getCellarContext()
  if (!context || !context.cellarId) redirect('/login')
  const { familyId, cellarId } = context

  const admin = createAdminClient()

  const [flags, locationsResult, familyResult, winesResult, hintsResult] = await Promise.all([
    getFeatureFlags(familyId),
    admin.from('storage_locations').select('id, name').eq('cellar_id', cellarId).order('name'),
    admin.from('families').select('is_demo').eq('id', familyId).maybeSingle(),
    (async () => {
      let query = admin
        .from('wines')
        .select('*, skus(id, vintage, quantity, photo_url, status, storage_location_id)')
        .eq('cellar_id', cellarId)
        .order('name')
      if (type) query = (query as any).eq('type', type)
      return query
    })(),
    admin.from('wines').select('name, producer').eq('cellar_id', cellarId),
  ])
```

- [ ] **Step 3: `app/(app)/history/page.tsx`**

Change:
```ts
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
export default async function HistoryPage() {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: tastings } = cellar
    ? await admin
        .from('tastings')
        .select(`
          id, date, rating, notes,
          skus!inner(
            vintage, wine_id,
            wines!inner(id, name, producer, cellar_id)
          )
        `)
        .eq('skus.wines.cellar_id', cellar.id)
        .order('date', { ascending: false })
    : { data: [] }
```
to:
```ts
export default async function HistoryPage() {
  const context = await getCellarContext()
  if (!context) redirect('/login')

  const admin = createAdminClient()

  const { data: tastings } = context.cellarId
    ? await admin
        .from('tastings')
        .select(`
          id, date, rating, notes,
          skus!inner(
            vintage, wine_id,
            wines!inner(id, name, producer, cellar_id)
          )
        `)
        .eq('skus.wines.cellar_id', context.cellarId)
        .order('date', { ascending: false })
    : { data: [] }
```

- [ ] **Step 4: `app/(app)/wine/[id]/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
  const { id } = await params
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) redirect('/login')

  const [wineResult, storageLocResult, photosResult] = await Promise.all([
    admin.from('wines').select('*').eq('id', id).eq('cellar_id', cellar.id).maybeSingle(),
    admin.from('storage_locations').select('id, name').eq('cellar_id', cellar.id).order('name'),
    admin.from('wine_photos').select('id, url').eq('wine_id', id).order('sort_order').order('created_at'),
  ])
```
to:
```ts
  const { id } = await params
  const context = await getCellarContext()
  if (!context || !context.cellarId) redirect('/login')
  const { cellarId } = context

  const admin = createAdminClient()

  const [wineResult, storageLocResult, photosResult] = await Promise.all([
    admin.from('wines').select('*').eq('id', id).eq('cellar_id', cellarId).maybeSingle(),
    admin.from('storage_locations').select('id, name').eq('cellar_id', cellarId).order('name'),
    admin.from('wine_photos').select('id, url').eq('wine_id', id).order('sort_order').order('created_at'),
  ])
```

- [ ] **Step 5: `app/(app)/wine/new/page.tsx`**

Change:
```ts
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
to:
```ts
import { createClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
export default async function NewWinePage() {
  const supabase = await createClient()
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const cellarId = cellar?.id
```
to:
```ts
export default async function NewWinePage() {
  const context = await getCellarContext()
  if (!context) redirect('/login')

  const supabase = await createClient()
  const cellarId = context.cellarId
```

- [ ] **Step 6: `app/(app)/trips/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
export default async function TripsPage() {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: trips } = cellar
    ? await admin
        .from('trips')
        .select('id, name, location, date_start, date_end, skus(wine_id)')
        .eq('cellar_id', cellar.id)
        .order('created_at', { ascending: false })
    : { data: [] }
```
to:
```ts
export default async function TripsPage() {
  const context = await getCellarContext()
  if (!context) redirect('/login')

  const admin = createAdminClient()

  const { data: trips } = context.cellarId
    ? await admin
        .from('trips')
        .select('id, name, location, date_start, date_end, skus(wine_id)')
        .eq('cellar_id', context.cellarId)
        .order('created_at', { ascending: false })
    : { data: [] }
```

- [ ] **Step 7: `app/(app)/trips/[id]/page.tsx`**

Change:
```ts
import { createClient, createAdminClient } from '@/lib/supabase/server'
```
to:
```ts
import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
  const { id } = await params
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!cellar) redirect('/login')

  const [tripResult, winesResult] = await Promise.all([
    admin
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('cellar_id', cellar.id)
      .maybeSingle(),
    admin
      .from('wines')
      .select('*, skus(id, vintage, quantity, photo_url, status, storage_location_id, purchase_price, trip_id)')
      .eq('cellar_id', cellar.id)
      .order('name'),
  ])
```
to:
```ts
  const { id } = await params
  const context = await getCellarContext()
  if (!context || !context.cellarId) redirect('/login')
  const { cellarId } = context

  const admin = createAdminClient()

  const [tripResult, winesResult] = await Promise.all([
    admin
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('cellar_id', cellarId)
      .maybeSingle(),
    admin
      .from('wines')
      .select('*, skus(id, vintage, quantity, photo_url, status, storage_location_id, purchase_price, trip_id)')
      .eq('cellar_id', cellarId)
      .order('name'),
  ])
```

- [ ] **Step 8: `app/(app)/settings/locations/page.tsx`**

Change:
```ts
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
```
to:
```ts
import { createClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
```
Change:
```ts
export default async function LocationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: locations } = cellar
    ? await supabase
        .from('storage_locations')
        .select('*')
        .eq('cellar_id', cellar.id)
        .order('name')
    : { data: [] }
```
to:
```ts
export default async function LocationsPage() {
  const context = await getCellarContext()
  if (!context) redirect('/onboarding')

  const supabase = await createClient()

  const { data: locations } = context.cellarId
    ? await supabase
        .from('storage_locations')
        .select('*')
        .eq('cellar_id', context.cellarId)
        .order('name')
    : { data: [] }
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors, no unused imports (`createAdminClient` stays wherever admin queries remain; `createClient` stays only in `wine/new/page.tsx` and `settings/locations/page.tsx`).

- [ ] **Step 10: Manual smoke test**

Run: `npm run dev`, then in a browser (logged in as a user with a cellar):
- `/` (dashboard) renders stats and latest wine.
- `/cellar` renders the wine list, including with `?type=red` filter.
- `/history`, `/trips`, `/trips/[id]` (pick an existing trip) render.
- `/wine/[id]` (pick an existing wine) renders.
- `/wine/new` renders the form with hints populated.
- `/settings/locations` renders the location list.
- Log in as a user with membership but **no** cellar yet (or temporarily test via a fresh invite) → pages that tolerate a missing cellar (`/history`, `/trips`, `/settings/locations`, `/wine/new`) render with empty state instead of erroring; pages that require a cellar (`/`, `/cellar`, `/wine/[id]`, `/trips/[id]`) redirect to `/login`.

- [ ] **Step 11: Run full test suite**

Run: `npm run test:run`
Expected: all existing tests still pass.

- [ ] **Step 12: Commit**

```bash
git add app/\(app\)/page.tsx app/\(app\)/cellar/page.tsx app/\(app\)/history/page.tsx "app/(app)/wine/[id]/page.tsx" app/\(app\)/wine/new/page.tsx app/\(app\)/trips/page.tsx "app/(app)/trips/[id]/page.tsx" app/\(app\)/settings/locations/page.tsx
git commit -m "perf: use getCellarContext to collapse membership+cellar lookups"
```

---

### Task 7: Switch `getAuthenticatedUser()` to local session (no network call)

**Files:**
- Modify: `lib/supabase/server.ts`

**Interfaces:**
- Produces: same `getAuthenticatedUser()` signature — `{ data: { user: User | null } }` — no caller changes.

- [ ] **Step 1: Change the implementation**

In `lib/supabase/server.ts`, change:
```ts
// Deduplicates auth.getUser() within a single request — layout, top-bar,
// and page Server Components all call this; React.cache() collapses
// them into one network round trip instead of three.
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})
```
to:
```ts
// Deduplicates auth resolution within a single request. Uses getSession()
// (local cookie read, no network call) rather than getUser() because
// proxy.ts already network-validated this request's session against the
// Auth server before any Server Component ran — re-validating here would
// just be a redundant round trip. Return shape matches getUser()'s so no
// caller needs to change.
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return { data: { user: session?.user ?? null } }
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — every call site destructures `data: { user }`, which is unchanged.

- [ ] **Step 3: Manual smoke test — auth gating still works**

Run: `npm run dev`:
- Logged out, visit `/` → redirected to `/login` (proxy.ts catches it before the page even runs).
- Log in → land on `/`, all pages from Task 6's smoke test still render correctly.
- Log out via the `LogoutButton` → subsequent visit to `/cellar` redirects to `/login`.
- Directly hit a protected page with an expired/invalid session cookie (e.g. clear cookies mid-session) → still redirected to `/login` by `proxy.ts`.

- [ ] **Step 4: Run full test suite and e2e**

Run: `npm run test:run`
Expected: all pass.

Run: `npm run e2e`
Expected: all pass (exercises real login + protected-page flows against the live Supabase project).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/server.ts
git commit -m "perf: resolve auth from local session, relying on proxy's network validation"
```

---

### Task 8: Verify the latency improvement

**Files:** none (verification only)

- [ ] **Step 1: Measure round trips before/after**

With the dev server running (`npm run dev`) and logged in, open the browser's Network tab, hard-reload `/cellar`, and check the waterfall for the initial document request's server-side timing (or add a temporary `console.time`/`console.timeEnd` around each Supabase call in `cellar/page.tsx` and remove it after). Confirm:
- Only one auth-related network call happens per page load (from `proxy.ts`) instead of four.
- Only one `get_cellar_context` RPC call happens instead of two sequential `family_members`/`cellars` queries.

- [ ] **Step 2: Compare wall-clock page load**

Run: `curl -s -o /dev/null -w "%{time_total}s\n" -H "Cookie: <copy from browser devtools>" http://localhost:3000/cellar` a few times before and after this branch (checkout `main` vs this branch) and compare `time_total`.
Expected: noticeably lower and less variable total time on this branch — the exact reduction depends on network conditions to the Supabase project, but the round-trip count drops from ~6-7 to ~2-3 serialized calls per page.

- [ ] **Step 3: Final full verification**

Run: `npm run test:run && npx tsc --noEmit && npm run lint`
Expected: all green.

No commit for this task — it's verification only. If any regression is found, return to the relevant task above and fix it there (do not patch ad-hoc).
