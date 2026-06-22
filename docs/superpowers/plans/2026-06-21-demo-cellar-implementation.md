# Demo Cellar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new user automatically gets a pre-seeded demo cellar with 6 Italian wines, 2 storage locations, 1 trip, and 2 tastings. A banner signals demo mode. One click wipes the demo and lets the user start fresh with their own data.

**Architecture:** Add `is_demo` boolean to `families`. Auto-seeding runs as a Server Action triggered by the auth callback for users with no family. `/onboarding` is removed — replaced by auto-create. A `clearDemo` Server Action deletes seed data and sets `is_demo = false`.

**Tech Stack:** Same as main app — Next.js 15 App Router, Supabase, shadcn/ui, TypeScript, Vitest

---

## File Map

```
supabase/migrations/
  006_demo_cellar.sql               # is_demo column on families

lib/
  seed/
    demo-data.ts                    # Seed wine/location/trip/tasting constants
  actions/
    demo.ts                         # seedDemocellar(), clearDemocellar() server actions
  __tests__/
    demo-data.test.ts               # Verify seed data shape

app/
  auth/callback/route.ts            # Trigger seed for new users (modify)
  cellar/
    page.tsx                        # Show demo banner when is_demo = true (modify)
    demo-banner.tsx                 # Banner component (new, client)
  family/
    page.tsx                        # Add "Eigene Cantina starten" button (modify)
    start-own-cellar.tsx            # Confirmation sheet + rename form (new, client)

app/onboarding/                     # DELETE — no longer needed
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/006_demo_cellar.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/006_demo_cellar.sql`:

```sql
alter table families
  add column is_demo boolean not null default true;

-- Existing families are real, not demo
update families set is_demo = false;
```

- [ ] **Step 2: Apply migration**

In Supabase dashboard → SQL Editor: paste and run.

Verify: `families` has `is_demo` column; all existing rows have `is_demo = false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_demo_cellar.sql
git commit -m "feat: add is_demo column to families"
```

---

## Task 2: Upload Shared Demo Photos (one-time setup)

Demo bottle photos are stored **once** in Supabase Storage and shared across all demo cellars. This task is a one-time manual step, not part of the deploy pipeline.

**Files:**
- (no code) — manual upload to Supabase Storage

- [ ] **Step 1: Prepare 6 bottle images**

Source or create one image per wine (JPG, ~800×1200px, <300 KB each):

| Filename | Wine |
|---|---|
| `brunello.jpg` | Brunello di Montalcino |
| `barolo.jpg` | Barolo |
| `pinot-grigio.jpg` | Pinot Grigio |
| `prosecco.jpg` | Prosecco Superiore |
| `chianti.jpg` | Chianti Classico Riserva |
| `rose.jpg` | Rosé di Montepulciano |

- [ ] **Step 2: Upload to Supabase Storage**

In Supabase dashboard → Storage → `wine-photos` bucket → create folder `demo/` → upload all 6 files.

Verify each file is accessible at:
`https://<project-ref>.supabase.co/storage/v1/object/public/wine-photos/demo/<filename>.jpg`

- [ ] **Step 3: Note the Storage path prefix**

The public URL base is `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wine-photos/`. The code references files as `demo/brunello.jpg` etc. and constructs the full URL at seed time.

---

## Task 3: Seed Data Constants & Tests

**Files:**
- Create: `lib/seed/demo-data.ts`
- Create: `lib/__tests__/demo-data.test.ts`

- [ ] **Step 1: Create `lib/seed/demo-data.ts`**

