# Design System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate La Cantina Colaci from the default neutral shadcn theme to the warm wine-cellar design system: cream/parchment palette, Cormorant Garamond + Mulish fonts, wine-specific components, no emoji in UI.

**Architecture:** CSS token swap first (all shadcn primitives inherit automatically), then targeted rewrites of the six components that need visual changes beyond token inheritance. The design system CSS variables map 1-to-1 onto shadcn's semantic aliases, so form inputs, buttons, selects, and dialogs require no changes.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4, shadcn/ui, Vitest + @testing-library/react (jsdom), Playwright (e2e)

## Global Constraints

- No emoji anywhere in UI chrome, headings, buttons, or empty states
- Ratings displayed as `x/10` numeric — never stars
- Wine-type colours are fixed: red→`--type-red-*`, white→`--type-white-*`, rosé→`--type-rose-*`, sparkling→`--type-sparkling-*` — never pick inline hex values
- All inline styles must reference CSS variables (`var(--token)`) — never hardcode hex
- Dark mode must work — all new styles use CSS vars that have `.dark` overrides
- Content column stays `max-w-lg mx-auto` (≈430px)
- Tap targets ≥ 44px (bottom nav items)
- **Test runner note:** Vitest 4.x requires Node 22+; the environment has Node 20. `npm run test:run` will error with a startup error unrelated to our changes. Use `npm run build` (TypeScript check) as primary automated verification, and `npm run dev` + visual check for rendering

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `app/globals.css` | **Replace** | All design system CSS tokens |
| `app/layout.tsx` | **Modify** | Remove Inter font, add font @import via CSS |
| `components/cellar/wine-card.tsx` | **Rewrite** | Bottle glyph, TypeBadge, display serif, hover |
| `components/dashboard/stats-card.tsx` | **Rewrite** | StatTile pattern (eyebrow + display number) |
| `components/nav/bottom-nav.tsx` | **Rewrite** | Frosted glass, wine SVG icons, stroke-active |
| `components/nav/top-bar.tsx` | **Modify** | Remove emoji, display serif wordmark |
| `app/page.tsx` | **Modify** | Emoji removal, display font on wine names |
| `app/cellar/page.tsx` | **Modify** | Emoji removal in empty state |
| `app/(auth)/login/page.tsx` | **Modify** | Replace emoji logo with editorial wordmark |
| `app/onboarding/page.tsx` | **Modify** | Emoji removal |
| `app/wine/[id]/open-bottle-button.tsx` | **Modify** | Emoji removal |
| `app/trips/page.tsx` | **Modify** | Emoji removal |
| `app/history/page.tsx` | **Modify** | Emoji removal |
| `lib/__tests__/wine-card.test.tsx` | **Create** | WineCard render tests |
| `lib/__tests__/stats-card.test.tsx` | **Create** | StatsCard render tests |
| `lib/__tests__/bottom-nav.test.tsx` | **Create** | BottomNav render tests |

---

### Task 1: CSS token layer

**Files:**
- Replace: `app/globals.css`

**Interfaces:**
- Produces: CSS custom properties consumed by every component in the app via `var(--token)`. The key semantic aliases that shadcn uses: `--background`, `--foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`. Also produces `--font-display`, `--font-body`, all shadow tokens, all wine-type badge tokens.

