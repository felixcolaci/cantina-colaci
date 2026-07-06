# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the infinite `/` ↔ `/login` redirect loop for any authenticated user with no `family_members` row, by building the `/onboarding` page the codebase already expects (`settings/locations/page.tsx`, `storage-locations.ts`, and `e2e/tests/01-onboarding.spec.ts` all already reference it) and fixing every other place that wrongly sends a "not onboarded" user to `/login` instead.

**Architecture:** One new Postgres RPC (`create_family_and_cellar`) does the three-table insert (families → family_members → cellars) atomically; a new server action calls it via the admin client; a new `/onboarding` page renders the form. Separately, every `redirect('/login')` that actually means "no family yet" (as opposed to "not logged in") is repointed to `/onboarding` across 9 pages and 5 server actions. The dashboard's empty-cellar render is restructured so the stats grid always renders and a "Willkommen" heading appears when there's no wine yet, matching the existing (currently failing) e2e spec.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Postgres RPC, Vitest.

## Global Constraints

- `/onboarding`'s form field names must be exactly `familyName` and `cellarName` — `e2e/tests/01-onboarding.spec.ts` selects them by `[name="familyName"]` / `[name="cellarName"]` and this plan does not modify that test.
- Only the "no family/cellar" branch of each redirect changes target (`/login` → `/onboarding`); the "no user" branch in the same files is correct as-is and must not change.
- `create_family_and_cellar` is called only via `createAdminClient()` (service-role) — grant `execute` to `service_role` only, never `authenticated` (see the IDOR finding from the earlier `get_cellar_context` RPC — same risk shape applies here since it takes an arbitrary `p_user_id`).
- `lib/actions/demo.ts`'s `clearDemoCellar` (`redirect('/')` on missing membership) is out of scope — different, already-reasonable behavior, not part of this bug pattern.

---

### Task 1: `create_family_and_cellar` RPC

**Files:**
- Create: `supabase/migrations/015_onboarding_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Atomically creates a family + owner membership + cellar for a user who
-- has none yet. Idempotent: if the user already has a family, returns
-- their existing family/cellar instead of creating a duplicate (guards
-- against double-submit or a stale /onboarding page revisit).
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

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: migration `015_onboarding_rpc` applied successfully.

- [ ] **Step 3: Verify against real data — fresh user**

Run (replace `<some-uuid-not-in-family_members>` with a random UUID, e.g. from `node -e "console.log(crypto.randomUUID())"` — this only tests the function's insert path against a nonexistent-but-syntactically-valid user id, no real user row is required since `family_members`/`cellars` don't FK to a resolved `auth.users` row check inside this function call itself... actually `family_members.user_id references auth.users(id)` DOES have an FK, so use a REAL user id instead — the e2e test user's id works, but only if it doesn't already have a family; check first with the query below):

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: existing } = await admin.from('family_members').select('user_id').limit(1);
  console.log('an existing member (do NOT use this id, it already has a family):', existing);
  const { data: users } = await admin.auth.admin.listUsers();
  const withoutFamily = users.users.find(u => !existing?.some(e => e.user_id === u.id));
  console.log('a user id safe to test with (no family yet):', withoutFamily?.id, withoutFamily?.email);
})();
"
```

