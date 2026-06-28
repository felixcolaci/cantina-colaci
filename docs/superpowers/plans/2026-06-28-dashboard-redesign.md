# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic stats dashboard with a mood-setting entry screen: the most recently added wine as a visual gradient hero card, followed by two stats and up to three recent tastings.

**Architecture:** Three focused components (`WineHeroCard`, `TastingCard`, existing `StatsCard`) compose the page. `TastingCard` is extracted from the existing history page to keep both pages in sync. The page stays a pure server component — no client state added.

**Tech Stack:** Next.js App Router (server components), React, TypeScript, Supabase admin client, Vitest + React Testing Library, CSS custom properties design system.

## Global Constraints

- No `'use client'` on `app/page.tsx` — stays a server component
- All visual tokens via CSS custom properties (`var(--...)`) — no hardcoded hex or Tailwind color classes
- Display font: `var(--font-display)` (Cormorant Garamond)
- Mono font: `var(--font-mono)` (DM Mono)
- Badge dot colors: red `#7c2d12`, white `#c9a227`, rosé `#c98a8f`, sparkling `#5f8aac`
- Gradient config identical to `app/wine/[id]/page.tsx` TYPE_CONFIG
- Tests use Vitest + `@testing-library/react` — see `lib/__tests__/stats-card.test.tsx` for pattern
- Run tests with: `npx vitest run`
- Run build with: `npm run build`

---

### Task 1: WineHeroCard component

**Files:**
- Create: `components/dashboard/wine-hero-card.tsx`
- Create: `lib/__tests__/wine-hero-card.test.tsx`

**Interfaces:**
- Produces: `WineHeroCard({ wine: WineHeroProps })` — imported by `app/page.tsx` in Task 4

```ts
// Type produced by this task (used in Task 4)
type WineHeroProps = {
  id: string
  name: string
  producer: string | null
  vintage: number | null
  type: 'red' | 'white' | 'rosé' | 'sparkling'
}
```

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/wine-hero-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WineHeroCard } from '@/components/dashboard/wine-hero-card'

const baseWine = {
  id: 'w1',
  name: 'Barolo',
  producer: 'Gaja',
  vintage: 2019,
  type: 'red' as const,
}