- [ ] **Step 1: Replace `app/globals.css` with the full design system token file**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Mulish:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-body);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-display);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 6px);
  --radius-md: calc(var(--radius) - 3px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 6px);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  /* ---- Wine red scale ---- */
  --wine-50:  #fdf4f0;
  --wine-100: #f9e4da;
  --wine-200: #f0c4b2;
  --wine-300: #e29c83;
  --wine-400: #cf6f4d;
  --wine-500: #b04a28;
  --wine-600: #97391b;
  --wine-700: #7c2d12;
  --wine-800: #642611;
  --wine-900: #4c1d0e;
  --wine-950: #2d1008;

  --burgundy:      #5b1e22;
  --burgundy-deep: #3d1417;

  /* ---- Warm neutrals ---- */
  --cream:       #faf7f2;
  --cream-soft:  #f5f1e9;
  --parchment:   #f2ede3;
  --parchment-2: #e9e1d4;
  --linen:       #ddd2c2;

  --ink-900: #211a13;
  --ink-700: #463b2f;
  --ink-500: #6c6051;
  --ink-300: #a89c89;
  --ink-100: #ddd4c5;

  /* ---- Earth tones ---- */
  --olive: #6f6a47;
  --clay:  #a8755a;
  --stone: #8a8174;
  --umber: #5c4a39;
  --sage:  #8c9277;

  /* ---- Gold / amber ---- */
  --gold:      #c1932f;
  --gold-soft: #d9b35a;
  --amber:     #d99a3c;

  /* ---- Wine-type badge colors ---- */
  --type-red-fg:        #7c2d12; --type-red-bg:        #f6e0d6;
  --type-white-fg:      #9a7611; --type-white-bg:      #f6edc9;
  --type-rose-fg:       #b06a72; --type-rose-bg:       #f6e3e4;
  --type-sparkling-fg:  #4f7390; --type-sparkling-bg:  #e3edf4;

  /* ---- Status ---- */
  --success: #5d7a4f;
  --warning: #c1932f;
  --danger:  #a3331f;

  /* ---- shadcn / Tailwind semantic aliases — LIGHT ---- */
  --background:            var(--cream);
  --foreground:            var(--ink-900);
  --card:                  #fffefb;
  --card-foreground:       var(--ink-900);
  --popover:               #fffefb;
  --popover-foreground:    var(--ink-900);
  --primary:               var(--wine-700);
  --primary-foreground:    #fbf3ec;
  --secondary:             var(--parchment);
  --secondary-foreground:  var(--ink-900);
  --muted:                 var(--cream-soft);
  --muted-foreground:      var(--ink-500);
  --accent:                var(--gold);
  --accent-foreground:     #2d1008;
  --destructive:           var(--danger);
  --destructive-foreground:#fbf3ec;
  --border:                #ebe3d6;
  --input:                 #e7ded0;
  --ring:                  var(--wine-500);
  --radius:                0.75rem;
  --radius-full:           999px;

  /* ---- Charts ---- */
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);

  /* ---- Sidebar ---- */
  --sidebar:                    var(--cream-soft);
  --sidebar-foreground:         var(--ink-900);
  --sidebar-primary:            var(--wine-700);
  --sidebar-primary-foreground: #fbf3ec;
  --sidebar-accent:             var(--parchment);
  --sidebar-accent-foreground:  var(--ink-900);
  --sidebar-border:             var(--linen);
  --sidebar-ring:               var(--wine-500);

  /* ---- Shadows (warm umber tint) ---- */
  --shadow-xs: 0 1px 2px rgba(45, 30, 18, 0.05);
  --shadow-sm: 0 1px 2px rgba(45, 30, 18, 0.06), 0 2px 6px rgba(45, 30, 18, 0.05);
  --shadow-md: 0 2px 6px rgba(45, 30, 18, 0.07), 0 8px 20px rgba(45, 30, 18, 0.08);
  --shadow-lg: 0 6px 16px rgba(40, 24, 12, 0.09), 0 18px 40px rgba(40, 24, 12, 0.11);
  --shadow-xl: 0 24px 56px rgba(35, 18, 8, 0.18);

  /* ---- Typography ---- */
  --font-display: 'Cormorant Garamond', 'Hoefler Text', Georgia, 'Times New Roman', serif;
  --font-body:    'Mulish', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;

  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.375rem;
  --text-2xl:  1.875rem;
  --text-3xl:  2.5rem;
  --text-4xl:  3.5rem;
  --text-5xl:  4.5rem;

  --leading-display: 1.0;
  --leading-tight:   1.05;
  --leading-snug:    1.18;
  --leading-normal:  1.5;
  --leading-relaxed: 1.7;

  --tracking-display: -0.028em;
  --tracking-tight:   -0.02em;
  --tracking-normal:  0;
  --tracking-wide:    0.04em;
  --tracking-caps:    0.16em;

  --weight-regular:   400;
  --weight-medium:    500;
  --weight-semibold:  600;
  --weight-bold:      700;
  --weight-extrabold: 800;

  /* ---- Spacing ---- */
  --space-0:  0;
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-5:  1.25rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* ---- Layout ---- */
  --content-max:  430px;
  --bottom-nav-h: 64px;
  --safe-bottom:  env(safe-area-inset-bottom, 0px);
  --safe-top:     env(safe-area-inset-top, 0px);

  /* ---- Motion ---- */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 140ms;
  --duration-base: 280ms;
  --duration-slow: 420ms;
}