```typescript
import type { WineType, StorageLocationType } from '@/lib/types'

export const DEMO_STORAGE_LOCATIONS: { name: string; type: StorageLocationType }[] = [
  { name: 'Klimaschrank', type: 'climate_cabinet' },
  { name: 'Kühlschrank', type: 'fridge' },
]

export const DEMO_TRIP = {
  name: 'Toskana Mai 2026',
  location: 'Toscana, Italia',
  date_start: '2026-05-10',
  date_end: '2026-05-17',
}

export interface DemoWine {
  name: string
  producer: string
  vintage: number | null
  type: WineType
  region: string
  country: string
  grape_variety: string
  quantity: number
  purchase_price: number
  purchase_location: string
  storageLocationIndex: number  // index into DEMO_STORAGE_LOCATIONS
  tripIndex: number | null      // null = not from trip
  notes: string | null
  // Path within wine-photos bucket — shared across all demo cellars, never deleted per user
  demoPhotoPath: string
  tasting: { rating: number; notes: string } | null
}

export const DEMO_WINES: DemoWine[] = [
  {
    name: 'Brunello di Montalcino',
    producer: 'Casanova di Neri',
    vintage: 2018,
    type: 'red',
    region: 'Toscana',
    country: 'Italia',
    grape_variety: 'Sangiovese Grosso',
    quantity: 2,
    purchase_price: 48,
    purchase_location: 'Montalcino, Italia',
    storageLocationIndex: 0,
    tripIndex: 0,
    notes: 'Für besondere Anlässe — mindestens bis 2030 warten.',
    demoPhotoPath: 'demo/brunello.jpg',
    tasting: null,
  },
  {
    name: 'Barolo',
    producer: 'Giacomo Conterno',
    vintage: 2019,
    type: 'red',
    region: 'Piemonte',
    country: 'Italia',
    grape_variety: 'Nebbiolo',
    quantity: 3,
    purchase_price: 62,
    purchase_location: 'Barolo, Italia',
    storageLocationIndex: 0,
    tripIndex: null,
    notes: null,
    demoPhotoPath: 'demo/barolo.jpg',
    tasting: null,
  },
  {
    name: 'Pinot Grigio',
    producer: 'Santa Margherita',
    vintage: 2022,
    type: 'white',
    region: 'Alto Adige',
    country: 'Italia',
    grape_variety: 'Pinot Grigio',
    quantity: 4,
    purchase_price: 14,
    purchase_location: 'Online',
    storageLocationIndex: 1,
    tripIndex: null,
    notes: null,
    demoPhotoPath: 'demo/pinot-grigio.jpg',
    tasting: { rating: 7, notes: 'Leicht und mineralisch — gut zum Fisch.' },
  },
  {
    name: 'Prosecco Superiore DOCG',
    producer: 'Bisol',
    vintage: null,
    type: 'sparkling',
    region: 'Veneto',
    country: 'Italia',
    grape_variety: 'Glera',
    quantity: 6,
    purchase_price: 12,
    purchase_location: 'Weinhandlung Müller',
    storageLocationIndex: 1,
    tripIndex: null,
    notes: null,
    demoPhotoPath: 'demo/prosecco.jpg',
    tasting: { rating: 8, notes: 'Frisch und lebendig — perfekt als Aperitivo.' },
  },
  {
    name: 'Chianti Classico Riserva',
    producer: 'Antinori',
    vintage: 2020,
    type: 'red',
    region: 'Toscana',
    country: 'Italia',
    grape_variety: 'Sangiovese',
    quantity: 2,
    purchase_price: 28,
    purchase_location: 'Greve in Chianti, Italia',
    storageLocationIndex: 0,
    tripIndex: 0,
    notes: null,
    demoPhotoPath: 'demo/chianti.jpg',
    tasting: null,
  },
  {
    name: 'Rosé di Montepulciano',
    producer: 'Avignonesi',
    vintage: 2023,
    type: 'rosé',
    region: 'Toscana',
    country: 'Italia',
    grape_variety: 'Prugnolo Gentile',
    quantity: 2,
    purchase_price: 16,
    purchase_location: 'Montepulciano, Italia',
    storageLocationIndex: 1,
    tripIndex: 0,
    notes: null,
    demoPhotoPath: 'demo/rose.jpg',
    tasting: null,
  },
]
```

