# Onboarding Flow — Fix the /login ↔ / Redirect Loop

**Date:** 2026-07-05
**Status:** Approved

---

## Overview

Any authenticated user with no `family_members` row gets stuck in an infinite client-side redirect loop: `/` (dashboard) requires a cellar and sends them to `/login`; `/login` sees a valid session and sends them back to `/`. Neither page ever renders. Confirmed live with the e2e test user, root-caused via server-side instrumentation (not a session/auth bug — `getUser()`/`getSession()` agree throughout; the RPC backing `getCellarContext()` correctly and consistently reports "no cellar" for that user).

This isn't hypothetical or e2e-only: `app/(app)/settings/locations/page.tsx` and `lib/actions/storage-locations.ts` already redirect to `/onboarding` for exactly this state — that page just never got built. An existing but never-passing e2e spec (`e2e/tests/01-onboarding.spec.ts`) already documents the intended shape of the flow; this spec formalizes and completes it.

Root cause pattern: `redirect('/login')` is used for two different conditions that got conflated — "not authenticated" and "authenticated but never onboarded into a family." By the time any page under `app/(app)/` renders, `proxy.ts` has already guaranteed the user is authenticated (its matcher covers every non-static route). So inside these pages, a missing `family_members` row is the *only* thing a "no context" check can mean — redirecting to `/login` for that case is always wrong, not just wrong for the dashboard.

---

## Fix 1: Build `/onboarding`

New route: `app/(app)/onboarding/page.tsx` — a form with `name="familyName"` and `name="cellarName"` fields (matching `e2e/tests/01-onboarding.spec.ts`'s selectors exactly), submitting to a new server action that creates a family, makes the current user its owner, and creates a cellar — then redirects to `/`.

- If the user already has a cellar (revisits `/onboarding` after completing it, e.g. back button), redirect straight to `/`.
- Creation is a single Postgres RPC (`create_family_and_cellar`), not three separate REST calls — matches the existing `get_cellar_context` pattern and makes the three inserts atomic (no orphaned family if the cellar insert fails).
- The RPC re-checks for an existing membership server-side before inserting (idempotency guard against double-submit), returning the existing family/cellar instead of creating a duplicate.
- Called via the admin/service-role client only (same reasoning as `get_cellar_context`: these tables' RLS depends on `auth.uid()`, which doesn't resolve correctly in this project — see `lib/supabase/server.ts`'s existing comment). Grant `execute` to `service_role` only.

```sql
create or replace function public.create_family_and_cellar(
  p_user_id uuid,
  p_family_name text,
  p_cellar_name text
)
returns table (family_id uuid, cellar_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_cellar_id uuid;
begin
  select fm.family_id into v_family_id
  from public.family_members fm
  where fm.user_id = p_user_id
  limit 1;

  if v_family_id is not null then
    select c.id into v_cellar_id
    from public.cellars c
    where c.family_id = v_family_id
    order by c.created_at
    limit 1;
    return query select v_family_id, v_cellar_id;
    return;
  end if;

  insert into public.families (name, created_by)
  values (p_family_name, p_user_id)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (v_family_id, p_user_id, 'owner');

  insert into public.cellars (family_id, name)
  values (v_family_id, p_cellar_name)
  returning id into v_cellar_id;

  return query select v_family_id, v_cellar_id;
end;
$$;

revoke execute on function public.create_family_and_cellar(uuid, text, text) from public;
grant execute on function public.create_family_and_cellar(uuid, text, text) to service_role;
```

Validation: `familyName`/`cellarName` required, trimmed, 1–60 chars — same bound already used for `display_name` elsewhere (`family.ts`'s `.slice(0, 40)`; using 60 here since family/cellar names read more like a title).

---

## Fix 2: Redirect target — `/login` → `/onboarding`

Every place that redirects to `/login` on a **missing family/cellar** (not a missing user) should redirect to `/onboarding` instead. The "missing user" checks in these same files are correct as-is and stay on `/login`.

**Pages** (`getCellarContext()`-based, only the `!context`/`!context.cellarId` branch changes):
`app/(app)/page.tsx`, `app/(app)/cellar/page.tsx`, `app/(app)/trips/page.tsx`, `app/(app)/history/page.tsx`, `app/(app)/trips/[id]/page.tsx`, `app/(app)/wine/[id]/page.tsx`, `app/(app)/wine/new/page.tsx`.

**Pages with their own manual membership check** (need `role`/family metadata, excluded from `getCellarContext()` per the earlier performance work):
`app/(app)/family/page.tsx`, `app/(app)/settings/api-keys/page.tsx`.

**Server actions** (only the `!membership` branch; the `!user` branch stays `/login`):
`lib/actions/family.ts`, `lib/actions/quick-add.ts`, `lib/actions/wine.ts`, `lib/actions/tasting.ts`, `lib/actions/trips.ts`.

Out of scope: `lib/actions/demo.ts`'s `clearDemoCellar` redirects to `/` (not `/login`) on missing membership — different, already-reasonable fallback for a demo-specific action, not part of this bug pattern.

`app/(app)/settings/locations/page.tsx` and `lib/actions/storage-locations.ts` already redirect to `/onboarding` — unchanged, they're the reference implementation this spec generalizes.

---

## Fix 3: Dashboard must render for a zero-wine cellar

`e2e/tests/01-onboarding.spec.ts` expects, immediately after onboarding submission: URL `/`, an `h2` containing "Willkommen", and (on a subsequent visit) "Flaschen im Keller" / "Verschiedene Weine" stats visible — for a cellar that has zero wines. Today, `app/(app)/page.tsx` returns an entirely different early-exit markup (no heading, no stats, just "Der Keller ist noch leer.") whenever there's no latest wine, which satisfies neither assertion.

Split the dashboard's render into two states based on `latestWine`, both of which render the stats grid unconditionally:

- **Empty** (`latestWine === null`): `<h2>Willkommen!</h2>`, then the `StatsCard` grid (0 / 0), then the existing empty-state prompt ("Der Keller ist noch leer." + "Ersten Wein hinzufügen" button).
- **Populated** (existing behavior): `WineHeroCard`, `StatsCard` grid, recent tastings — unchanged.

---

## Out of Scope

- Any other server action's `!membership` handling not listed above (audited; none found beyond the list in Fix 2).
- Renaming/redesigning the existing `/join` (invite-code) flow — onboarding is specifically for a user with *no* family at all, a different case from joining an existing one.
- A "leave family" or "delete family" flow — not needed to close the redirect loop.