describe('WineHeroCard', () => {
  it('renders the wine name', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders the producer', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('Gaja')).toBeInTheDocument()
  })

  it('renders the vintage', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('2019')).toBeInTheDocument()
  })

  it('renders the type badge label', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByText('Rotwein')).toBeInTheDocument()
  })

  it('renders Weißwein for white wine', () => {
    render(<WineHeroCard wine={{ ...baseWine, type: 'white' }} />)
    expect(screen.getByText('Weißwein')).toBeInTheDocument()
  })

  it('links to the wine detail page', () => {
    render(<WineHeroCard wine={baseWine} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/wine/w1')
  })

  it('renders without producer gracefully', () => {
    render(<WineHeroCard wine={{ ...baseWine, producer: null }} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders without vintage gracefully', () => {
    render(<WineHeroCard wine={{ ...baseWine, vintage: null }} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/wine-hero-card.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/dashboard/wine-hero-card'`

- [ ] **Step 3: Implement WineHeroCard**

Create `components/dashboard/wine-hero-card.tsx`:

```tsx
import Link from 'next/link'

type WineHeroProps = {
  id: string
  name: string
  producer: string | null
  vintage: number | null
  type: 'red' | 'white' | 'rosé' | 'sparkling'
}

const TYPE_CONFIG = {
  red: {
    label: 'Rotwein',
    dot: '#7c2d12',
    bg: 'var(--type-red-bg)',
    fg: 'var(--type-red-fg)',
    hero: 'linear-gradient(160deg, #5b1e22 0%, #3d1417 55%, #2d1008 100%)',
  },
  white: {
    label: 'Weißwein',
    dot: '#c9a227',
    bg: 'var(--type-white-bg)',
    fg: 'var(--type-white-fg)',
    hero: 'linear-gradient(160deg, #9a7611 0%, #6b520d 55%, #4a3908 100%)',
  },
  rosé: {
    label: 'Rosé',
    dot: '#c98a8f',
    bg: 'var(--type-rose-bg)',
    fg: 'var(--type-rose-fg)',
    hero: 'linear-gradient(160deg, #b06a72 0%, #7a3a40 55%, #3a1417 100%)',
  },
  sparkling: {
    label: 'Schaumwein',
    dot: '#5f8aac',
    bg: 'var(--type-sparkling-bg)',
    fg: 'var(--type-sparkling-fg)',
    hero: 'linear-gradient(160deg, #4f7390 0%, #2d4d64 55%, #1a2d3d 100%)',
  },
} as const

export function WineHeroCard({ wine }: { wine: WineHeroProps }) {
  const conf = TYPE_CONFIG[wine.type] ?? TYPE_CONFIG.red

  return (
    <Link
      href={`/wine/${wine.id}`}
      className="block relative overflow-hidden"
      style={{
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        minHeight: 180,
        background: conf.hero,
      }}
    >
      {/* Text overlay gradient */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)',
        }}
      />

      {/* Type badge — top right */}
      <div
        className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1"
        style={{
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)',
          borderRadius: 'var(--radius-full)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.9)',
          lineHeight: 1,
          height: 25,
        }}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: conf.dot, flexShrink: 0,
          }}
        />
        {conf.label}
      </div>

      {/* Content — bottom left */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        {wine.producer && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)',
            marginBottom: 3,
          }}>
            {wine.producer}
          </p>
        )}
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.05,
          letterSpacing: 'var(--tracking-tight)',
          margin: 0,
        }}>
          {wine.name}
          {wine.vintage && (
            <span style={{ fontStyle: 'italic', fontWeight: 500, opacity: 0.75, fontSize: '0.8em' }}>
              {' '}{wine.vintage}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/wine-hero-card.test.tsx
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/wine-hero-card.tsx lib/__tests__/wine-hero-card.test.tsx
git commit -m "feat: add WineHeroCard component for dashboard hero"
```

---

### Task 2: TastingCard component

**Files:**
- Create: `components/dashboard/tasting-card.tsx`
- Create: `lib/__tests__/tasting-card.test.tsx`

**Interfaces:**
- Produces: `TastingCard({ tasting, wine })` — used by `app/history/page.tsx` (Task 3) and `app/page.tsx` (Task 4)

```ts
// Types produced by this task
type TastingCardTasting = {
  id: string
  date: string       // ISO date string e.g. "2024-03-15"
  rating: number
  notes: string | null
}
type TastingCardWine = {
  name: string
  producer: string | null
  vintage: number | null
}
```

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/tasting-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TastingCard } from '@/components/dashboard/tasting-card'

const baseTasting = {
  id: 't1',
  date: '2024-03-15',
  rating: 9,
  notes: 'Sehr elegant, langer Abgang.',
}

const baseWine = {
  name: 'Barolo',
  producer: 'Gaja',
  vintage: 2019,
}

describe('TastingCard', () => {
  it('renders the wine name', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders the producer', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('Gaja')).toBeInTheDocument()
  })

  it('renders the rating', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('renders the formatted date in German', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('15. März 2024')).toBeInTheDocument()
  })

  it('renders notes when present', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('Sehr elegant, langer Abgang.')).toBeInTheDocument()
  })

  it('renders no notes section when notes is null', () => {
    render(<TastingCard tasting={{ ...baseTasting, notes: null }} wine={baseWine} />)
    expect(screen.queryByText('Sehr elegant, langer Abgang.')).not.toBeInTheDocument()
  })

  it('renders without producer gracefully', () => {
    render(<TastingCard tasting={baseTasting} wine={{ ...baseWine, producer: null }} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders vintage inline with wine name', () => {
    render(<TastingCard tasting={baseTasting} wine={baseWine} />)
    expect(screen.getByText('2019')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/__tests__/tasting-card.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/dashboard/tasting-card'`

- [ ] **Step 3: Implement TastingCard**

Create `components/dashboard/tasting-card.tsx`:

```tsx
export type TastingCardTasting = {
  id: string
  date: string
  rating: number
  notes: string | null
}

export type TastingCardWine = {
  name: string
  producer: string | null
  vintage: number | null
}

export function TastingCard({
  tasting,
  wine,
}: {
  tasting: TastingCardTasting
  wine: TastingCardWine
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {wine.producer && (
            <p className="eyebrow truncate mb-0.5">{wine.producer}</p>
          )}
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            color: 'var(--foreground)',
          }}>
            {wine.name}
            {wine.vintage && (
              <span className="nums" style={{ color: 'var(--muted-foreground)', fontWeight: 500, fontStyle: 'italic' }}>
                {' '}{wine.vintage}
              </span>
            )}
          </p>
          <p className="mono mt-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
            {new Date(tasting.date).toLocaleDateString('de-DE', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex-none text-right">
          <span className="nums" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--primary)',
          }}>
            {tasting.rating}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>/10</span>
        </div>
      </div>

      {tasting.notes && (
        <>
          <hr className="rule-gold my-3" />
          <p style={{
            fontSize: 'var(--text-sm)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--ink-700)',
            fontStyle: 'italic',
          }}>
            {tasting.notes}
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/__tests__/tasting-card.test.tsx
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/tasting-card.tsx lib/__tests__/tasting-card.test.tsx
git commit -m "feat: add TastingCard component"
```

---

### Task 3: Refactor history page to use TastingCard

**Files:**
- Modify: `app/history/page.tsx`

**Interfaces:**
- Consumes: `TastingCard`, `TastingCardTasting`, `TastingCardWine` from `@/components/dashboard/tasting-card`

- [ ] **Step 1: Update history/page.tsx to use TastingCard**

Replace the inline card markup in `app/history/page.tsx` with `TastingCard`. The existing query already fetches `id, date, rating, notes` on `tastings` and `name, producer, vintage` on `wines` — it matches the component props exactly.

Full updated file `app/history/page.tsx`:

```tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TastingCard } from '@/components/dashboard/tasting-card'

export default async function HistoryPage() {
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

  const { data: tastings } = cellar
    ? await admin
        .from('tastings')
        .select(`
          id, date, rating, notes,
          cellar_entries!inner(
            wines!inner(name, producer, vintage, cellar_id)
          )
        `)
        .eq('cellar_entries.wines.cellar_id', cellar.id)
        .order('date', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 600,
        letterSpacing: 'var(--tracking-tight)',
        lineHeight: 'var(--leading-snug)',
        color: 'var(--foreground)',
        margin: 0,
      }}>
        Kellerchronik
      </h1>

      {tastings && tastings.length > 0 ? (
        <div className="space-y-3">
          {tastings.map(tasting => {
            const wine = (tasting.cellar_entries as any)?.wines
            if (!wine) return null
            return (
              <TastingCard
                key={tasting.id}
                tasting={{
                  id: tasting.id,
                  date: tasting.date,
                  rating: tasting.rating,
                  notes: tasting.notes,
                }}
                wine={{
                  name: wine.name,
                  producer: wine.producer ?? null,
                  vintage: wine.vintage ?? null,
                }}
              />
            )
          })}
        </div>
      ) : (
        <p className="text-center py-10" style={{ color: 'var(--muted-foreground)' }}>
          Noch keine Verkostungen — apri una bottiglia!
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/history/page.tsx
git commit -m "refactor: use TastingCard component in history page"
```

---

### Task 4: Update dashboard page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes:
  - `WineHeroCard` from `@/components/dashboard/wine-hero-card` (Task 1)
  - `TastingCard` from `@/components/dashboard/tasting-card` (Task 2)
  - `StatsCard` from `@/components/dashboard/stats-card` (existing, unchanged)

- [ ] **Step 1: Replace app/page.tsx**

Full updated `app/page.tsx`:

```tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
import { WineHeroCard } from '@/components/dashboard/wine-hero-card'
import { TastingCard } from '@/components/dashboard/tasting-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function DashboardPage() {
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

  // wines first — needed for inStock count via .in()
  const { data: wines } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  const [inStockResult, tastingsResult, latestWineResult] = await Promise.all([
    wineIds.length
      ? admin.from('cellar_entries').select('quantity').in('wine_id', wineIds).eq('status', 'in_stock')
      : Promise.resolve({ data: [] as { quantity: number }[] }),
    admin
      .from('tastings')
      .select(`
        id, date, rating, notes,
        cellar_entries!inner(
          wines!inner(name, producer, vintage, cellar_id)
        )
      `)
      .eq('cellar_entries.wines.cellar_id', cellar.id)
      .order('date', { ascending: false })
      .limit(3),
    admin
      .from('wines')
      .select('id, name, producer, vintage, type')
      .eq('cellar_id', cellar.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const wineCount = wineIds.length
  const totalBottles = (inStockResult.data ?? []).reduce((sum, e) => sum + e.quantity, 0)
  const recentTastings = tastingsResult.data ?? []
  const latestWine = latestWineResult.data

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
        <StatsCard title="Flaschen im Keller" value={totalBottles} />
        <StatsCard title="Verschiedene Weine" value={wineCount} />
      </div>

      {recentTastings.length > 0 && (
        <section>
          <p className="eyebrow mb-3">Letzte Verkostungen</p>
          <div className="space-y-3">
            {recentTastings.map(t => {
              const wine = (t.cellar_entries as any)?.wines
              if (!wine) return null
              return (
                <TastingCard
                  key={t.id}
                  tasting={{
                    id: t.id,
                    date: t.date,
                    rating: t.rating,
                    notes: t.notes,
                  }}
                  wine={{
                    name: wine.name,
                    producer: wine.producer ?? null,
                    vintage: wine.vintage ?? null,
                  }}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function BottleGlyph() {
  return (
    <svg
      width="32" height="64" viewBox="0 0 22 56" fill="none"
      stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round"
      aria-hidden="true" style={{ opacity: 0.5, margin: '0 auto', display: 'block' }}
    >
      <path d="M8 2h6v9c0 1.5 1 2.5 2 3.8 1.8 1.8 3 3.6 3 7.2v28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V22c0-3.6 1.2-5.4 3-7.2 1-1.3 2-2.3 2-3.8V2Z" />
      <line x1="3.5" y1="34" x2="18.5" y2="34" />
    </svg>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (including wine-hero-card and tasting-card from Tasks 1–2).

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redesign dashboard with wine hero and editorial tastings"
```