- [ ] **Step 2: Create `lib/__tests__/demo-data.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { DEMO_WINES, DEMO_STORAGE_LOCATIONS, DEMO_TRIP } from '../seed/demo-data'

describe('demo seed data', () => {
  it('has 6 wines', () => {
    expect(DEMO_WINES).toHaveLength(6)
  })

  it('covers all four wine types', () => {
    const types = new Set(DEMO_WINES.map(w => w.type))
    expect(types).toContain('red')
    expect(types).toContain('white')
    expect(types).toContain('rosé')
    expect(types).toContain('sparkling')
  })

  it('has 2 storage locations', () => {
    expect(DEMO_STORAGE_LOCATIONS).toHaveLength(2)
  })

  it('all storageLocationIndex values are valid', () => {
    DEMO_WINES.forEach(w => {
      expect(w.storageLocationIndex).toBeGreaterThanOrEqual(0)
      expect(w.storageLocationIndex).toBeLessThan(DEMO_STORAGE_LOCATIONS.length)
    })
  })

  it('has 2 pre-recorded tastings', () => {
    const tastings = DEMO_WINES.filter(w => w.tasting !== null)
    expect(tastings).toHaveLength(2)
  })

  it('all ratings are between 1 and 10', () => {
    DEMO_WINES.filter(w => w.tasting).forEach(w => {
      expect(w.tasting!.rating).toBeGreaterThanOrEqual(1)
      expect(w.tasting!.rating).toBeLessThanOrEqual(10)
    })
  })

  it('all wines have a demoPhotoPath under demo/', () => {
    DEMO_WINES.forEach(w => {
      expect(w.demoPhotoPath).toMatch(/^demo\/[a-z-]+\.jpg$/)
    })
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- lib/__tests__/demo-data.test.ts
```

Expected: `7 tests passed`

- [ ] **Step 4: Commit**

```bash
git add lib/seed/ lib/__tests__/demo-data.test.ts
git commit -m "feat: add demo cellar seed data constants and tests"
```

---

## Task 4: Seed & Clear Server Actions

**Files:**
- Create: `lib/actions/demo.ts`

