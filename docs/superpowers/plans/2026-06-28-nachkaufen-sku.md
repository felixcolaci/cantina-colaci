# Nachkaufen / SKU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `cellar_entries` → `skus`, move `vintage` from `wines` to `skus`, and add a "Posten hinzufügen" sheet on the wine detail page to record new bottle purchases.

**Architecture:** Five sequential tasks — DB migration first (no code), then actions + types, then UI components, then cellar page, then wine detail page + new AddSkuSheet. Each task leaves the build passing.

**Tech Stack:** React, TypeScript, Next.js App Router, Supabase (admin client), CSS custom properties, DatePicker component, Vitest.

## Global Constraints

- All visual tokens via `var(--...)` — no hardcoded hex or Tailwind color classes
- Display font: `var(--font-display)` (Cormorant Garamond)
- Form field `cellar_entry_id` in `open-bottle-button.tsx` stays unchanged (the DB column `tastings.cellar_entry_id` is NOT renamed)
- `tastings.cellar_entry_id` FK column is NOT renamed — only the `cellar_entries` table itself is renamed
- Run tests: `npx vitest run`
- Run build: `npm run build`

---

### Task 1: DB Migration

**Files:**
- No code files — SQL only, applied via Supabase MCP

**Interfaces:**
- Produces: `skus` table with `vintage INTEGER` column; `wines` table without `vintage` column

- [ ] **Step 1: Apply migration**

Use the Supabase MCP tool `apply_migration` with name `rename_cellar_entries_to_skus_add_vintage` and the following SQL:

```sql
-- 1. Rename table
ALTER TABLE cellar_entries RENAME TO skus;

-- 2. Add vintage column
ALTER TABLE skus ADD COLUMN vintage INTEGER;

-- 3. Copy vintage from parent wine to each sku
UPDATE skus
SET vintage = wines.vintage
FROM wines
WHERE skus.wine_id = wines.id;

-- 4. Remove vintage from wines
ALTER TABLE wines DROP COLUMN vintage;
```

- [ ] **Step 2: Verify migration**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'skus' AND column_name = 'vintage';
```
Expected: 1 row returned with `column_name = 'vintage'`.

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'wines' AND column_name = 'vintage';
```
Expected: 0 rows (column removed).

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: DB migration — rename cellar_entries to skus, add vintage per sku"
```

---

### Task 2: TypeScript types + all server actions

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/actions/skus.ts`
- Delete: `lib/actions/entries.ts`
- Modify: `lib/actions/tasting.ts`
- Modify: `lib/actions/wine.ts`
- Modify: `lib/actions/demo.ts`

**Interfaces:**
- Consumes: `skus` table (Task 1)
- Produces:
  - `Sku` type (replaces `CellarEntry`) with `vintage: number | null`
  - `updateSku(formData)` — replaces `updateEntry`
  - `clearSkuPhoto(formData)` — replaces `clearEntryPhoto`
  - `addSku(formData)` — new action

- [ ] **Step 1: Update `lib/types.ts`**

```ts
export type WineType = 'red' | 'white' | 'rosé' | 'sparkling'
export type EntryStatus = 'in_stock' | 'consumed' | 'gifted'
export type FamilyRole = 'owner' | 'member'

export interface Family {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface FamilyMember {
  family_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
}

export interface Cellar {
  id: string
  family_id: string
  name: string
  created_at: string
}

export interface Wine {
  id: string
  cellar_id: string
  name: string
  producer: string
  region: string | null
  country: string | null
  grape_variety: string | null
  type: WineType
  notes: string | null
  created_at: string
}

export interface Sku {
  id: string
  wine_id: string
  vintage: number | null
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  photo_url: string | null
  trip_id: string | null
  status: EntryStatus
  created_at: string
}

export interface Tasting {
  id: string
  cellar_entry_id: string
  user_id: string
  date: string
  rating: number
  notes: string | null
  created_at: string
}

export interface Trip {
  id: string
  cellar_id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
  created_at: string
}

export type StorageLocationType = 'fridge' | 'cellar' | 'climate_cabinet' | 'other'

export interface StorageLocation {
  id: string
  cellar_id: string
  name: string
  type: StorageLocationType
  created_at: string
}

export interface ApiKey {
  id: string
  family_id: string
  name: string
  key_hash: string
  created_at: string
}

export interface WineHints {
  names: string[]
  producers: string[]
  grapeVarieties: string[]
  purchaseLocations: string[]
  ownRegionsByCountry: Record<string, string[]>
  ownCountries: string[]
}
```

