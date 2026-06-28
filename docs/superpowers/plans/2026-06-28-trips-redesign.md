# Trips Redesign v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic shadcn-Card trips list with an editorial design-system layout, move the new-trip trigger to a header `+` button, and add a trip detail page with wines and stats.

**Architecture:** Three tasks: (1) `TripCard` presentational component + tests, (2) refactor trips list page to use TripCard and header `+` button, (3) new `app/trips/[id]/page.tsx` detail page with parallel data fetching, stats computation, and reused `WineCard` + `StatsCard`.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase admin client, Vitest + React Testing Library, CSS custom properties design system.

## Global Constraints

- No hardcoded hex or Tailwind color classes — all visual tokens via `var(--...)`
- Display font: `var(--font-display)` (Cormorant Garamond)
- Mono font: `var(--font-mono)` (DM Mono)
- `eyebrow` class for labels (defined in `app/globals.css`)
- `wine-card-hover` class for hover transitions (defined in `app/globals.css`)
- Cards: `background: var(--card)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`
- Run tests: `npx vitest run`
- Run build: `npm run build`
- Test pattern: see `lib/__tests__/wine-card.test.tsx` and `lib/__tests__/stats-card.test.tsx`

---

### Task 1: TripCard component

**Files:**
- Create: `components/trips/trip-card.tsx`
- Create: `lib/__tests__/trip-card.test.tsx`

**Interfaces:**
- Produces: `TripCard({ trip, wineCount })` — imported by `app/trips/page.tsx` in Task 2

```ts
// Exact prop type produced by this task
type TripCardTrip = {
  id: string
  name: string
  location: string | null
  date_start: string | null  // ISO e.g. "2024-05-12"
  date_end: string | null    // ISO e.g. "2024-05-18"
}
```

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/trip-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripCard } from '@/components/trips/trip-card'

const baseTrip = {
  id: 'trip-1',
  name: 'Weinreise Toskana',
  location: 'Toskana, Italien',
  date_start: '2024-05-12',
  date_end: '2024-05-18',
}

