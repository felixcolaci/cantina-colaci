# Storage Locations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named, typed storage locations (fridge, cellar, climate cabinet, etc.) to Cantina Colaci so bottles can be assigned to a physical location and the cellar view can be filtered by location.

**Architecture:** New `storage_locations` table with FK from `cellar_entries.storage_location_id`. RLS mirrors the existing cellar-membership pattern. UI adds a location manager page, a location filter pill row in `/cellar`, a location picker in the add-wine form, and a location badge on the wine detail page.

**Tech Stack:** Same as main app — Next.js 15 App Router, Supabase, shadcn/ui, TypeScript

---

## File Map

```
supabase/migrations/
  003_storage_locations.sql           # New table + FK + RLS

lib/
  types.ts                            # Add StorageLocation type and StorageLocationType
  actions/
    storage-locations.ts              # createLocation, deleteLocation server actions

app/
  settings/
    locations/
      page.tsx                        # Manage locations (server)
      location-list.tsx               # List + delete (client)
      new-location-form.tsx           # Create form (client)
  cellar/
    page.tsx                          # Add location filter pill row
  wine/
    new/
      wine-form.tsx                   # Add storage location picker
    [id]/
      page.tsx                        # Show storage location badge

components/
  nav/
    top-bar.tsx                       # Add "Gestisci posizioni" link to dropdown
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_storage_locations.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/003_storage_locations.sql`:

```sql
-- Storage locations table
create table storage_locations (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references cellars(id) on delete cascade,
  name text not null,
  type text not null check (type in ('fridge', 'cellar', 'climate_cabinet', 'other')),
  created_at timestamptz not null default now()
);

-- Add FK from cellar_entries to storage_locations
alter table cellar_entries
  add column storage_location_id uuid references storage_locations(id) on delete set null;

-- RLS
alter table storage_locations enable row level security;

create policy "family members can read and manage storage locations"
on storage_locations for all
using (
  exists (
    select 1 from cellars
    where cellars.id = storage_locations.cellar_id
    and is_family_member(cellars.family_id)
  )
);
```

- [ ] **Step 2: Apply migration**

In Supabase dashboard → SQL Editor: paste and run.

Verify in Table Editor: `storage_locations` table exists, `cellar_entries` has new `storage_location_id` column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_storage_locations.sql
git commit -m "feat: add storage_locations table and FK from cellar_entries"
```

---

## Task 2: TypeScript Types & Server Actions

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/actions/storage-locations.ts`

- [ ] **Step 1: Add types to `lib/types.ts`**

Add after the existing type definitions:

```typescript
export type StorageLocationType = 'fridge' | 'cellar' | 'climate_cabinet' | 'other'

export interface StorageLocation {
  id: string
  cellar_id: string
  name: string
  type: StorageLocationType
  created_at: string
}
```

- [ ] **Step 2: Write a type test**

In `lib/__tests__/types.test.ts`, add inside the `describe` block:

```typescript
it('StorageLocationType covers all four values', () => {
  const types: StorageLocationType[] = ['fridge', 'cellar', 'climate_cabinet', 'other']
  expect(types).toHaveLength(4)
})
```

- [ ] **Step 3: Run test**

```bash
npm run test:run -- lib/__tests__/types.test.ts
```

Expected: `4 tests passed` (3 existing + 1 new)

- [ ] **Step 4: Create `lib/actions/storage-locations.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { StorageLocationType } from '@/lib/types'

async function getCellarId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return cellar?.id ?? null
}

export async function createLocation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cellarId = await getCellarId(supabase, user.id)
  if (!cellarId) redirect('/onboarding')

  await supabase.from('storage_locations').insert({
    cellar_id: cellarId,
    name: formData.get('name') as string,
    type: formData.get('type') as StorageLocationType,
  })

  redirect('/settings/locations')
}

export async function deleteLocation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string

  // RLS ensures only family members can delete
  await supabase.from('storage_locations').delete().eq('id', id)

  redirect('/settings/locations')
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/actions/storage-locations.ts lib/__tests__/types.test.ts
git commit -m "feat: add StorageLocation types and server actions"
```

---

## Task 3: Manage Storage Locations Page

**Files:**
- Create: `app/settings/locations/page.tsx`
- Create: `app/settings/locations/new-location-form.tsx`
- Create: `app/settings/locations/location-list.tsx`

- [ ] **Step 1: Create `app/settings/locations/new-location-form.tsx`**

