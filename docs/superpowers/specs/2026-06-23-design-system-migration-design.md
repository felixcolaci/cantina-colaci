# Design System Migration — La Cantina Colaci

**Date:** 2026-06-23  
**Design system source:** [claude.ai/design/p/b0e5cb14-2354-45ef-91ea-5640868de46a](https://claude.ai/design/p/b0e5cb14-2354-45ef-91ea-5640868de46a)  
**Approach:** Token swap + targeted component rewrites (Approach B)

---

## Goal

Migrate the entire app from the default shadcn/neutral theme to the "La Cantina Colaci" design system: warm Italian-cellar palette, editorial Cormorant Garamond + Mulish typography, wine-specific components, and no emoji in UI chrome.

---

## Section 1 — CSS token layer (`app/globals.css`)

Replace the full content of `globals.css`. The new file:

1. Keeps `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"` at the top.
2. Adds an `@import` for Google Fonts loading Cormorant Garamond + Mulish (same URL as `tokens/fonts.css` in the design system).
3. Replaces all `:root` custom properties with the design system's semantic aliases:
   - `--background: #faf7f2` (cream)
   - `--foreground: #211a13` (ink-900)
   - `--card: #fffefb`, `--card-foreground: #211a13`
   - `--primary: #7c2d12` (wine-700), `--primary-foreground: #fbf3ec`
   - `--secondary: #f2ede3` (parchment), `--secondary-foreground: #211a13`
   - `--muted: #f5f1e9` (cream-soft), `--muted-foreground: #6c6051` (ink-500)
   - `--accent: #c1932f` (gold), `--accent-foreground: #2d1008`
   - `--destructive: #a3331f`, `--destructive-foreground: #fbf3ec`
   - `--border: #ebe3d6`, `--input: #e7ded0`, `--ring: #b04a28` (wine-500)
   - `--radius: 0.75rem` (up from 0.625rem)
   - Full radius family: `--radius-sm: calc(var(--radius) - 6px)`, `--radius-md: calc(var(--radius) - 3px)`, `--radius-lg: var(--radius)`, `--radius-xl: calc(var(--radius) + 6px)`, `--radius-full: 999px`
   - All brand color scales: `--wine-50` through `--wine-950`, `--cream`, `--cream-soft`, `--parchment`, `--parchment-2`, `--linen`, `--ink-900` through `--ink-100`, `--gold`, `--gold-soft`, `--amber`, `--type-*-fg/bg` for all four wine types
   - Warm shadows: `--shadow-xs/sm/md/lg/xl` with `rgba(45, 30, 18, …)` umber tint
   - Typography tokens: `--font-display`, `--font-sans`, `--font-body`, full type scale (`--text-xs` through `--text-5xl`), leading, tracking, weight variables
   - Layout tokens: `--content-max: 430px`, `--bottom-nav-h: 64px`, `--safe-bottom: env(safe-area-inset-bottom, 0px)`, `--safe-top: env(safe-area-inset-top, 0px)`
   - Motion tokens: `--ease-standard`, `--ease-out`, `--duration-fast: 140ms`, `--duration-base: 280ms`, `--duration-slow: 420ms`
4. Replaces `.dark` block with candlelight dark mode:
   - `--background: #1a120b`, `--foreground: #efe4d2`
   - `--card: #241810`, `--card-foreground: #efe4d2`
   - `--primary: #cf6f4d` (wine-400 — glows warm), `--primary-foreground: #2d1008`
   - `--muted: #2a1d13`, `--muted-foreground: #b6a589`
   - `--border: #3a2a1c`, `--input: #3a2a1c`, `--ring: #cf6f4d`
   - Wine-type badge dark overrides (deeper grounds, lighter foregrounds)
5. Updates the `@theme inline` block to reference `--font-display` and `--font-sans` for `--font-heading` and `--font-sans` respectively.
6. Keeps the `@layer base` reset block (`border-border`, `bg-background text-foreground`, `font-sans`).

**Unchanged:** All `components/ui/` shadcn primitives. They inherit automatically via CSS vars.

---

## Section 2 — Font loading (`app/layout.tsx`)

- Remove `import { Inter } from 'next/font/google'` and `const inter = Inter(…)`.
- Add:
  ```ts
  import { Cormorant_Garamond, Mulish } from 'next/font/google'

  const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    style: ['normal', 'italic'],
    variable: '--font-display',
  })

  const mulish = Mulish({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    style: ['normal', 'italic'],
    variable: '--font-sans',
  })
  ```
- On `<html>`, add `className={`${cormorant.variable} ${mulish.variable}`}` so the CSS variable names are injected at the root.
- On `<body>`, remove `className={inter.className}` (body font is now controlled via CSS `font-family: var(--font-body)` in globals).
- Remove `"🍷 "` prefix from the `title` metadata and from TopBar's heading text.

---

## Section 3 — Component rewrites

### 3a. `components/cellar/wine-card.tsx`

Rewrite to match the design system's `WineCard` pattern:

- **Photo well:** 64×92px, `border-radius: var(--radius-md)`, `background: linear-gradient(160deg, var(--parchment), var(--parchment-2))`. When no photo, render the bottle SVG glyph (stroke `var(--clay)`, opacity 0.6).
- **Producer:** `font-family: var(--font-body)`, `font-size: var(--text-xs)`, weight 700, `letter-spacing: 0.06em`, uppercase, `color: var(--muted-foreground)`.
- **Wine name:** `font-family: var(--font-display)`, `font-size: var(--text-xl)`, weight 600, `line-height: 1.12`, `letter-spacing: -0.01em`. Vintage appended inline in italic muted.
- **TypeBadge:** Inline implementation using `--type-{red|white|rosé|sparkling}-{bg|fg}` tokens. Small pill, `font-size: var(--text-xs)`, `letter-spacing: var(--tracking-caps)`, uppercase, `border-radius: var(--radius-full)`.
- **Bottle count:** `font-family: var(--font-display)`, `font-size: var(--text-2xl)`, weight 700. Label "bottle"/"bottles" in micro uppercase.
- **Card surface:** `background: var(--card)`, `border: 1px solid var(--border)`, `box-shadow: var(--shadow-sm)`, `border-radius: var(--radius-lg)`.
- **Hover:** `transform: translateY(-2px)`, `box-shadow: var(--shadow-md)`, transition `var(--duration-base) var(--ease-out)`.
- Remove emoji placeholder.
- Keep the `Link` wrapper and TypeScript props (`Wine`, `CellarEntry`).

### 3b. `components/dashboard/stats-card.tsx`

Rewrite to match the StatTile pattern:

- Label: `font-family: var(--font-body)`, `font-size: var(--text-xs)`, weight 700, `letter-spacing: var(--tracking-caps)`, uppercase, `color: var(--muted-foreground)`.
- Value: `font-family: var(--font-display)`, `font-size: var(--text-3xl)`, weight 700, `color: var(--foreground)`.
- Card: `background: var(--card)`, `border: 1px solid var(--border)`, `box-shadow: var(--shadow-sm)`, `border-radius: var(--radius-lg)`, `padding: var(--space-4) var(--space-5)`.
- Remove shadcn `Card/CardHeader/CardContent/CardTitle` imports — use plain `div` with inline Tailwind classes referencing CSS vars.

### 3c. `components/nav/bottom-nav.tsx`

Full rewrite:

- **Surface:** `background: color-mix(in oklab, var(--card) 88%, transparent)`, `backdrop-filter: saturate(140%) blur(12px)`, `border-top: 1px solid var(--border)`, `box-shadow: 0 -4px 16px rgba(61,38,22,0.06)`. Padding-bottom includes `env(safe-area-inset-bottom)`.
- **Icons:** Replace Lucide imports with inline SVG glyphs matching the design system:
  - Dashboard: grid of four rounded rectangles
  - Cellar: bottle/wine glass path (same as design system `cellar` glyph)
  - Trips: map-pin glyph
  - History: tastings/glass glyph
- **Active state:** `color: var(--primary)`, stroke thickness 2.3 (vs 1.9 inactive). No fill swap.
- **Labels:** `font-family: var(--font-body)`, `font-size: 0.6875rem`, weight 800 when active, 600 otherwise.
- Keep the `'use client'` directive and `usePathname` logic for active detection.
- Keep the same four nav items (`/`, `/cellar`, `/trips`, `/history`) and labels in German.

### 3d. `components/nav/top-bar.tsx`

- Remove emoji from the heading: `"🍷 Cantina Colaci"` → `"Cantina Colaci"`.
- Apply `font-family: var(--font-display)` to the `h1` via a Tailwind utility (`font-[family-name:var(--font-display)]`) or inline style.
- `font-size: var(--text-xl)`, weight 600, `letter-spacing: -0.01em`.
- Border remains `border-b`, surface `bg-background` (auto-inherits cream).

---

## Section 4 — Page polish

Light-touch updates across pages. No structural changes.

### `app/page.tsx` (dashboard)
- Remove `"🍷"` from greeting and `"🍾"` from empty state.
- Empty state: replace emoji with a small bottle SVG glyph (same as used in WineCard) or plain text.
- Greeting: `"Ciao! Willkommen 🍷"` → `"Ciao, willkommen."` or `"Benvenuti."`.
- Recent tastings list: wine name in `font-[family-name:var(--font-display)]` font, italic vintage.
- Rating displayed as `{rating}/10` (already correct).

### `app/cellar/page.tsx`
- Empty state: remove `"🍾"`, replace with bottle SVG glyph or plain text.
- Filter pills: already use `rounded-full` — correct. Active state inherits `bg-primary` (wine-700 now).

### `app/wine/[id]/page.tsx`
- Wine name heading rendered in `font-[family-name:var(--font-display)]` class.
- Any emoji in placeholder/empty states removed.

### `app/(auth)/login/page.tsx`, `app/onboarding/page.tsx`, `app/trips/page.tsx`, `app/history/page.tsx`, `app/family/page.tsx`
- Emoji removal only where present.
- No structural changes — these pages auto-inherit the new palette.

### `app/wine/new/wine-form.tsx`
- No changes needed. Form infrastructure inherits via tokens.

---

## What does NOT change

| Component | Reason |
|---|---|
| `components/ui/*` (all shadcn primitives) | Auto-inherit via CSS vars |
| `lib/actions/*`, `lib/hooks/*` | No visual concern |
| `lib/supabase/*` | No visual concern |
| `e2e/*` tests | Auth/flow tests unaffected by visual changes |
| `app/wine/new/wine-form.tsx` | Form infrastructure inherits correctly |

---

## Constraints

- No emoji anywhere in UI chrome or empty states after migration.
- Ratings stay as `x/10` numeric — never stars.
- Wine-type colors are fixed: red→wine, white→golden, rosé→dusty pink, sparkling→champagne blue. Only via `--type-*` tokens.
- Dark mode must work — all new inline styles must reference CSS vars, not hardcoded hex values.
- Tap targets ≥ 44px (bottom nav items already meet this; verify during implementation).
- Content column stays `max-w-lg mx-auto` (≈430px) — do not widen.