- [ ] **Step 2: Create `lib/actions/skus.ts`**

```ts
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function updateSku(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const id = formData.get('id') as string
  const wineId = formData.get('wine_id') as string

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) throw new Error('Kein Zugriff')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) throw new Error('Kein Keller gefunden')

  const { data: wine } = await admin
    .from('wines').select('id').eq('id', wineId).eq('cellar_id', cellar.id).maybeSingle()
  if (!wine) throw new Error('Wein nicht gefunden')

  const qty = parseInt(formData.get('quantity') as string)
  const vintageRaw = formData.get('vintage') as string
  const vintage = vintageRaw ? parseInt(vintageRaw) : null

  await admin.from('skus').update({
    vintage,
    quantity: qty,
    status: qty <= 0 ? 'consumed' : 'in_stock',
    storage_location_id: (formData.get('storage_location_id') as string) || null,
    shelf_location: (formData.get('shelf_location') as string) || null,
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
  }).eq('id', id).eq('wine_id', wineId)

  redirect(`/wine/${wineId}`)
}

export async function clearSkuPhoto(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const skuId = formData.get('entry_id') as string
  const wineId = formData.get('wine_id') as string

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) throw new Error('Kein Zugriff')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) throw new Error('Kein Keller')

  const { data: wine } = await admin
    .from('wines').select('id').eq('id', wineId).eq('cellar_id', cellar.id).maybeSingle()
  if (!wine) throw new Error('Wein nicht gefunden')

  await admin.from('skus')
    .update({ photo_url: null })
    .eq('id', skuId)
    .eq('wine_id', wineId)

  redirect(`/wine/${wineId}`)
}

export async function addSku(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const wineId = formData.get('wine_id') as string

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) throw new Error('Kein Zugriff')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) throw new Error('Kein Keller gefunden')

  const { data: wine } = await admin
    .from('wines').select('id').eq('id', wineId).eq('cellar_id', cellar.id).maybeSingle()
  if (!wine) throw new Error('Wein nicht gefunden')

  const vintageRaw = formData.get('vintage') as string
  const vintage = vintageRaw ? parseInt(vintageRaw) : null
  const quantity = parseInt(formData.get('quantity') as string)

  await admin.from('skus').insert({
    wine_id: wineId,
    vintage,
    quantity,
    status: 'in_stock',
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
    storage_location_id: (formData.get('storage_location_id') as string) || null,
  })

  redirect(`/wine/${wineId}`)
}
```

- [ ] **Step 3: Delete `lib/actions/entries.ts`**

```bash
rm lib/actions/entries.ts
```

- [ ] **Step 4: Update `lib/actions/tasting.ts`**

Replace `.from('cellar_entries')` with `.from('skus')` (two occurrences):

```ts
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function openBottle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const cellarEntryId = formData.get('cellar_entry_id') as string

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: entry } = await admin
    .from('skus')
    .select('id, quantity, wine_id, wines(cellar_id, cellars(family_id))')
    .eq('id', cellarEntryId)
    .maybeSingle()

  if (!entry) throw new Error('Entry not found')

  const entryFamilyId = (entry.wines as any)?.cellars?.family_id
  if (entryFamilyId !== membership.family_id) throw new Error('Unauthorized')

  const { error: tastingError } = await admin.from('tastings').insert({
    cellar_entry_id: cellarEntryId,
    user_id: user.id,
    date: formData.get('date') as string,
    rating: parseInt(formData.get('rating') as string),
    notes: (formData.get('notes') as string) || null,
  })

  if (tastingError) throw new Error(tastingError.message)

  const newQuantity = entry.quantity - 1
  await admin
    .from('skus')
    .update({ quantity: newQuantity, status: newQuantity <= 0 ? 'consumed' : 'in_stock' })
    .eq('id', cellarEntryId)

  redirect(`/wine/${entry.wine_id}`)
}
```

- [ ] **Step 5: Update `lib/actions/wine.ts`**

Two changes: (a) remove `vintage` from wines insert in `createWine`, add it to the skus insert; (b) remove `vintage` from `updateWine`.

In `createWine`, find the wines insert and remove `vintage`:
```ts
// Remove this line from the wines .insert({...}):
vintage: formData.get('vintage') ? parseInt(formData.get('vintage') as string) : null,
```