```tsx
'use client'

import { createLocation } from '@/lib/actions/storage-locations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const typeLabels = [
  { value: 'fridge', label: '🧊 Frigorifero' },
  { value: 'cellar', label: '🏚️ Cantina' },
  { value: 'climate_cabinet', label: '🌡️ Cantinetta climatizzata' },
  { value: 'other', label: '📦 Altro' },
]

export function NewLocationForm() {
  return (
    <form action={createLocation} className="space-y-3 p-4 rounded-lg border">
      <h3 className="font-medium">Nuova posizione</h3>
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="es. Klimaschrank Treppe" required />
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select name="type" required>
          <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
          <SelectContent>
            {typeLabels.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm">Aggiungi</Button>
    </form>
  )
}
```

- [ ] **Step 2: Create `app/settings/locations/location-list.tsx`**

```tsx
'use client'

import { deleteLocation } from '@/lib/actions/storage-locations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { StorageLocation } from '@/lib/types'

const typeLabels: Record<string, string> = {
  fridge: '🧊 Frigorifero',
  cellar: '🏚️ Cantina',
  climate_cabinet: '🌡️ Climatizzata',
  other: '📦 Altro',
}

export function LocationList({ locations }: { locations: StorageLocation[] }) {
  if (locations.length === 0) {
    return <p className="text-muted-foreground text-sm py-4 text-center">Nessuna posizione ancora</p>
  }

  return (
    <div className="space-y-2">
      {locations.map(loc => (
        <div key={loc.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium">{loc.name}</p>
            <Badge variant="secondary" className="text-xs mt-1">{typeLabels[loc.type]}</Badge>
          </div>
          <form action={deleteLocation}>
            <input type="hidden" name="id" value={loc.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Elimina
            </Button>
          </form>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/settings/locations/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewLocationForm } from './new-location-form'
import { LocationList } from './location-list'
import type { StorageLocation } from '@/lib/types'

export default async function LocationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Posizioni di stoccaggio</h2>
      <LocationList locations={(locations ?? []) as StorageLocation[]} />
      <NewLocationForm />
    </div>
  )
}
```

- [ ] **Step 4: Add link in top bar dropdown**

In `components/nav/top-bar.tsx`, add before the `<LogoutButton />`:

```tsx
<DropdownMenuItem asChild>
  <Link href="/settings/locations">Posizioni</Link>
</DropdownMenuItem>
```

- [ ] **Step 5: Test manually**

Run `npm run dev`. Open profile dropdown → "Posizioni" → create a few locations (e.g. "Kühlschrank Kücheninsel" / fridge, "Keller" / cellar, "Klimaschrank Treppe" / climate_cabinet). Verify they appear in the list and can be deleted.

- [ ] **Step 6: Commit**

```bash
git add app/settings/ components/nav/top-bar.tsx
git commit -m "feat: add storage locations management page"
```

---

## Task 4: Location Picker in Add Wine Form

**Files:**
- Modify: `app/wine/new/page.tsx` (pass locations to form)
- Modify: `app/wine/new/wine-form.tsx` (add location picker)
- Modify: `lib/actions/wine.ts` (persist storage_location_id)

- [ ] **Step 1: Update `lib/actions/wine.ts`**

In the `addWine` server action, add `storage_location_id` to the `cellar_entries` insert:

```typescript
await supabase.from('cellar_entries').insert({
  wine_id: wine.id,
  quantity: parseInt((formData.get('quantity') as string) ?? '1'),
  purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
  purchase_date: (formData.get('purchase_date') as string) || null,
  purchase_location: (formData.get('purchase_location') as string) || null,
  shelf_location: (formData.get('shelf_location') as string) || null,
  storage_location_id: (formData.get('storage_location_id') as string) || null,  // add this line
  trip_id: (formData.get('trip_id') as string) || null,
  photo_url,
  status: 'in_stock',
})
```

- [ ] **Step 2: Update `app/wine/new/page.tsx`**

Add a query for storage locations and pass them to `WineForm`. Replace the page's return with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineForm } from './wine-form'
import type { StorageLocation } from '@/lib/types'