/* ---- Candlelight dark mode ---- */
.dark {
  --background:            #1a120b;
  --foreground:            #efe4d2;
  --card:                  #241810;
  --card-foreground:       #efe4d2;
  --popover:               #241810;
  --popover-foreground:    #efe4d2;
  --primary:               #cf6f4d;
  --primary-foreground:    #2d1008;
  --secondary:             rgba(48, 34, 23, 0.2);
  --secondary-foreground:  #efe4d2;
  --muted:                 #2a1d13;
  --muted-foreground:      #b6a589;
  --accent:                var(--gold-soft);
  --accent-foreground:     #211505;
  --destructive:           #c15a45;
  --destructive-foreground:#fbf3ec;
  --border:                #3a2a1c;
  --input:                 #3a2a1c;
  --ring:                  #cf6f4d;

  --parchment:   #2e2015;
  --parchment-2: #382818;
  --ink-900: #efe4d2;
  --ink-700: #d8c8b0;
  --ink-500: #b6a589;
  --ink-300: #8a7a63;
  --ink-100: #3a2a1c;

  --type-red-bg:        #3a1f15; --type-red-fg:        #e29c83;
  --type-white-bg:      #352c12; --type-white-fg:      #d9b35a;
  --type-rose-bg:       #3a2326; --type-rose-fg:       #d39aa3;
  --type-sparkling-bg:  #1f2c36; --type-sparkling-fg:  #8fb2cc;

  --sidebar:                    #241810;
  --sidebar-foreground:         #efe4d2;
  --sidebar-primary:            #cf6f4d;
  --sidebar-primary-foreground: #2d1008;
  --sidebar-accent:             #2a1d13;
  --sidebar-accent-foreground:  #efe4d2;
  --sidebar-border:             #3a2a1c;
  --sidebar-ring:               #cf6f4d;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }
  html {
    @apply font-sans;
  }
  h1, h2, h3, h4 {
    font-family: var(--font-display);
    font-weight: 600;
    line-height: var(--leading-snug);
    letter-spacing: var(--tracking-tight);
  }
  ::selection {
    background: color-mix(in oklab, var(--primary) 22%, transparent);
  }
}

/* Design system utility classes */
.eyebrow {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.nums {
  font-variant-numeric: tabular-nums lining-nums;
}
.wine-card-hover {
  transition: transform var(--duration-base) var(--ease-out),
              box-shadow var(--duration-base) var(--ease-out);
}
.wine-card-hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds (or the only errors are pre-existing unrelated to CSS).

- [ ] **Step 3: Start dev server and visually verify**

```bash
npm run dev
```

Open http://localhost:3000/login. Verify:
- Background is warm cream (not white)
- "La Cantina Colaci" heading is visible
- No console errors about missing CSS

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: replace CSS tokens with La Cantina Colaci design system"
```

---

### Task 2: Layout — remove Inter, clean up font class

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `--font-body` and `--font-display` CSS vars defined in Task 1's globals.css
- Produces: `<html>` and `<body>` elements with no font className (body font controlled by CSS vars from globals.css)

- [ ] **Step 1: Rewrite `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { TopBar } from '@/components/nav/top-bar'
import { BottomNav } from '@/components/nav/bottom-nav'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'La Cantina Colaci',
  description: 'Eure Weinsammlung',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cantina',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="de">
      <body>
        {user && <TopBar />}
        <main className={user ? 'pt-14 pb-16 min-h-screen' : 'min-h-screen'}>
          {children}
        </main>
        {user && <BottomNav />}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Visually verify fonts load**

```bash
npm run dev
```

Open http://localhost:3000/login. Verify that Mulish (humanist sans, slightly rounded) is loading instead of Inter. Check http://localhost:3000 (dashboard) if logged in — page headings (`h2`) should render in Cormorant Garamond (tall elegant serif).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: remove Inter font, body font now from design system CSS"
```

---

### Task 3: Rewrite WineCard

**Files:**
- Rewrite: `components/cellar/wine-card.tsx`
- Create: `lib/__tests__/wine-card.test.tsx`

**Interfaces:**
- Consumes: `Wine` and `CellarEntry` types from `@/lib/types`; `--type-*-bg/fg` tokens from Task 1; `--font-display`, `--font-body`, `--parchment`, `--parchment-2`, `--clay`, `--card`, `--border`, `--shadow-sm/md`, `--radius-lg/md/full` from Task 1
- Produces: `WineCard` component — props unchanged (`wine: Wine`, `entries: Pick<CellarEntry, 'quantity' | 'photo_url'>[]`)

- [ ] **Step 1: Write the test file**

Create `lib/__tests__/wine-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WineCard } from '@/components/cellar/wine-card'