describe('TripCard', () => {
  it('renders the trip name', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('Weinreise Toskana')).toBeInTheDocument()
  })

  it('renders the location', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('Toskana, Italien')).toBeInTheDocument()
  })

  it('renders the wine count', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders formatted date range', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('12.05.2024 → 18.05.2024')).toBeInTheDocument()
  })

  it('renders only start date when end is null', () => {
    render(<TripCard trip={{ ...baseTrip, date_end: null }} wineCount={3} />)
    expect(screen.getByText('12.05.2024')).toBeInTheDocument()
  })

  it('renders no date when both are null', () => {
    render(<TripCard trip={{ ...baseTrip, date_start: null, date_end: null }} wineCount={2} />)
    expect(screen.queryByText(/\d{2}\.\d{2}\.\d{4}/)).not.toBeInTheDocument()
  })

  it('renders no location when null', () => {
    render(<TripCard trip={{ ...baseTrip, location: null }} wineCount={1} />)
    expect(screen.queryByText('Toskana, Italien')).not.toBeInTheDocument()
  })

  it('links to the trip detail page', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/trips/trip-1')
  })

  it('renders "Weine" label', () => {
    render(<TripCard trip={baseTrip} wineCount={5} />)
    expect(screen.getByText('Weine')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/trip-card.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/trips/trip-card'`

- [ ] **Step 3: Implement TripCard**

Create `components/trips/trip-card.tsx`:

```tsx
import Link from 'next/link'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

type TripCardTrip = {
  id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
}

export function TripCard({ trip, wineCount }: { trip: TripCardTrip; wineCount: number }) {
  const dateLabel = trip.date_start
    ? trip.date_end
      ? `${formatDate(trip.date_start)} → ${formatDate(trip.date_end)}`
      : formatDate(trip.date_start)
    : null

  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <div
        className="flex gap-4 p-4 wine-card-hover"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Info block */}
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          {trip.location && (
            <span className="eyebrow truncate">{trip.location}</span>
          )}
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            color: 'var(--foreground)',
          }}>
            {trip.name}
          </span>
          {dateLabel && (
            <span className="mono" style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--muted-foreground)',
            }}>
              {dateLabel}
            </span>
          )}
        </div>

        {/* Wine count block */}
        <div className="flex-none flex flex-col items-end justify-center gap-0.5 pl-1">
          <span
            className="nums"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              lineHeight: 1,
              color: wineCount > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
            }}
          >
            {wineCount}
          </span>
          <span className="eyebrow">Weine</span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/trip-card.test.tsx
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/trips/trip-card.tsx lib/__tests__/trip-card.test.tsx
git commit -m "feat: add TripCard component"
```

---

### Task 2: Refactor trips list page

**Files:**
- Modify: `app/trips/page.tsx`
- Modify: `app/trips/new-trip-form.tsx` — update trigger to small `+` icon button (keep file name)

**Interfaces:**
- Consumes: `TripCard` from `@/components/trips/trip-card` (Task 1)
- Consumes: `NewTripForm` from `./new-trip-form` (existing, trigger style updated)

- [ ] **Step 1: Update new-trip-form.tsx trigger style**

Change the `SheetTrigger` from a full-width button to a small icon button matching the Keller `+` button. Replace the content of `app/trips/new-trip-form.tsx`:

```tsx
'use client'

import { createTrip } from '@/lib/actions/trips'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'

export function NewTripForm() {
  const [open, setOpen] = useState(false)
  const [dateStart, setDateStart] = useState<string | null>(null)
  const [dateEnd, setDateEnd] = useState<string | null>(null)
  const { run, isPending, error } = useServerAction(createTrip)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />Hinzufügen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader><SheetTitle>Neue Reise</SheetTitle></SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" placeholder="Toskana Sommer 2026" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Ort</Label>
            <Input id="location" name="location" placeholder="Toskana, Italien" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Beginn</Label>
              <DatePicker
                mode="full"
                name="date_start"
                value={dateStart}
                onChange={v => setDateStart(v as string | null)}
                placeholder="Beginn"
              />
            </div>
            <div className="space-y-2">
              <Label>Ende</Label>
              <DatePicker
                mode="full"
                name="date_end"
                value={dateEnd}
                onChange={v => setDateEnd(v as string | null)}
                placeholder="Ende"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Reise anlegen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Rewrite trips list page**

Replace `app/trips/page.tsx` entirely:

```tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TripCard } from '@/components/trips/trip-card'
import { NewTripForm } from './new-trip-form'

export default async function TripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
        .select('id, name, location, date_start, date_end, wines(id)')
        .eq('cellar_id', cellar.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          lineHeight: 'var(--leading-snug)',
          color: 'var(--foreground)',
          margin: 0,
        }}>
          Reisen
        </h1>
        <NewTripForm />
      </div>

      {trips && trips.length > 0 ? (
        <div className="space-y-2">
          {trips.map(trip => (
            <TripCard
              key={trip.id}
              trip={{
                id: trip.id,
                name: trip.name,
                location: trip.location,
                date_start: trip.date_start,
                date_end: trip.date_end,
              }}
              wineCount={(trip.wines as any[])?.length ?? 0}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
          <LocationPinGlyph />
          <p className="mt-3">Noch keine Reisen — Andiamo!</p>
        </div>
      )}
    </div>
  )
}

function LocationPinGlyph() {
  return (
    <svg
      width="32" height="40" viewBox="0 0 24 32" fill="none"
      stroke="var(--clay)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ opacity: 0.5, margin: '0 auto', display: 'block' }}
    >
      <path d="M12 2a7 7 0 0 1 7 7c0 4.5-7 13-7 13S5 13.5 5 9a7 7 0 0 1 7-7Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/trips/page.tsx app/trips/new-trip-form.tsx
git commit -m "feat: redesign trips list page with TripCard and header + button"
```

---

### Task 3: Trip detail page

**Files:**
- Create: `app/trips/[id]/page.tsx`
- Create: `app/trips/[id]/loading.tsx`

**Interfaces:**
- Consumes:
  - `WineCard` from `@/components/cellar/wine-card` (existing)
  - `StatsCard` from `@/components/dashboard/stats-card` (existing)

- [ ] **Step 1: Create loading skeleton**

Create `app/trips/[id]/loading.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <Skeleton className="h-5 w-20" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create trip detail page**

Create `app/trips/[id]/page.tsx`:

```tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { WineCard } from '@/components/cellar/wine-card'
import { StatsCard } from '@/components/dashboard/stats-card'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  // Schritt 1: parallel — trip + wines with entries
  const [tripResult, winesResult] = await Promise.all([
    admin
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('cellar_id', cellar.id)
      .maybeSingle(),
    admin
      .from('wines')
      .select('*, cellar_entries(id, quantity, photo_url, status, storage_location_id, purchase_price)')
      .eq('trip_id', id)
      .eq('cellar_id', cellar.id)
      .order('name'),
  ])

  const trip = tripResult.data
  if (!trip) notFound()

  const wines = winesResult.data ?? []

  // Schritt 2: tastings benötigen entry IDs
  const entryIds = wines.flatMap(w => (w.cellar_entries as any[]).map((e: any) => e.id))
  const { data: tastings } = entryIds.length
    ? await admin.from('tastings').select('rating').in('cellar_entry_id', entryIds)
    : { data: [] as { rating: number }[] }

  // Stats
  const allEntries = wines.flatMap(w => w.cellar_entries as any[])
  const inStockEntries = allEntries.filter(e => e.status === 'in_stock')
  const totalBottles = inStockEntries.reduce((s: number, e: any) => s + e.quantity, 0)

  const ratings = (tastings ?? []).map(t => t.rating)
  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
    : null

  const prices = allEntries
    .map((e: any) => e.purchase_price)
    .filter((p: unknown): p is number => typeof p === 'number')
  const totalSpend = prices.length ? prices.reduce((s, p) => s + p, 0) : null

  // WineCard entries: only in_stock with quantity > 0
  const winesForCard = wines.map(w => ({
    ...w,
    cellar_entries: (w.cellar_entries as any[]).filter(
      e => e.status === 'in_stock' && e.quantity > 0
    ),
  }))

  const dateLabel = trip.date_start
    ? trip.date_end
      ? `${formatDate(trip.date_start)} → ${formatDate(trip.date_end)}`
      : formatDate(trip.date_start)
    : null

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Back link */}
      <Link
        href="/trips"
        className="inline-flex items-center gap-0.5 text-sm font-medium"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ChevronLeft className="h-4 w-4 -ml-0.5" />
        Reisen
      </Link>

      {/* Header */}
      <div>
        {trip.location && (
          <p className="eyebrow mb-1">{trip.location}</p>
        )}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          lineHeight: 'var(--leading-snug)',
          color: 'var(--foreground)',
          margin: 0,
        }}>
          {trip.name}
        </h1>
        {dateLabel && (
          <p className="mono mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' }}>
            {dateLabel}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className={`grid gap-3 ${totalSpend !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <StatsCard title="Flaschen" value={totalBottles} />
        <StatsCard title="Ø Bewertung" value={avgRating ?? '—'} />
        {totalSpend !== null && (
          <StatsCard
            title="Ausgaben"
            value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalSpend)}
          />
        )}
      </div>

      {/* Wine list */}
      <section>
        <p className="eyebrow mb-3">Weine ({wines.length})</p>
        {wines.length > 0 ? (
          <div className="space-y-2">
            {winesForCard.map(wine => (
              <WineCard key={wine.id} wine={wine} entries={wine.cellar_entries} />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)' }}>
            Noch keine Weine auf dieser Reise.
          </p>
        )}
      </section>

      <div className="h-2" />
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add app/trips/[id]/page.tsx app/trips/[id]/loading.tsx
git commit -m "feat: add trip detail page with wines and stats"
```
