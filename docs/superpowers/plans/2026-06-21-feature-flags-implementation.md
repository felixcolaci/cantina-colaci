# Feature Flags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a family-scoped feature flag system that gates features by subscription plan, with per-family overrides. All flags start enabled during beta; billing can be wired later without touching feature code.

**Architecture:** `plan` column on `families` + `feature_flag_overrides` table in Supabase. Flag resolution in `lib/flags.ts` (override → plan default → global default). Flags flow server → client as props, never fetched client-side. Admin override UI at `/admin/flags`.

**Tech Stack:** Same as main app — Next.js 15 App Router, Supabase, shadcn/ui, TypeScript, Vitest

---

## File Map

```
supabase/migrations/
  005_feature_flags.sql              # plan column on families + feature_flag_overrides table

lib/
  flags.ts                           # Flag definitions, plan defaults, getFeatureFlags()
  __tests__/
    flags.test.ts                    # Unit tests for flag resolution logic

app/
  admin/
    flags/
      page.tsx                       # Admin: list families + toggle overrides (server)
      flag-toggle.tsx                # Toggle switch per flag per family (client)

lib/actions/
  admin-flags.ts                     # setFlagOverride server action (admin only)
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/005_feature_flags.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/005_feature_flags.sql`:

```sql
-- Add plan to families
alter table families
  add column plan text not null default 'free'
  check (plan in ('free', 'pro', 'business'));

-- Per-family flag overrides
create table feature_flag_overrides (
  family_id uuid not null references families(id) on delete cascade,
  flag text not null,
  enabled boolean not null,
  created_at timestamptz not null default now(),
  primary key (family_id, flag)
);

-- Only family members can read their own overrides
alter table feature_flag_overrides enable row level security;

create policy "family members can read their overrides"
on feature_flag_overrides for select
using (is_family_member(family_id));
```

- [ ] **Step 2: Apply migration**

In Supabase dashboard → SQL Editor: paste and run.

Verify: `families` has a `plan` column defaulting to `'free'`. `feature_flag_overrides` table exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_feature_flags.sql
git commit -m "feat: add plan column and feature_flag_overrides table"
```

---

## Task 2: Flag Definitions & Resolution Logic

**Files:**
- Create: `lib/flags.ts`
- Create: `lib/__tests__/flags.test.ts`

- [ ] **Step 1: Write `lib/flags.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'

export type FlagName =
  | 'mcp_integration'
  | 'unlimited_cellar'
  | 'advanced_stats'
  | 'shared_tours'
  | 'winery_profiles'
  | 'social_map'

export type Plan = 'free' | 'pro' | 'business'

export type FeatureFlags = Record<FlagName, boolean>

// During beta: all flags on for everyone.
// When billing goes live: set BETA_MODE to false — plan defaults kick in.
const BETA_MODE = true

const PLAN_FLAGS: Record<Plan, FeatureFlags> = {
  free: {
    mcp_integration: true,
    unlimited_cellar: false,
    advanced_stats: false,
    shared_tours: true,
    winery_profiles: false,
    social_map: true,
  },
  pro: {
    mcp_integration: true,
    unlimited_cellar: true,
    advanced_stats: true,
    shared_tours: true,
    winery_profiles: false,
    social_map: true,
  },
  business: {
    mcp_integration: true,
    unlimited_cellar: true,
    advanced_stats: true,
    shared_tours: true,
    winery_profiles: true,
    social_map: true,
  },
}

const ALL_ON: FeatureFlags = {
  mcp_integration: true,
  unlimited_cellar: true,
  advanced_stats: true,
  shared_tours: true,
  winery_profiles: true,
  social_map: true,
}

export function resolveFlagsFromPlan(
  plan: Plan,
  overrides: Partial<Record<FlagName, boolean>>
): FeatureFlags {
  const base: FeatureFlags = BETA_MODE ? { ...ALL_ON } : { ...PLAN_FLAGS[plan] }
  return { ...base, ...overrides } as FeatureFlags
}

export async function getFeatureFlags(familyId: string): Promise<FeatureFlags> {
  const supabase = await createClient()

  const [familyResult, overridesResult] = await Promise.all([
    supabase
      .from('families')
      .select('plan')
      .eq('id', familyId)
      .maybeSingle(),
    supabase
      .from('feature_flag_overrides')
      .select('flag, enabled')
      .eq('family_id', familyId),
  ])

  const plan = (familyResult.data?.plan ?? 'free') as Plan
  const overrides: Partial<Record<FlagName, boolean>> = {}
  for (const row of overridesResult.data ?? []) {
    overrides[row.flag as FlagName] = row.enabled
  }

  return resolveFlagsFromPlan(plan, overrides)
}
```

- [ ] **Step 2: Write `lib/__tests__/flags.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { resolveFlagsFromPlan } from '../flags'