Then in the same function, add `vintage` to the cellar_entries → skus insert:
```ts
await admin.from('skus').insert({
  wine_id: wine.id,
  vintage: formData.get('vintage') ? parseInt(formData.get('vintage') as string) : null,
  quantity: parseInt((formData.get('quantity') as string) ?? '1'),
  purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
  purchase_date: (formData.get('purchase_date') as string) || null,
  purchase_location: (formData.get('purchase_location') as string) || null,
  shelf_location: (formData.get('shelf_location') as string) || null,
  storage_location_id: (formData.get('storage_location_id') as string) || null,
  trip_id: tripId,
  photo_url,
  status: 'in_stock',
})
```

Also rename `.from('cellar_entries')` → `.from('skus')` in the insert call.

In `updateWine`, remove the `vintage` line from the update:
```ts
await admin.from('wines').update({
  name: formData.get('name') as string,
  producer: formData.get('producer') as string,
  // vintage removed — now lives on skus
  type: formData.get('type') as WineType,
  region: (formData.get('region') as string) || null,
  country: (formData.get('country') as string) || null,
  grape_variety: (formData.get('grape_variety') as string) || null,
  notes: (formData.get('notes') as string) || null,
}).eq('id', id).eq('cellar_id', cellar.id)
```

- [ ] **Step 6: Update `lib/actions/demo.ts`**

Replace all `.from('cellar_entries')` with `.from('skus')`:
```bash
sed -i '' "s/\.from('cellar_entries')/\.from('skus')/g" lib/actions/demo.ts
sed -i '' 's/\.from("cellar_entries")/\.from("skus")/g' lib/actions/demo.ts
```

- [ ] **Step 7: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: TypeScript errors only from files that still reference `CellarEntry` or `entry-card` — those are fixed in Task 3. If there are unexpected errors, fix them before proceeding.

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts lib/actions/skus.ts lib/actions/tasting.ts lib/actions/wine.ts lib/actions/demo.ts
git rm lib/actions/entries.ts
git commit -m "feat: rename CellarEntry → Sku, update all actions to use skus table"
```

---

### Task 3: SkuCard + photo-gallery + wine-edit-sheet

**Files:**
- Create: `app/wine/[id]/sku-card.tsx`
- Delete: `app/wine/[id]/entry-card.tsx`
- Modify: `app/wine/[id]/photo-gallery.tsx`
- Modify: `app/wine/[id]/wine-edit-sheet.tsx`

**Interfaces:**
- Consumes: `updateSku`, `clearSkuPhoto` from `@/lib/actions/skus` (Task 2); `Sku` type from `@/lib/types` (Task 2)
- Produces: `SkuCard({ sku, storageLocations })` and `SkuWithLocation` type — used by wine detail page in Task 5

```ts
type SkuWithLocation = {
  id: string
  wine_id: string
  vintage: number | null
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  storage_location_id: string | null
  storage_locations: { name: string; type: string } | null
}
```

- [ ] **Step 1: Create `app/wine/[id]/sku-card.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateSku } from '@/lib/actions/skus'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'

type StorageLocation = { id: string; name: string }

export type SkuWithLocation = {
  id: string
  wine_id: string
  vintage: number | null
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  storage_location_id: string | null
  storage_locations: { name: string; type: string } | null
}