- [ ] **Step 1: Create `lib/actions/demo.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DEMO_WINES, DEMO_STORAGE_LOCATIONS, DEMO_TRIP } from '@/lib/seed/demo-data'

export async function seedDemoCellar(userId: string): Promise<void> {
  const supabase = await createClient()

  // Create family
  const { data: family } = await supabase
    .from('families')
    .insert({ name: 'Meine Familie', created_by: userId, is_demo: true })
    .select()
    .single()

  if (!family) return

  // Add owner membership
  await supabase
    .from('family_members')
    .insert({ family_id: family.id, user_id: userId, role: 'owner' })

  // Create cellar
  const { data: cellar } = await supabase
    .from('cellars')
    .insert({ family_id: family.id, name: 'Meine Cantina' })
    .select()
    .single()

  if (!cellar) return

  // Create storage locations
  const { data: locations } = await supabase
    .from('storage_locations')
    .insert(DEMO_STORAGE_LOCATIONS.map(loc => ({ ...loc, cellar_id: cellar.id })))
    .select()

  if (!locations) return

  // Create trip
  const { data: trips } = await supabase
    .from('trips')
    .insert([{ ...DEMO_TRIP, cellar_id: cellar.id }])
    .select()

  const demoTrip = trips?.[0] ?? null

  // Create wines + entries + tastings
  for (const demoWine of DEMO_WINES) {
    const { data: wine } = await supabase
      .from('wines')
      .insert({
        cellar_id: cellar.id,
        name: demoWine.name,
        producer: demoWine.producer,
        vintage: demoWine.vintage,
        type: demoWine.type,
        region: demoWine.region,
        country: demoWine.country,
        grape_variety: demoWine.grape_variety,
        notes: demoWine.notes,
      })
      .select()
      .single()

    if (!wine) continue

    const location = locations[demoWine.storageLocationIndex]
    const trip = demoWine.tripIndex !== null ? demoTrip : null

    // Resolve shared demo photo URL — files live under demo/ in the wine-photos bucket
    // and are never deleted per user; all demo cellars reference the same file
    const { data: photoData } = supabase.storage
      .from('wine-photos')
      .getPublicUrl(demoWine.demoPhotoPath)

    const { data: entry } = await supabase
      .from('cellar_entries')
      .insert({
        wine_id: wine.id,
        quantity: demoWine.quantity,
        purchase_price: demoWine.purchase_price,
        purchase_location: demoWine.purchase_location,
        storage_location_id: location?.id ?? null,
        trip_id: trip?.id ?? null,
        photo_url: photoData.publicUrl,
        status: 'in_stock',
      })
      .select()
      .single()

    if (entry && demoWine.tasting) {
      await supabase.from('tastings').insert({
        cellar_entry_id: entry.id,
        user_id: userId,
        date: '2026-06-01',
        rating: demoWine.tasting.rating,
        notes: demoWine.tasting.notes,
      })
    }
  }
}

export async function clearDemoCellar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cellarName = (formData.get('cellarName') as string) || 'Meine Cantina'

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/')

  // Get all wine IDs in this cellar
  const { data: wines } = await supabase
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  if (wineIds.length > 0) {
    // Get all cellar entry IDs
    // NOTE: We do NOT delete photos from Storage — demo photos (demo/*.jpg) are shared
    // across all demo cellars and must never be removed per-user.
    const { data: entries } = await supabase
      .from('cellar_entries')
      .select('id')
      .in('wine_id', wineIds)

    const entryIds = (entries ?? []).map(e => e.id)

    if (entryIds.length > 0) {
      await supabase.from('tastings').delete().in('cellar_entry_id', entryIds)
      await supabase.from('cellar_entries').delete().in('id', entryIds)
    }

    await supabase.from('wines').delete().in('id', wineIds)
  }

  // Delete trips and storage locations
  await supabase.from('trips').delete().eq('cellar_id', cellar.id)
  await supabase.from('storage_locations').delete().eq('cellar_id', cellar.id)

  // Rename cellar and mark family as no longer demo
  await supabase.from('cellars').update({ name: cellarName }).eq('id', cellar.id)
  await supabase.from('families').update({ is_demo: false }).eq('id', membership.family_id)

  redirect('/cellar')
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/demo.ts
git commit -m "feat: add seedDemoCellar and clearDemoCellar server actions"
```

---

## Task 5: Auto-Seed on First Login

Replace the `/onboarding` redirect with auto-seeding in the auth callback.

**Files:**
- Modify: `app/auth/callback/route.ts`
- Delete: `app/onboarding/` directory

- [ ] **Step 1: Update `app/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { seedDemoCellar } from '@/lib/actions/demo'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Check if user already has a family
      const { data: membership } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .maybeSingle()

      // New user — seed demo cellar
      if (!membership) {
        await seedDemoCellar(user.id)
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
```

- [ ] **Step 2: Remove `/onboarding` pages**

```bash
rm -rf app/onboarding/
```

- [ ] **Step 3: Update middleware to remove `/onboarding` from public paths**

In `middleware.ts`, remove `'/onboarding'` from the `publicPaths` array if present. The onboarding redirect is no longer needed.

- [ ] **Step 4: Update `app/page.tsx` (dashboard)**

Remove the redirect to `/onboarding` — the dashboard can now assume every logged-in user has a family:

```typescript
// Remove this block:
// if (!membership) redirect('/onboarding')
// Replace with:
if (!membership) redirect('/login')
```

Apply the same change to any other page that previously redirected to `/onboarding`.

- [ ] **Step 5: Commit**