export default async function NewWinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  const [tripsResult, locationsResult] = await Promise.all([
    cellar
      ? supabase.from('trips').select('id, name').eq('cellar_id', cellar.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    cellar
      ? supabase.from('storage_locations').select('id, name, type').eq('cellar_id', cellar.id).order('name')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-6">Aggiungi vino</h2>
      <WineForm
        trips={tripsResult.data ?? []}
        storageLocations={(locationsResult.data ?? []) as StorageLocation[]}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update `app/wine/new/wine-form.tsx`**

Add `storageLocations` prop and picker. Update the props interface:

```typescript
interface WineFormProps {
  trips: Pick<Trip, 'id' | 'name'>[]
  storageLocations: Pick<StorageLocation, 'id' | 'name' | 'type'>[]
}
```

Add import at the top:
```typescript
import type { Trip, StorageLocation } from '@/lib/types'
```

Add the location picker section before the `shelf_location` field:

```tsx
{storageLocations.length > 0 && (
  <div className="space-y-2">
    <Label>Posizione di stoccaggio</Label>
    <Select name="storage_location_id">
      <SelectTrigger><SelectValue placeholder="Seleziona posizione (opzionale)" /></SelectTrigger>
      <SelectContent>
        {storageLocations.map(loc => (
          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

Update the `shelf_location` label to make clear it's the position *within* the location:

```tsx
<div className="space-y-2">
  <Label htmlFor="shelf_location">Posizione esatta (facoltativo)</Label>
  <Input id="shelf_location" name="shelf_location" placeholder="es. Reihe 2, Fach B" />
</div>
```

- [ ] **Step 4: Test manually**

Add a wine, verify the location dropdown shows the locations you created in Task 3. Submit and check the `cellar_entries` row in Supabase has the correct `storage_location_id`.

- [ ] **Step 5: Commit**

```bash
git add app/wine/new/ lib/actions/wine.ts
git commit -m "feat: add storage location picker to add-wine form"
```

---

## Task 5: Location Filter in Cellar View

**Files:**
- Modify: `app/cellar/page.tsx`

- [ ] **Step 1: Update `app/cellar/page.tsx`**

Add `location` to searchParams destructuring:

```typescript
const { type, location } = await searchParams
```

Fetch storage locations alongside wines:

```typescript
const { data: locations } = await supabase
  .from('storage_locations')
  .select('id, name')
  .eq('cellar_id', cellar.id)
  .order('name')
```

Add location filter to the wines query (after the type filter):

```typescript
if (location) {
  query = (query as any)
    .eq('cellar_entries.storage_location_id', location)
}
```

Add a location filter pill row below the existing type filter row:

```tsx
{locations && locations.length > 0 && (
  <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
    <Link
      href={type ? `/cellar?type=${type}` : '/cellar'}
      className={cn(
        'shrink-0 px-3 py-1 rounded-full text-sm border transition-colors',
        !location ? 'bg-primary text-primary-foreground' : 'bg-background'
      )}
    >
      Tutte
    </Link>
    {locations.map(loc => {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (location !== loc.id) params.set('location', loc.id)
      return (
        <Link
          key={loc.id}
          href={`/cellar?${params.toString()}`}
          className={cn(
            'shrink-0 px-3 py-1 rounded-full text-sm border transition-colors',
            location === loc.id ? 'bg-primary text-primary-foreground' : 'bg-background'
          )}
        >
          {loc.name}
        </Link>
      )
    })}
  </div>
)}
```

Update the `searchParams` type:

```typescript
searchParams: Promise<{ type?: string; location?: string }>
```

- [ ] **Step 2: Test manually**

Navigate to `/cellar`. If locations exist, a second filter row appears. Clicking a location shows only wines stored there. Type and location filters combine correctly.

- [ ] **Step 3: Commit**

```bash
git add app/cellar/page.tsx
git commit -m "feat: add storage location filter to cellar view"
```

---

## Task 6: Location Badge on Wine Detail

**Files:**
- Modify: `app/wine/[id]/page.tsx`

- [ ] **Step 1: Fetch storage location in wine detail**

In `app/wine/[id]/page.tsx`, update the `cellar_entries` query to join `storage_locations`:

```typescript
const { data: entries } = await supabase
  .from('cellar_entries')
  .select('*, storage_locations(name, type)')
  .eq('wine_id', id)
  .order('created_at', { ascending: false })
```

- [ ] **Step 2: Show location badge**

In the "bottiglie in cantina" section, below the bottle count, add the location if available:

```tsx
{inStockEntries[0]?.storage_locations && (
  <p className="text-sm text-muted-foreground mt-1">
    📍 {(inStockEntries[0].storage_locations as any).name}
  </p>
)}
```

- [ ] **Step 3: Test manually**

Open a wine that has a storage location set. Verify the location name appears below the bottle count.

- [ ] **Step 4: Commit**

```bash
git add app/wine/[id]/page.tsx
git commit -m "feat: show storage location badge on wine detail page"
```

---

## Run all tests

```bash
npm run test:run
```

Expected: `5 tests passed` (4 existing + 1 new StorageLocationType test)