const baseWine = {
  id: '1',
  name: 'Barolo',
  producer: 'Gaja',
  type: 'red' as const,
  vintage: 2019,
  region: null,
  grape_variety: null,
  notes: null,
  cellar_id: 'c1',
  created_at: '2024-01-01',
}

const baseEntries = [{ quantity: 3, photo_url: null }]

describe('WineCard', () => {
  it('renders the wine name', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.getByText('Barolo')).toBeInTheDocument()
  })

  it('renders the producer', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.getByText('Gaja')).toBeInTheDocument()
  })

  it('renders the total bottle count', () => {
    render(<WineCard wine={baseWine} entries={[{ quantity: 2, photo_url: null }, { quantity: 1, photo_url: null }]} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders the type badge label for red wine', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.getByText('Rotwein')).toBeInTheDocument()
  })

  it('renders the type badge label for white wine', () => {
    render(<WineCard wine={{ ...baseWine, type: 'white' }} entries={baseEntries} />)
    expect(screen.getByText('Weißwein')).toBeInTheDocument()
  })

  it('renders the type badge label for sparkling wine', () => {
    render(<WineCard wine={{ ...baseWine, type: 'sparkling' }} entries={baseEntries} />)
    expect(screen.getByText('Schaumwein')).toBeInTheDocument()
  })

  it('renders an img when photo_url is provided', () => {
    render(<WineCard wine={baseWine} entries={[{ quantity: 1, photo_url: 'https://example.com/photo.jpg' }]} />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('renders no img when no photo_url', () => {
    render(<WineCard wine={baseWine} entries={baseEntries} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rewrite `components/cellar/wine-card.tsx`**

```tsx
import Link from 'next/link'
import type { Wine, CellarEntry } from '@/lib/types'

const TYPE_CONFIG = {
  red:      { bg: 'var(--type-red-bg)',       fg: 'var(--type-red-fg)',       label: 'Rotwein' },
  white:    { bg: 'var(--type-white-bg)',      fg: 'var(--type-white-fg)',     label: 'Weißwein' },
  'rosé':   { bg: 'var(--type-rose-bg)',       fg: 'var(--type-rose-fg)',      label: 'Rosé' },
  sparkling:{ bg: 'var(--type-sparkling-bg)',  fg: 'var(--type-sparkling-fg)', label: 'Schaumwein' },
} as const

interface WineCardProps {
  wine: Wine
  entries: Pick<CellarEntry, 'quantity' | 'photo_url'>[]
}

export function WineCard({ wine, entries }: WineCardProps) {
  const totalBottles = entries.reduce((sum, e) => sum + e.quantity, 0)
  const photo = entries.find(e => e.photo_url)?.photo_url
  const type = TYPE_CONFIG[wine.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.red

  return (
    <Link href={`/wine/${wine.id}`} className="block">
      <div
        className="flex gap-4 p-4 wine-card-hover"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Photo well */}
        <div
          className="flex-none flex items-center justify-center overflow-hidden"
          style={{
            width: 64,
            minHeight: 92,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(160deg, var(--parchment), var(--parchment-2))',
          }}
        >
          {photo ? (
            <img src={photo} alt={wine.name} className="w-full h-full object-cover" />
          ) : (
            <BottleGlyph />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          {wine.producer && (
            <span className="eyebrow truncate">{wine.producer}</span>
          )}
          <span
            className="nums"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              lineHeight: 1.12,
              color: 'var(--foreground)',
              letterSpacing: '-0.01em',
            }}
          >
            {wine.name}
            {wine.vintage && (
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 500, fontStyle: 'italic' }}>
                {'  '}{wine.vintage}
              </span>
            )}
          </span>
          <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
            <span
              className="inline-flex items-center px-2 py-0.5"
              style={{
                background: type.bg,
                color: type.fg,
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {type.label}
            </span>
          </div>
        </div>

        {/* Bottle count */}
        <div className="flex-none flex flex-col items-end justify-center gap-0.5 pl-1">
          <span
            className="nums"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              lineHeight: 1,
              color: totalBottles > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
            }}
          >
            {totalBottles}
          </span>
          <span className="eyebrow">{totalBottles === 1 ? 'Flasche' : 'Flaschen'}</span>
        </div>
      </div>
    </Link>
  )
}

function BottleGlyph() {
  return (
    <svg
      width="22" height="56" viewBox="0 0 22 56" fill="none"
      stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round"
      aria-hidden="true" style={{ opacity: 0.6 }}
    >
      <path d="M8 2h6v9c0 1.5 1 2.5 2 3.8 1.8 1.8 3 3.6 3 7.2v28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V22c0-3.6 1.2-5.4 3-7.2 1-1.3 2-2.3 2-3.8V2Z" />
      <line x1="3.5" y1="34" x2="18.5" y2="34" />
    </svg>
  )
}
```

- [ ] **Step 3: Run build to verify types compile**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors in wine-card.tsx.

- [ ] **Step 4: Visually verify on `/cellar`**

```bash
npm run dev
```

Navigate to `/cellar`. Verify:
- Each wine card has a parchment-gradient photo well with bottle glyph (or photo if present)
- Wine name is in serif font
- Type badge shows correct colour (red wines have reddish badge, etc.)
- Cards have warm shadow
- Hover lifts card 2px

- [ ] **Step 5: Commit**

```bash
git add components/cellar/wine-card.tsx lib/__tests__/wine-card.test.tsx
git commit -m "feat: rewrite WineCard with design system — TypeBadge, display serif, bottle glyph"
```

---

### Task 4: Rewrite StatsCard (StatTile pattern)

**Files:**
- Rewrite: `components/dashboard/stats-card.tsx`
- Create: `lib/__tests__/stats-card.test.tsx`

**Interfaces:**
- Consumes: `--font-display`, `--font-body`, `--text-3xl`, `--text-xs`, `--tracking-caps`, `--card`, `--border`, `--shadow-sm`, `--radius-lg` from Task 1
- Produces: `StatsCard` — props unchanged (`title: string`, `value: string | number`)

- [ ] **Step 1: Write the test file**

Create `lib/__tests__/stats-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/dashboard/stats-card'

describe('StatsCard', () => {
  it('renders the title', () => {
    render(<StatsCard title="Flaschen im Keller" value={42} />)
    expect(screen.getByText('Flaschen im Keller')).toBeInTheDocument()
  })

  it('renders the numeric value', () => {
    render(<StatsCard title="Weine" value={7} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders a string value', () => {
    render(<StatsCard title="Bewertung" value="8.5" />)
    expect(screen.getByText('8.5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rewrite `components/dashboard/stats-card.tsx`**

```tsx
interface StatsCardProps {
  title: string
  value: string | number
}

export function StatsCard({ title, value }: StatsCardProps) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4) var(--space-5)',
      }}
    >
      <p className="eyebrow mb-2">{title}</p>
      <p
        className="nums"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--foreground)',
        }}
      >
        {value}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 4: Visually verify on `/`**

```bash
npm run dev
```

Navigate to `/`. Verify:
- Stats tiles show title in small uppercase, value in large serif number
- Background is card-white (slightly warmer than page background)
- Shadow is present

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/stats-card.tsx lib/__tests__/stats-card.test.tsx
git commit -m "feat: rewrite StatsCard with StatTile pattern — eyebrow label, display serif value"
```

---

### Task 5: Rewrite BottomNav

**Files:**
- Rewrite: `components/nav/bottom-nav.tsx`
- Create: `lib/__tests__/bottom-nav.test.tsx`

**Interfaces:**
- Consumes: `--card`, `--border`, `--primary`, `--muted-foreground`, `--font-body`, `--duration-fast`, `--ease-standard`, `--safe-bottom` from Task 1. Uses `usePathname` from `next/navigation`.
- Produces: `BottomNav` component — no props (same as before)

- [ ] **Step 1: Write the test file**

Create `lib/__tests__/bottom-nav.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '@/components/nav/bottom-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('BottomNav', () => {
  it('renders all four nav items', () => {
    render(<BottomNav />)
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    expect(screen.getByLabelText('Keller')).toBeInTheDocument()
    expect(screen.getByLabelText('Reisen')).toBeInTheDocument()
    expect(screen.getByLabelText('Geschichte')).toBeInTheDocument()
  })

  it('renders as a nav element', () => {
    render(<BottomNav />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rewrite `components/nav/bottom-nav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    href: '/cellar',
    label: 'Keller',
    icon: (
      <>
        <path d="M8 22h8" />
        <path d="M7 10h10" />
        <path d="M12 15v7" />
        <path d="M7 2h10l-1.2 8.5a4 4 0 0 1-7.6 0L7 2Z" />
      </>
    ),
  },
  {
    href: '/trips',
    label: 'Reisen',
    icon: (
      <>
        <path d="M12 2a7 7 0 0 1 7 7c0 4.5-7 13-7 13S5 13.5 5 9a7 7 0 0 1 7-7Z" />
        <circle cx="12" cy="9" r="2.5" />
      </>
    ),
  },
  {
    href: '/history',
    label: 'Geschichte',
    icon: (
      <>
        <path d="M12 8v13" />
        <path d="M8 21h8" />
        <path d="M5 3h14l-1 4.5a6 6 0 0 1-12 0L5 3Z" />
      </>
    ),
  },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
      style={{
        background: 'color-mix(in oklab, var(--card) 88%, transparent)',
        backdropFilter: 'saturate(140%) blur(12px)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(61,38,22,0.06)',
        padding: '8px 10px',
        paddingBottom: 'calc(8px + var(--safe-bottom))',
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-1"
            style={{
              color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
              transition: `color var(--duration-fast) var(--ease-standard)`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg
              width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth={isActive ? 2.3 : 1.9}
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              {icon}
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.6875rem',
                fontWeight: isActive ? 800 : 600,
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 4: Visually verify**

```bash
npm run dev
```

Verify:
- Bottom nav has frosted glass appearance (card surface with slight transparency + blur)
- Icons are wine-specific SVG glyphs (not Lucide icons)
- Active tab (current route) shows in wine-red with thicker stroke
- Labels render in Mulish

- [ ] **Step 5: Commit**

```bash
git add components/nav/bottom-nav.tsx lib/__tests__/bottom-nav.test.tsx
git commit -m "feat: rewrite BottomNav with frosted glass, wine SVG icons, stroke-active state"
```

---

### Task 6: Update TopBar

**Files:**
- Modify: `components/nav/top-bar.tsx`

**Interfaces:**
- Consumes: `--font-display`, `--background`, `--border` from Task 1

- [ ] **Step 1: Rewrite `components/nav/top-bar.tsx`**

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogoutButton } from './logout-button'

export async function TopBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b h-14 flex items-center px-4 justify-between">
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          margin: 0,
          lineHeight: 1,
        }}
      >
        Cantina Colaci
      </h1>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <button className="cursor-pointer rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        } />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/family" />}>
            Familie
          </DropdownMenuItem>
          <LogoutButton />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Visually verify**

```bash
npm run dev
```

Verify: Top bar shows "Cantina Colaci" in Cormorant Garamond (tall serif), no emoji.

- [ ] **Step 4: Commit**

```bash
git add components/nav/top-bar.tsx
git commit -m "feat: update TopBar — remove emoji, apply display serif wordmark"
```

---

### Task 7: Emoji cleanup across all pages

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/onboarding/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/cellar/page.tsx`
- Modify: `app/wine/[id]/open-bottle-button.tsx`
- Modify: `app/trips/page.tsx`
- Modify: `app/history/page.tsx`

**Interfaces:**
- Consumes: `--font-display`, `--font-body`, `--primary`, `--parchment`, `--parchment-2`, `--clay`, `--radius-lg`, `--shadow-sm` from Task 1

- [ ] **Step 1: Rewrite `app/(auth)/login/page.tsx`** — replace emoji with editorial wordmark

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-4xl)',
              fontWeight: 700,
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--primary)',
              lineHeight: 1.1,
              marginBottom: '0.25rem',
            }}
          >
            La Cantina Colaci
          </h1>
          <p className="text-muted-foreground mt-2">Eure Weinsammlung</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `app/onboarding/page.tsx`** — remove emoji from heading

```tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Benvenuto bei Cantina Colaci!</h1>
        <OnboardingForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `app/page.tsx`** — remove emoji from greeting and empty state; apply display font to wine names in recent tastings

```tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
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

  if (!membership) redirect('/onboarding')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/onboarding')

  const { data: wines } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  const { data: inStockEntries } = wineIds.length
    ? await admin
        .from('cellar_entries')
        .select('quantity')
        .in('wine_id', wineIds)
        .eq('status', 'in_stock')
    : { data: [] }

  const totalBottles = (inStockEntries ?? []).reduce((sum, e) => sum + e.quantity, 0)

  const { data: recentTastings } = await admin
    .from('tastings')
    .select('id, date, rating, cellar_entries(wines(name, producer))')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Ciao, willkommen.</h2>

      <div className="grid grid-cols-2 gap-3">
        <StatsCard title="Flaschen im Keller" value={totalBottles} />
        <StatsCard title="Verschiedene Weine" value={wineIds.length} />
      </div>

      {recentTastings && recentTastings.length > 0 && (
        <section>
          <h3 className="eyebrow mb-3">Letzte Verkostungen</h3>
          <div className="space-y-2">
            {recentTastings.map(t => {
              const wine = (t.cellar_entries as any)?.wines
              return (
                <div
                  key={t.id}
                  className="flex justify-between items-center p-3 rounded-lg border"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 600,
                        lineHeight: 1.2,
                      }}
                    >
                      {wine?.name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span
                    className="nums font-bold"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)' }}
                  >
                    {t.rating}/10
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {wineIds.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <BottleGlyph />
          <p className="mt-3">Der Keller ist noch leer.</p>
          <Link href="/wine/new" className="mt-3 inline-block text-primary underline">
            Ersten Wein hinzufügen
          </Link>
        </div>
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

- [ ] **Step 4: Update `app/cellar/page.tsx`** — replace emoji empty state with bottle glyph

Replace the empty state block (lines 99–106):

```tsx
// Replace:
<div className="text-center py-12 text-muted-foreground">
  <p className="text-4xl mb-2">🍾</p>
  <p>Keine Weine im Keller</p>
  <Button className="mt-4" render={<Link href="/wine/new" />}>
    Ersten Wein hinzufügen
  </Button>
</div>

// With:
<div className="text-center py-12 text-muted-foreground">
  <svg
    width="32" height="64" viewBox="0 0 22 56" fill="none"
    stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round"
    aria-hidden="true" style={{ opacity: 0.5, margin: '0 auto', display: 'block' }}
  >
    <path d="M8 2h6v9c0 1.5 1 2.5 2 3.8 1.8 1.8 3 3.6 3 7.2v28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V22c0-3.6 1.2-5.4 3-7.2 1-1.3 2-2.3 2-3.8V2Z" />
    <line x1="3.5" y1="34" x2="18.5" y2="34" />
  </svg>
  <p className="mt-3">Keine Weine im Keller.</p>
  <Button className="mt-4" render={<Link href="/wine/new" />}>
    Ersten Wein hinzufügen
  </Button>
</div>
```

- [ ] **Step 5: Update `app/wine/[id]/open-bottle-button.tsx`** — remove emoji from button and sheet title

```tsx
// Replace line 21:
//   🍾 Flasche öffnen
// With:
//   Flasche öffnen

// Replace line 25:
//   <SheetTitle>Verkostung — Salute! 🥂</SheetTitle>
// With:
//   <SheetTitle>Verkostung</SheetTitle>
```

Full file after changes:

```tsx
'use client'

import { useState } from 'react'
import { openBottle } from '@/lib/actions/tasting'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function OpenBottleButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const { run, isPending, error } = useServerAction(openBottle)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="w-full" />}>
        Flasche öffnen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Verkostung</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <input type="hidden" name="cellar_entry_id" value={entryId} />
          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input id="date" name="date" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Bewertung (1–10)</Label>
            <Input id="rating" name="rating" type="number" min="1" max="10" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Verkostungsnotizen</Label>
            <Textarea id="notes" name="notes" placeholder="Duft, Geschmack, Begleitung…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Verkostung speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 6: Update `app/trips/page.tsx`** — remove emoji from empty state

```tsx
// Replace line 61:
//   <p className="text-center py-8 text-muted-foreground">Noch keine Reisen — Andiamo! 🗺️</p>
// With:
//   <p className="text-center py-8 text-muted-foreground">Noch keine Reisen — Andiamo!</p>
```

- [ ] **Step 7: Update `app/history/page.tsx`** — remove emoji from empty state

```tsx
// Replace lines 84–86:
//   <p className="text-center py-8 text-muted-foreground">
//     Noch nichts getrunken — apri una bottiglia! 🍷
//   </p>
// With:
//   <p className="text-center py-8 text-muted-foreground">
//     Noch nichts getrunken — apri una bottiglia!
//   </p>
```

- [ ] **Step 8: Apply display font to wine name on `app/wine/[id]/page.tsx`**

Replace line 76:
```tsx
// Replace:
<h2 className="text-2xl font-bold">{wine.name}</h2>

// With:
<h2
  style={{
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--text-3xl)',
    fontWeight: 700,
    letterSpacing: 'var(--tracking-tight)',
    lineHeight: 'var(--leading-snug)',
    margin: 0,
  }}
>
  {wine.name}
</h2>
```

- [ ] **Step 9: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 10: Visual tour — verify all pages**

```bash
npm run dev
```

Visit each route and confirm no emoji appears:
- `/login` — editorial wordmark in wine-red Cormorant, no emoji
- `/onboarding` — clean heading, no emoji
- `/` (dashboard) — bottle glyph in empty state, wine names in serif
- `/cellar` — bottle glyph in empty state
- `/wine/[id]` — wine name in large display serif, "Flasche öffnen" button without emoji
- `/trips` — empty state without map emoji
- `/history` — empty state without wine emoji

- [ ] **Step 11: Commit everything**

```bash
git add \
  app/page.tsx \
  app/cellar/page.tsx \
  app/\(auth\)/login/page.tsx \
  app/onboarding/page.tsx \
  "app/wine/[id]/open-bottle-button.tsx" \
  "app/wine/[id]/page.tsx" \
  app/trips/page.tsx \
  app/history/page.tsx
git commit -m "feat: remove emoji from all pages, apply display font to wine names"
```

---

## Post-implementation checklist

- [ ] Run `npm run build` — zero TypeScript errors
- [ ] Open `/login` — warm cream background, Cormorant Garamond title in wine-red
- [ ] Open `/cellar` — WineCards have parchment photo wells, wine-type colour badges, display serif names
- [ ] Open `/` — StatTiles show eyebrow labels + large serif numbers
- [ ] Bottom nav shows wine glyphs, active item in wine-red with thicker stroke
- [ ] Top bar shows "Cantina Colaci" in serif with no emoji
- [ ] Toggle dark mode (add `dark` class to `<html>`) — espresso backgrounds, primary warms to `#cf6f4d`
- [ ] No emoji visible anywhere in the UI