Then call the RPC with that id:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
admin.rpc('create_family_and_cellar', { p_user_id: '<paste-id-here>', p_family_name: 'Test Family', p_cellar_name: 'Test Cellar' }).then(r => console.log(r));
"
```
Expected: `{ data: [ { family_id: '...', cellar_id: '...' } ], error: null }`.

- [ ] **Step 4: Verify idempotency — calling it again for the same user**

Run the same RPC call again with the identical `p_user_id`.
Expected: returns the SAME `family_id`/`cellar_id` as Step 3 (not a new family) — confirms the idempotency guard works.

- [ ] **Step 5: Clean up the test data**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
admin.from('families').delete().eq('name', 'Test Family').then(r => console.log(r));
"
```
(Deleting the `families` row cascades to `family_members` and `cellars` per their `on delete cascade` foreign keys — confirmed in `supabase/migrations/001_initial_schema.sql`.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/015_onboarding_rpc.sql
git commit -m "feat: add create_family_and_cellar RPC for onboarding"
```

---

### Task 2: `createFamilyAndCellar` server action

**Files:**
- Create: `lib/actions/onboarding.ts`
- Test: `lib/__tests__/onboarding.test.ts`

**Interfaces:**
- Consumes: `getAuthenticatedUser`, `createAdminClient` from `@/lib/supabase/server`; the `create_family_and_cellar` RPC (Task 1)
- Produces: `createFamilyAndCellar(formData: FormData): Promise<void>` (throws on validation/RPC error, redirects to `/` on success) — consumed by Task 3's form.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/onboarding.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockGetAuthenticatedUser = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
  getAuthenticatedUser: mockGetAuthenticatedUser,
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('createFamilyAndCellar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthenticatedUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } })
  })

  it('throws when familyName is missing', async () => {
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await expect(
      createFamilyAndCellar(formData({ cellarName: 'Keller' }))
    ).rejects.toThrow('Bitte Familien- und Kellernamen angeben')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('throws when cellarName is missing', async () => {
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await expect(
      createFamilyAndCellar(formData({ familyName: 'Colaci' }))
    ).rejects.toThrow('Bitte Familien- und Kellernamen angeben')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('throws a generic error when the RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await expect(
      createFamilyAndCellar(formData({ familyName: 'Colaci', cellarName: 'Keller' }))
    ).rejects.toThrow('Anlegen fehlgeschlagen')
  })

  it('calls the RPC with trimmed values and redirects to / on success', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ family_id: 'f1', cellar_id: 'c1' }], error: null })
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await createFamilyAndCellar(formData({ familyName: '  Colaci  ', cellarName: '  Keller  ' }))
    expect(mockRpc).toHaveBeenCalledWith('create_family_and_cellar', {
      p_user_id: 'u1',
      p_family_name: 'Colaci',
      p_cellar_name: 'Keller',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/onboarding.test.ts`
Expected: FAIL — `Cannot find module '../actions/onboarding'`.

- [ ] **Step 3: Implement `lib/actions/onboarding.ts`**

```ts
'use server'

import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createFamilyAndCellar(formData: FormData) {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const familyName = (formData.get('familyName') as string | null)?.trim().slice(0, 60)
  const cellarName = (formData.get('cellarName') as string | null)?.trim().slice(0, 60)
  if (!familyName || !cellarName) throw new Error('Bitte Familien- und Kellernamen angeben')

  const admin = createAdminClient()
  const { error } = await admin.rpc('create_family_and_cellar', {
    p_user_id: user.id,
    p_family_name: familyName,
    p_cellar_name: cellarName,
  })
  if (error) throw new Error('Anlegen fehlgeschlagen')

  redirect('/')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/onboarding.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/actions/onboarding.ts lib/__tests__/onboarding.test.ts
git commit -m "feat: add createFamilyAndCellar server action"
```

---

### Task 3: `/onboarding` page and form

**Files:**
- Create: `app/(app)/onboarding/page.tsx`
- Create: `app/(app)/onboarding/onboarding-form.tsx`

**Interfaces:**
- Consumes: `getCellarContext` from `@/lib/cellar-context` (guard); `createFamilyAndCellar` from `@/lib/actions/onboarding` (Task 2)

- [ ] **Step 1: Create the form component `app/(app)/onboarding/onboarding-form.tsx`**

```tsx
'use client'

import { createFamilyAndCellar } from '@/lib/actions/onboarding'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OnboardingForm() {
  const { run, isPending, error } = useServerAction(createFamilyAndCellar)

  return (
    <form
      onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="familyName">Familienname</Label>
        <Input id="familyName" name="familyName" placeholder="Colaci" required maxLength={60} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cellarName">Name deines Kellers</Label>
        <Input id="cellarName" name="cellarName" placeholder="Weinkeller" required maxLength={60} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Wird angelegt…' : 'Keller anlegen'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create the page `app/(app)/onboarding/page.tsx`**

```tsx
import { getCellarContext } from '@/lib/cellar-context'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const context = await getCellarContext()
  if (context?.cellarId) redirect('/')

  return (
    <div className="px-4 py-12 max-w-sm mx-auto space-y-6">
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--foreground)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Willkommen bei Vino Mio
        </h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          Leg deine Familie und deinen ersten Weinkeller an, um loszulegen.
        </p>
      </div>
      <OnboardingForm />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (after `source ~/.nvm/nvm.sh && nvm use 22.23.0` — the repo's default `node` is too old for this toolchain)
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/onboarding/page.tsx" "app/(app)/onboarding/onboarding-form.tsx"
git commit -m "feat: add /onboarding page"
```

---

### Task 4: Redirect target fix — pages using `getCellarContext()`

**Files:**
- Modify: `app/(app)/page.tsx`
- Modify: `app/(app)/cellar/page.tsx`
- Modify: `app/(app)/trips/page.tsx`
- Modify: `app/(app)/history/page.tsx`
- Modify: `app/(app)/trips/[id]/page.tsx`
- Modify: `app/(app)/wine/[id]/page.tsx`
- Modify: `app/(app)/wine/new/page.tsx`

- [ ] **Step 1: `app/(app)/page.tsx`**

Change:
```ts
  if (!context || !context.cellarId) redirect('/login')
```
to:
```ts
  if (!context || !context.cellarId) redirect('/onboarding')
```

- [ ] **Step 2: `app/(app)/cellar/page.tsx`**

Change:
```ts
  if (!context || !context.cellarId) redirect('/login')
```
to:
```ts
  if (!context || !context.cellarId) redirect('/onboarding')
```

- [ ] **Step 3: `app/(app)/trips/page.tsx`**

Change:
```ts
  if (!context) redirect('/login')
```
to:
```ts
  if (!context) redirect('/onboarding')
```

- [ ] **Step 4: `app/(app)/history/page.tsx`**

Change:
```ts
  if (!context) redirect('/login')
```
to:
```ts
  if (!context) redirect('/onboarding')
```

- [ ] **Step 5: `app/(app)/trips/[id]/page.tsx`**

Change:
```ts
  if (!context || !context.cellarId) redirect('/login')
```
to:
```ts
  if (!context || !context.cellarId) redirect('/onboarding')
```

- [ ] **Step 6: `app/(app)/wine/[id]/page.tsx`**

Change:
```ts
  if (!context || !context.cellarId) redirect('/login')
```
to:
```ts
  if (!context || !context.cellarId) redirect('/onboarding')
```

- [ ] **Step 7: `app/(app)/wine/new/page.tsx`**

Change:
```ts
  if (!context) redirect('/login')
```
to:
```ts
  if (!context) redirect('/onboarding')
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add app/\(app\)/page.tsx app/\(app\)/cellar/page.tsx app/\(app\)/trips/page.tsx app/\(app\)/history/page.tsx "app/(app)/trips/[id]/page.tsx" "app/(app)/wine/[id]/page.tsx" app/\(app\)/wine/new/page.tsx
git commit -m "fix: send authenticated-but-not-onboarded users to /onboarding, not /login"
```

---

### Task 5: Redirect target fix — manual membership checks and server actions

**Files:**
- Modify: `app/(app)/family/page.tsx`
- Modify: `app/(app)/settings/api-keys/page.tsx`
- Modify: `lib/actions/family.ts`
- Modify: `lib/actions/quick-add.ts`
- Modify: `lib/actions/wine.ts`
- Modify: `lib/actions/tasting.ts`
- Modify: `lib/actions/trips.ts`

**Interfaces:**
- No new interfaces — each file has exactly one `if (!membership) redirect('/login')` line (verified: `grep -c` returned 1 for each of these 7 files).

- [ ] **Step 1: `app/(app)/family/page.tsx`**

Change:
```ts
  if (!membership) redirect('/login')
```
to:
```ts
  if (!membership) redirect('/onboarding')
```

- [ ] **Step 2: `app/(app)/settings/api-keys/page.tsx`**

Change:
```ts
  if (!membership) redirect('/login')
```
to:
```ts
  if (!membership) redirect('/onboarding')
```

- [ ] **Step 3: `lib/actions/family.ts`**

Change:
```ts
  if (!membership) redirect('/login')
```
to:
```ts
  if (!membership) redirect('/onboarding')
```

- [ ] **Step 4: `lib/actions/quick-add.ts`**

Change:
```ts
  if (!membership) redirect('/login')
```
to:
```ts
  if (!membership) redirect('/onboarding')
```

- [ ] **Step 5: `lib/actions/wine.ts`**

Change:
```ts
  if (!membership) redirect('/login')
```
to:
```ts
  if (!membership) redirect('/onboarding')
```

- [ ] **Step 6: `lib/actions/tasting.ts`**

Change:
```ts
  if (!membership) redirect('/login')
```
to:
```ts
  if (!membership) redirect('/onboarding')
```

- [ ] **Step 7: `lib/actions/trips.ts`**

Change:
```ts
  if (!membership) redirect('/login')
```
to:
```ts
  if (!membership) redirect('/onboarding')
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add app/\(app\)/family/page.tsx app/\(app\)/settings/api-keys/page.tsx lib/actions/family.ts lib/actions/quick-add.ts lib/actions/wine.ts lib/actions/tasting.ts lib/actions/trips.ts
git commit -m "fix: send not-yet-onboarded users to /onboarding from remaining membership checks"
```

---

### Task 6: Dashboard renders for a zero-wine cellar

**Files:**
- Modify: `app/(app)/page.tsx`

**Interfaces:**
- No new interfaces — restructures existing render logic only.

- [ ] **Step 1: Replace the early-return empty state with an inline conditional**

Change:
```tsx
  if (!latestWine) {
    return (
      <div className="px-4 py-12 max-w-lg mx-auto text-center space-y-4">
        <BottleGlyph />
        <p style={{ color: 'var(--muted-foreground)' }}>Der Keller ist noch leer.</p>
        <Button render={<Link href="/wine/new" />}>
          Ersten Wein hinzufügen
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <WineHeroCard wine={latestWine} />

      <div className="grid grid-cols-2 gap-3">
        <StatsCard title="Flaschen im Keller" value={totalBottles} href="/cellar" />
        <StatsCard title="Verschiedene Weine" value={wineCount} href="/cellar" />
      </div>

      {recentTastings.length > 0 && (
```
to:
```tsx
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {latestWine ? (
        <WineHeroCard wine={latestWine} />
      ) : (
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--foreground)',
          }}
        >
          Willkommen!
        </h2>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatsCard title="Flaschen im Keller" value={totalBottles} href="/cellar" />
        <StatsCard title="Verschiedene Weine" value={wineCount} href="/cellar" />
      </div>

      {!latestWine && (
        <div className="text-center py-8 space-y-4">
          <BottleGlyph />
          <p style={{ color: 'var(--muted-foreground)' }}>Der Keller ist noch leer.</p>
          <Button render={<Link href="/wine/new" />}>
            Ersten Wein hinzufügen
          </Button>
        </div>
      )}

      {recentTastings.length > 0 && (
```

(The closing tags after the `recentTastings` block and the trailing `</div>` / `function BottleGlyph()` are unchanged — only the opening section above moves from a separate early-return into the single return block.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/page.tsx
git commit -m "fix: dashboard shows Willkommen heading and stats for a zero-wine cellar"
```

---

### Task 7: Verify with the existing e2e onboarding spec

**Files:** none (verification only)

- [ ] **Step 1: Reset the e2e test user to a no-family state**

```bash
source ~/.nvm/nvm.sh && nvm use 22.23.0
node -e "
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
require('dotenv').config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: WebSocket } });
(async () => {
  const { data: users } = await admin.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'e2e@cantina-colaci.test');
  const { data: memberships } = await admin.from('family_members').select('family_id').eq('user_id', user.id).eq('role', 'owner');
  const familyIds = (memberships ?? []).map(m => m.family_id);
  if (familyIds.length) await admin.from('families').delete().in('id', familyIds);
  console.log('reset done, deleted families:', familyIds);
})();
"
```
(This is exactly what `e2e/helpers/db.ts`'s `cleanTestUserData()` does — the onboarding spec's own `beforeAll` already calls this, so this manual step is just for an ad-hoc check before running the full suite.)

- [ ] **Step 2: Run the onboarding e2e spec**

```bash
npx playwright test e2e/tests/01-onboarding.spec.ts
```
Expected: both tests pass —
- `completes onboarding and lands on dashboard`: `/` → redirected to `/onboarding` → fill `familyName`/`cellarName` → submit → lands on `/` with an `h2` containing "Willkommen".
- `shows dashboard stats after onboarding`: revisiting `/` shows "Flaschen im Keller" and "Verschiedene Weine".

- [ ] **Step 3: Run the full verification suite**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```
Expected: `vitest` — 123 passed (119 baseline + 4 new from Task 2), the same 10 pre-existing `bottom-nav`/`wine-card` failures (indexedDB, unrelated); `tsc` — the same 9 pre-existing `wine-card.test.tsx` errors, no new ones; `lint` — no new problems beyond the pre-existing baseline.

No commit for this task — it's verification only. If either e2e test fails, return to the relevant task above and fix it there.