```bash
git add app/auth/callback/route.ts app/page.tsx middleware.ts
git rm -r app/onboarding/
git commit -m "feat: auto-seed demo cellar on first login, remove onboarding page"
```

---

## Task 6: Demo Banner & Clear Flow

**Files:**
- Create: `app/cellar/demo-banner.tsx`
- Modify: `app/cellar/page.tsx`
- Create: `app/family/start-own-cellar.tsx`
- Modify: `app/family/page.tsx`

- [ ] **Step 1: Create `app/cellar/demo-banner.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem('demo-banner-dismissed') === 'true')
  }, [])

  function dismiss() {
    sessionStorage.setItem('demo-banner-dismissed', 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 mb-4">
      <span className="text-xl shrink-0">🍷</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">Demo-Modus</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Erkunde deine Cantina mit Beispielweinen. Wenn du bereit bist, starte mit deinen echten Weinen.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-2 h-7 text-xs border-amber-300">
          <Link href="/family#start">Eigene Cantina starten →</Link>
        </Button>
      </div>
      <button onClick={dismiss} className="text-amber-400 hover:text-amber-600 shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Show banner in `app/cellar/page.tsx`**

Fetch `is_demo` from the family and pass it to the banner. Add after the membership query:

```typescript
const { data: family } = await supabase
  .from('families')
  .select('is_demo')
  .eq('id', membership.family_id)
  .maybeSingle()

const isDemo = family?.is_demo ?? false
```

In the JSX, before the filter pills:

```tsx
{isDemo && <DemoBanner />}
```

Import: `import { DemoBanner } from './demo-banner'`

- [ ] **Step 3: Create `app/family/start-own-cellar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { clearDemoCellar } from '@/lib/actions/demo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from '@/components/ui/sheet'

export function StartOwnCellar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="w-full">🚀 Eigene Cantina starten</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Eigene Cantina starten</SheetTitle>
          <SheetDescription>
            Die Demo-Weine werden gelöscht. Du startest mit einer leeren Cantina.
          </SheetDescription>
        </SheetHeader>
        <form action={clearDemoCellar} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="cellarName">Name deiner Cantina</Label>
            <Input
              id="cellarName"
              name="cellarName"
              defaultValue="Meine Cantina"
              required
            />
          </div>
          <Button type="submit" className="w-full">Demo löschen & starten</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Add to `app/family/page.tsx`**

Fetch `is_demo` alongside the existing family query:

```typescript
const { data: membership } = await supabase
  .from('family_members')
  .select('family_id, role, families(name, is_demo)')
  .eq('user_id', user.id)
  .maybeSingle()
```

In the JSX, add before the invite section:

```tsx
{(membership.families as any)?.is_demo && (
  <div id="start">
    <h3 className="font-medium mb-2">Demo-Modus</h3>
    <p className="text-sm text-muted-foreground mb-3">
      Du nutzt aktuell die Demo-Cantina mit Beispielweinen. Starte jetzt mit deinen eigenen.
    </p>
    <StartOwnCellar />
  </div>
)}
```

Import: `import { StartOwnCellar } from './start-own-cellar'`

- [ ] **Step 5: Test full flow manually**

1. Create a new Supabase user (different email)
2. Log in → cellar auto-populates with 6 wines, banner appears
3. Explore: filter by type, open a bottle, check `/history`, `/trips`
4. Click "Eigene Cantina starten" → confirm → cellar is empty, banner gone
5. Verify `families.is_demo = false` in Supabase Studio

- [ ] **Step 6: Commit**

```bash
git add app/cellar/demo-banner.tsx app/cellar/page.tsx app/family/start-own-cellar.tsx app/family/page.tsx
git commit -m "feat: add demo banner and start-own-cellar flow"
```

---

## Run all tests

```bash
npm run test:run
```

Expected: `19 tests passed` (13 existing + 6 new demo-data tests)