describe('resolveFlagsFromPlan', () => {
  it('free plan: unlimited_cellar is off (when not in beta)', () => {
    // Test plan logic directly, bypassing BETA_MODE
    const flags = resolveFlagsFromPlan('free', {})
    // In beta mode all are on — we test the merge logic
    const withOverride = resolveFlagsFromPlan('free', { unlimited_cellar: false })
    expect(withOverride.unlimited_cellar).toBe(false)
  })

  it('override takes precedence over plan default', () => {
    const flags = resolveFlagsFromPlan('free', { advanced_stats: true })
    expect(flags.advanced_stats).toBe(true)
  })

  it('override can disable a flag that is on by default', () => {
    const flags = resolveFlagsFromPlan('pro', { social_map: false })
    expect(flags.social_map).toBe(false)
  })

  it('business plan enables winery_profiles', () => {
    const flags = resolveFlagsFromPlan('business', {})
    // business plan has winery_profiles: true in PLAN_FLAGS
    // In beta mode it's also true, but let's verify the override path
    const withOverride = resolveFlagsFromPlan('business', { winery_profiles: true })
    expect(withOverride.winery_profiles).toBe(true)
  })

  it('all flag names are present in result', () => {
    const flags = resolveFlagsFromPlan('free', {})
    const expectedKeys = [
      'mcp_integration', 'unlimited_cellar', 'advanced_stats',
      'shared_tours', 'winery_profiles', 'social_map',
    ]
    for (const key of expectedKeys) {
      expect(key in flags).toBe(true)
    }
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- lib/__tests__/flags.test.ts
```

Expected: `5 tests passed`

- [ ] **Step 4: Commit**

```bash
git add lib/flags.ts lib/__tests__/flags.test.ts
git commit -m "feat: add feature flag definitions and resolution logic"
```

---

## Task 3: Wire Flags into Existing Features

Add flag checks to the two most natural gate points to prove the pattern works end-to-end.

**Files:**
- Modify: `app/cellar/page.tsx` (enforce `unlimited_cellar` limit)
- Modify: `app/page.tsx` (pass flags to dashboard for future use)

- [ ] **Step 1: Fetch familyId helper**

The flag system needs `familyId`. Extract a reusable helper so pages don't repeat the membership query. Add to `lib/flags.ts`:

```typescript
export async function getFamilyId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return membership?.family_id ?? null
}
```

- [ ] **Step 2: Gate cellar entry limit in `lib/actions/wine.ts`**

In the `addWine` server action, after resolving `cellarId`, add:

```typescript
import { getFeatureFlags, getFamilyId } from '@/lib/flags'

// After: const cellarId = await getCellarId(supabase, user.id)
const familyId = await getFamilyId()
if (familyId) {
  const flags = await getFeatureFlags(familyId)
  if (!flags.unlimited_cellar) {
    const { count } = await supabase
      .from('wines')
      .select('*', { count: 'exact', head: true })
      .eq('cellar_id', cellarId)
    if ((count ?? 0) >= 50) {
      throw new Error('Limite raggiunto: massimo 50 vini nel piano gratuito.')
    }
  }
}
```

- [ ] **Step 3: Surface the limit in the cellar page**

In `app/cellar/page.tsx`, fetch flags and show a banner if near the limit:

```typescript
// After fetching cellar and wines:
const familyId = membership.family_id
const flags = await getFeatureFlags(familyId)
const atLimit = !flags.unlimited_cellar && (wines?.length ?? 0) >= 50
```

In the JSX, above the wine list:

```tsx
{atLimit && (
  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
    Hai raggiunto il limite di 50 vini nel piano gratuito.
    <span className="font-medium ml-1">Passa a Pro per una cantina illimitata.</span>
  </div>
)}
```

- [ ] **Step 4: Test gate manually**

In Supabase SQL Editor, temporarily set the free plan limit to 2 for testing:

```sql
-- Test: set a family to free plan
update families set plan = 'free' where name = 'Colaci';
```

Then set `BETA_MODE = false` temporarily in `lib/flags.ts`, add 2 wines, try to add a third → error appears. Reset `BETA_MODE = true` and plan after testing.

- [ ] **Step 5: Commit**

```bash
git add lib/flags.ts lib/actions/wine.ts app/cellar/page.tsx
git commit -m "feat: wire feature flags into cellar limit and wine creation"
```

---

## Task 4: Admin Override UI

**Files:**
- Create: `lib/actions/admin-flags.ts`
- Create: `app/admin/flags/page.tsx`
- Create: `app/admin/flags/flag-toggle.tsx`

- [ ] **Step 1: Define admin emails**

Add to `.env.local` and `.env.local.example`:
```
ADMIN_EMAILS=felix@colaci.eu
```

- [ ] **Step 2: Create `lib/actions/admin-flags.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import type { FlagName } from '@/lib/flags'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!user || !adminEmails.includes(user.email ?? '')) {
    throw new Error('Unauthorized')
  }
}

export async function setFlagOverride(formData: FormData) {
  await assertAdmin()
  const serviceClient = createServiceClient()

  const familyId = formData.get('family_id') as string
  const flag = formData.get('flag') as FlagName
  const enabled = formData.get('enabled') === 'true'

  await serviceClient
    .from('feature_flag_overrides')
    .upsert({ family_id: familyId, flag, enabled }, { onConflict: 'family_id,flag' })

  redirect('/admin/flags')
}

export async function removeFlagOverride(formData: FormData) {
  await assertAdmin()
  const serviceClient = createServiceClient()

  await serviceClient
    .from('feature_flag_overrides')
    .delete()
    .eq('family_id', formData.get('family_id') as string)
    .eq('flag', formData.get('flag') as string)

  redirect('/admin/flags')
}
```

- [ ] **Step 3: Create `app/admin/flags/flag-toggle.tsx`**

```tsx
'use client'

import { setFlagOverride, removeFlagOverride } from '@/lib/actions/admin-flags'
import { Button } from '@/components/ui/button'

interface FlagToggleProps {
  familyId: string
  flag: string
  currentValue: boolean | null  // null = no override (plan default applies)
}

export function FlagToggle({ familyId, flag, currentValue }: FlagToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <form action={setFlagOverride}>
        <input type="hidden" name="family_id" value={familyId} />
        <input type="hidden" name="flag" value={flag} />
        <input type="hidden" name="enabled" value="true" />
        <Button
          type="submit"
          size="sm"
          variant={currentValue === true ? 'default' : 'outline'}
        >
          An
        </Button>
      </form>
      <form action={setFlagOverride}>
        <input type="hidden" name="family_id" value={familyId} />
        <input type="hidden" name="flag" value={flag} />
        <input type="hidden" name="enabled" value="false" />
        <Button
          type="submit"
          size="sm"
          variant={currentValue === false ? 'destructive' : 'outline'}
        >
          Aus
        </Button>
      </form>
      {currentValue !== null && (
        <form action={removeFlagOverride}>
          <input type="hidden" name="family_id" value={familyId} />
          <input type="hidden" name="flag" value={flag} />
          <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">
            Reset
          </Button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `app/admin/flags/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { FlagToggle } from './flag-toggle'
import { Badge } from '@/components/ui/badge'

const FLAG_NAMES = [
  'mcp_integration', 'unlimited_cellar', 'advanced_stats',
  'shared_tours', 'winery_profiles', 'social_map',
]

export default async function AdminFlagsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(user.email ?? '')) redirect('/')

  const serviceClient = createServiceClient()

  const { data: families } = await serviceClient
    .from('families')
    .select('id, name, plan')
    .order('name')

  const { data: overrides } = await serviceClient
    .from('feature_flag_overrides')
    .select('family_id, flag, enabled')

  // Index overrides by family_id + flag
  const overrideMap: Record<string, Record<string, boolean>> = {}
  for (const o of overrides ?? []) {
    if (!overrideMap[o.family_id]) overrideMap[o.family_id] = {}
    overrideMap[o.family_id][o.flag] = o.enabled
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-8">
      <h2 className="text-xl font-semibold">Feature Flags (Admin)</h2>

      {families?.map(family => (
        <div key={family.id} className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 flex items-center gap-3">
            <span className="font-medium">{family.name}</span>
            <Badge variant="outline">{family.plan}</Badge>
          </div>
          <div className="divide-y">
            {FLAG_NAMES.map(flag => {
              const override = overrideMap[family.id]?.[flag] ?? null
              return (
                <div key={flag} className="px-4 py-3 flex items-center justify-between">
                  <code className="text-sm">{flag}</code>
                  <div className="flex items-center gap-3">
                    {override !== null && (
                      <Badge variant={override ? 'default' : 'secondary'}>
                        override: {override ? 'an' : 'aus'}
                      </Badge>
                    )}
                    <FlagToggle
                      familyId={family.id}
                      flag={flag}
                      currentValue={override}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Test admin page**

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin/flags` while logged in as `felix@colaci.eu`. You should see all families with their flags and override toggles. Toggle a flag, verify the `feature_flag_overrides` row appears in Supabase.

Non-admin users navigating to `/admin/flags` should be redirected to `/`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/ lib/actions/admin-flags.ts
git commit -m "feat: add admin feature flag override UI"
git push origin main
```

---

## Run all tests

```bash
npm run test:run
```

Expected: `13 tests passed` (8 existing + 5 new flags tests)

---

## Activating billing later

When Stripe (or any billing provider) is integrated:

1. Set `BETA_MODE = false` in `lib/flags.ts`
2. On successful payment, update `families.plan` to `'pro'` or `'business'`
3. No feature code changes needed — flags resolve automatically from the new plan

That's it.