export function SkuCard({
  sku,
  storageLocations,
}: {
  sku: SkuWithLocation
  storageLocations: StorageLocation[]
}) {
  const [open, setOpen] = useState(false)
  const [locId, setLocId] = useState(sku.storage_location_id ?? '')
  const [purchaseDate, setPurchaseDate] = useState<string | null>(sku.purchase_date ?? null)
  const [vintage, setVintage] = useState<number | null>(sku.vintage)
  const { run, isPending, error } = useServerAction(updateSku)

  const locName = sku.storage_locations?.name

  return (
    <div
      className="relative rounded-xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-full"
        style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        aria-label="Posten bearbeiten"
      >
        <Pencil className="h-3 w-3" />
      </button>

      {sku.vintage && (
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: 2,
          }}
        >
          {sku.vintage}
        </p>
      )}

      <div className="flex items-baseline gap-1.5 mb-1">
        <span
          className="nums leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            color: 'var(--primary)',
          }}
        >
          {sku.quantity}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {sku.quantity === 1 ? 'Flasche' : 'Flaschen'}
        </span>
      </div>

      {(locName || sku.shelf_location) && (
        <p className="text-sm" style={{ color: 'var(--ink-700)' }}>
          {[locName, sku.shelf_location].filter(Boolean).join(' · ')}
        </p>
      )}

      {(sku.purchase_date || sku.purchase_price != null || sku.purchase_location) && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
          {[
            sku.purchase_date
              ? new Date(sku.purchase_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
              : null,
            sku.purchase_price != null
              ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(sku.purchase_price)
              : null,
            sku.purchase_location,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Posten bearbeiten</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
            className="space-y-4 mt-4"
          >
            <input type="hidden" name="id" value={sku.id} />
            <input type="hidden" name="wine_id" value={sku.wine_id} />

            <div className="space-y-2">
              <Label>Jahrgang</Label>
              <DatePicker
                mode="year"
                name="vintage"
                value={vintage}
                onChange={v => setVintage(v as number | null)}
                placeholder="Jahrgang"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Anzahl Flaschen *</Label>
              <Input id="quantity" name="quantity" type="number" min="0" max="999"
                defaultValue={sku.quantity} required />
            </div>

            {storageLocations.length > 0 && (
              <div className="space-y-2">
                <Label>Lagerort</Label>
                <input type="hidden" name="storage_location_id" value={locId} />
                <Select
                  value={locId}
                  onValueChange={v => setLocId(v ?? '')}
                  items={[
                    { value: '', label: 'Kein Lagerort' },
                    ...storageLocations.map(loc => ({ value: loc.id, label: loc.name })),
                  ]}
                >
                  <SelectTrigger><SelectValue placeholder="Kein Lagerort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Kein Lagerort</SelectItem>
                    {storageLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="shelf_location">Reihe / Fach</Label>
              <Input id="shelf_location" name="shelf_location"
                defaultValue={sku.shelf_location ?? ''} placeholder="z.B. Reihe 3" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Preis (€)</Label>
                <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0"
                  defaultValue={sku.purchase_price ?? ''} />
              </div>
              <div className="space-y-2">
                <Label>Kaufdatum</Label>
                <DatePicker
                  mode="full"
                  name="purchase_date"
                  value={purchaseDate}
                  onChange={v => setPurchaseDate(v as string | null)}
                  placeholder="Kaufdatum"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_location">Kaufort</Label>
              <Input id="purchase_location" name="purchase_location"
                defaultValue={sku.purchase_location ?? ''} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: Delete `app/wine/[id]/entry-card.tsx`**

```bash
rm app/wine/\[id\]/entry-card.tsx
```

- [ ] **Step 3: Update `app/wine/[id]/photo-gallery.tsx`**

Change the import from `entries` to `skus`:

```ts
// Find:
import { clearEntryPhoto } from '@/lib/actions/entries'

// Replace with:
import { clearSkuPhoto } from '@/lib/actions/skus'
```

Also update the usage — find `clearEntryPhoto` and replace with `clearSkuPhoto`:
```ts
// Find:
const { run: runClearLegacy, isPending: clearPending } = useServerAction(clearEntryPhoto)

// Replace with:
const { run: runClearLegacy, isPending: clearPending } = useServerAction(clearSkuPhoto)
```

- [ ] **Step 4: Update `app/wine/[id]/wine-edit-sheet.tsx`**

Remove the `vintage` field entirely — vintage is now per-sku, not per-wine.

Remove:
- The `vintage` state: `const [vintage, setVintage] = useState<number | null>(wine.vintage ?? null)`
- The vintage `DatePicker` JSX block (find the `<div className="space-y-2">` containing `name="vintage"` and delete the whole block)

- [ ] **Step 5: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Generating static pages` — no TypeScript errors about `CellarEntry` or `entries.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/wine/\[id\]/sku-card.tsx app/wine/\[id\]/photo-gallery.tsx app/wine/\[id\]/wine-edit-sheet.tsx
git rm app/wine/\[id\]/entry-card.tsx
git commit -m "feat: rename EntryCard → SkuCard, add vintage field, remove vintage from wine-edit-sheet"
```

---

### Task 4: WineCard + cellar page

**Files:**
- Modify: `components/cellar/wine-card.tsx`
- Modify: `app/cellar/page.tsx`

**Interfaces:**
- Consumes: `Sku` type from `@/lib/types` (Task 2)
- Produces: `WineCard({ wine, skus, vintage })` — `vintage: number | null` computed by page

- [ ] **Step 1: Update `components/cellar/wine-card.tsx`**

```tsx
import Link from 'next/link'
import type { Wine, Sku } from '@/lib/types'

const TYPE_CONFIG = {
  red:      { bg: 'var(--type-red-bg)',       fg: 'var(--type-red-fg)',       dot: '#7c2d12', label: 'Rotwein' },
  white:    { bg: 'var(--type-white-bg)',      fg: 'var(--type-white-fg)',     dot: '#c9a227', label: 'Weißwein' },
  'rosé':   { bg: 'var(--type-rose-bg)',       fg: 'var(--type-rose-fg)',      dot: '#c98a8f', label: 'Rosé' },
  sparkling:{ bg: 'var(--type-sparkling-bg)',  fg: 'var(--type-sparkling-fg)', dot: '#5f8aac', label: 'Schaumwein' },
} as const

interface WineCardProps {
  wine: Wine
  skus: Pick<Sku, 'quantity' | 'photo_url'>[]
  vintage: number | null
}

export function WineCard({ wine, skus, vintage }: WineCardProps) {
  const totalBottles = skus.reduce((sum, e) => sum + e.quantity, 0)
  const photo = skus.find(e => e.photo_url)?.photo_url
  const type = TYPE_CONFIG[wine.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.red
```

Then find `{wine.vintage && (` (around line 66) and replace with `{vintage && (`.

Also find `{'  '}{wine.vintage}` and replace with `{'  '}{vintage}`.

- [ ] **Step 2: Update `app/cellar/page.tsx`**

**Query change** — find:
```ts
.select('*, cellar_entries(quantity, photo_url, status, storage_location_id)')
```
Replace with:
```ts
.select('*, skus(id, vintage, quantity, photo_url, status, storage_location_id)')
```

**Filter change** — find the `rawWines?.map(...)` block:
```ts
const wines = rawWines
  ?.map(w => ({
    ...w,
    cellar_entries: (w.cellar_entries as any[]).filter(
      e => e.status === 'in_stock' && e.quantity > 0 &&
           (!location || e.storage_location_id === location)
    ),
  }))
  .filter(w => w.cellar_entries.length > 0) ?? []
```
Replace with:
```ts
const wines = rawWines
  ?.map(w => ({
    ...w,
    skus: (w.skus as any[]).filter(
      e => e.status === 'in_stock' && e.quantity > 0 &&
           (!location || e.storage_location_id === location)
    ),
  }))
  .filter(w => w.skus.length > 0) ?? []
```

**WineCard render** — find:
```tsx
<WineCard key={wine.id} wine={wine} entries={wine.cellar_entries} />
```
Replace with:
```tsx
{(() => {
  const latestVintage = (wine.skus as any[])
    .filter((s: any) => s.vintage != null)
    .sort((a: any, b: any) => (b.vintage ?? 0) - (a.vintage ?? 0))[0]?.vintage ?? null
  return <WineCard key={wine.id} wine={wine} skus={wine.skus} vintage={latestVintage} />
})()}
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add components/cellar/wine-card.tsx app/cellar/page.tsx
git commit -m "feat: update WineCard + cellar page to use skus, compute vintage per card"
```

---

### Task 5: Wine detail page + AddSkuSheet

**Files:**
- Modify: `app/wine/[id]/page.tsx`
- Create: `app/wine/[id]/add-sku-sheet.tsx`

**Interfaces:**
- Consumes: `SkuCard`, `SkuWithLocation` from `app/wine/[id]/sku-card.tsx` (Task 3); `addSku` from `@/lib/actions/skus` (Task 2)
- Produces: Complete wine detail page with "Posten hinzufügen" button

- [ ] **Step 1: Create `app/wine/[id]/add-sku-sheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { addSku } from '@/lib/actions/skus'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Plus } from 'lucide-react'

type StorageLocation = { id: string; name: string }

export function AddSkuSheet({
  wineId,
  storageLocations,
}: {
  wineId: string
  storageLocations: StorageLocation[]
}) {
  const [open, setOpen] = useState(false)
  const [vintage, setVintage] = useState<number | null>(null)
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null)
  const [locId, setLocId] = useState('')
  const { run, isPending, error } = useServerAction(addSku)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />
        Posten
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Posten hinzufügen</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <input type="hidden" name="wine_id" value={wineId} />

          <div className="space-y-2">
            <Label>Jahrgang</Label>
            <DatePicker
              mode="year"
              name="vintage"
              value={vintage}
              onChange={v => setVintage(v as number | null)}
              placeholder="Jahrgang"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Anzahl Flaschen *</Label>
            <Input id="quantity" name="quantity" type="number" min="1" max="999" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Preis (€)</Label>
              <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-2">
              <Label>Kaufdatum</Label>
              <DatePicker
                mode="full"
                name="purchase_date"
                value={purchaseDate}
                onChange={v => setPurchaseDate(v as string | null)}
                placeholder="Kaufdatum"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_location">Kaufort</Label>
            <Input id="purchase_location" name="purchase_location" />
          </div>

          {storageLocations.length > 0 && (
            <div className="space-y-2">
              <Label>Lagerort</Label>
              <input type="hidden" name="storage_location_id" value={locId} />
              <Select
                value={locId}
                onValueChange={v => setLocId(v ?? '')}
                items={[
                  { value: '', label: 'Kein Lagerort' },
                  ...storageLocations.map(loc => ({ value: loc.id, label: loc.name })),
                ]}
              >
                <SelectTrigger><SelectValue placeholder="Kein Lagerort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Lagerort</SelectItem>
                  {storageLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Posten speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Update `app/wine/[id]/page.tsx`**

**Import changes** — at the top:
```tsx
// Remove:
import { EntryCard } from './entry-card'

// Add:
import { SkuCard } from './sku-card'
import { AddSkuSheet } from './add-sku-sheet'
```

**Query changes** — find:
```ts
const { data: entries } = await admin
  .from('cellar_entries')
  .select('*, storage_locations(name, type)')
  .eq('wine_id', id)
  .order('created_at', { ascending: false })

const entryIds = (entries ?? []).map(e => e.id)
const { data: tastings } = entryIds.length
  ? await admin.from('tastings').select('*').in('cellar_entry_id', entryIds).order('date', { ascending: false })
  : { data: [] }

const inStockEntries = (entries ?? []).filter(e => e.status === 'in_stock')
const totalBottles = inStockEntries.reduce((sum, e) => sum + e.quantity, 0)
const legacyEntry = (entries ?? []).find(e => e.photo_url) ?? null
const legacyPhoto = legacyEntry?.photo_url ?? null
const legacyEntryId = legacyEntry?.id ?? null
```

Replace with:
```ts
const { data: skus } = await admin
  .from('skus')
  .select('*, storage_locations(name, type)')
  .eq('wine_id', id)
  .order('created_at', { ascending: false })

const skuIds = (skus ?? []).map(e => e.id)
const { data: tastings } = skuIds.length
  ? await admin.from('tastings').select('*').in('cellar_entry_id', skuIds).order('date', { ascending: false })
  : { data: [] }

const inStockSkus = (skus ?? []).filter(e => e.status === 'in_stock')
const totalBottles = inStockSkus.reduce((sum, e) => sum + e.quantity, 0)
const legacySku = (skus ?? []).find(e => e.photo_url) ?? null
const legacyPhoto = legacySku?.photo_url ?? null
const legacyEntryId = legacySku?.id ?? null
```

**inStockEntries references in JSX** — find all `inStockEntries` and replace with `inStockSkus`.

**SkuCard render** — find the section that maps `entries` (search for `<EntryCard`):
```tsx
// Find:
{(entries ?? []).map(entry => (
  <EntryCard key={entry.id} entry={entry} storageLocations={storageLocations} />
))}

// Replace with:
{(skus ?? []).map(sku => (
  <SkuCard key={sku.id} sku={sku} storageLocations={storageLocations} />
))}
```

**AddSkuSheet button** — find the `<OpenBottleButton>` render (around the action buttons section) and add `<AddSkuSheet>` next to it:
```tsx
<div className="flex gap-2">
  <div className="flex-1">
    <OpenBottleButton entryId={inStockSkus[0].id} />
  </div>
  <AddSkuSheet wineId={wine.id} storageLocations={storageLocations} />
</div>
```

Note: The `<OpenBottleButton>` is inside a conditional `{inStockSkus.length > 0 && (...)}` — keep that condition but wrap both buttons. Place `<AddSkuSheet>` outside the condition (always visible) or adjust the layout to always show it.

Final button layout — find the existing `<OpenBottleButton>` conditional block and replace:
```tsx
<div className="flex gap-2 mt-2">
  {inStockSkus.length > 0 && (
    <div className="flex-1">
      <OpenBottleButton entryId={inStockSkus[0].id} />
    </div>
  )}
  <AddSkuSheet wineId={wine.id} storageLocations={storageLocations} />
</div>
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add app/wine/\[id\]/add-sku-sheet.tsx app/wine/\[id\]/page.tsx
git commit -m "feat: add AddSkuSheet to wine detail page, wire up Posten hinzufügen"
```
