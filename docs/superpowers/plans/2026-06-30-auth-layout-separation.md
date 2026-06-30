# Auth/App Layout Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate auth and app layouts into proper Next.js Route Groups so the root layout contains no auth-state logic.

**Architecture:** The root layout becomes a minimal shell (fonts, metadata, html/body only). A new `(app)/layout.tsx` owns the TopBar/BottomNav chrome and the centralized auth guard. The existing `(auth)` group gets a passthrough layout. All app pages move under `(app)/`.

**Tech Stack:** Next.js App Router (route groups), Supabase SSR auth, React Server Components

## Global Constraints

- URL paths must not change — route groups `(auth)` and `(app)` are invisible in URLs
- Do not add `?next` to the centralized redirect — simple `redirect('/login')` only
- Do not remove per-page auth checks — leave them as-is (redundant but harmless)
- All `git mv` operations must preserve file history

---

### Task 1: Restructure layouts (root → minimal, create app + auth layouts)

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `app/(auth)/layout.tsx`

**Interfaces:**
- Produces: `(app)/layout.tsx` exports a default async Server Component that guards auth and renders `TopBar`, `<main className="pt-14 pb-16 min-h-screen">`, `BottomNav`, `OfflineToast`, `SwUpdateBanner`

- [ ] **Step 1: Update root layout to be minimal**

Replace the full contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Cormorant_Garamond, Plus_Jakarta_Sans, DM_Mono } from 'next/font/google'
import './globals.css'

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
})

const monoFont = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vino Mio',
  description: 'Il tuo cellar di famiglia',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vino Mio',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Create `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 3: Create `app/(app)/layout.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TopBar } from '@/components/nav/top-bar'
import { BottomNav } from '@/components/nav/bottom-nav'
import { OfflineToast } from '@/components/ui/offline-toast'
import { SwUpdateBanner } from '@/components/ui/sw-update-banner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <TopBar />
      <main className="pt-14 pb-16 min-h-screen">{children}</main>
      <BottomNav />
      <OfflineToast />
      <SwUpdateBanner />
    </>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this change)

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/\(auth\)/layout.tsx app/\(app\)/layout.tsx
git commit -m "feat: split root layout into minimal shell + (auth) + (app) layouts"
```

---

### Task 2: Move app pages into (app)/ route group

**Files:**
- Move: `app/page.tsx` → `app/(app)/page.tsx`
- Move: `app/cellar/` → `app/(app)/cellar/`
- Move: `app/wine/` → `app/(app)/wine/`
- Move: `app/trips/` → `app/(app)/trips/`
- Move: `app/family/` → `app/(app)/family/`
- Move: `app/settings/` → `app/(app)/settings/`
- Move: `app/history/` → `app/(app)/history/`
- Move: `app/join/` → `app/(app)/join/`

**Interfaces:**
- Consumes: `app/(app)/layout.tsx` from Task 1

- [ ] **Step 1: Create the (app) directory and move all pages**

```bash
mkdir -p app/\(app\)
git mv app/page.tsx app/\(app\)/page.tsx
git mv app/cellar app/\(app\)/cellar
git mv app/wine app/\(app\)/wine
git mv app/trips app/\(app\)/trips
git mv app/family app/\(app\)/family
git mv app/settings app/\(app\)/settings
git mv app/history app/\(app\)/history
git mv app/join app/\(app\)/join
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors)

- [ ] **Step 3: Smoke-test in browser**

Start the dev server (`npm run dev`) and verify:
- `/login` — shows login form, no TopBar or BottomNav visible
- `/` (logged in) — shows dashboard with TopBar and BottomNav
- `/cellar` (logged in) — loads correctly with chrome
- `/` (logged out) — redirects to `/login`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: move app pages into (app)/ route group"
```

---

### Task 3: Fix login form placeholder

**Files:**
- Modify: `app/(auth)/login/login-form.tsx:52`

**Interfaces:**
- Consumes: nothing from prior tasks (independent change)

- [ ] **Step 1: Replace placeholder email**

In `app/(auth)/login/login-form.tsx`, change:

```tsx
placeholder="felix@colaci.eu"
```

to:

```tsx
placeholder="deine@email.de"
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/login/login-form.tsx
git commit -m "fix: remove private email from login form placeholder"
```

---

## Self-Review

**Spec coverage:**
- ✅ Root layout minimalized (Task 1)
- ✅ `(auth)/layout.tsx` passthrough (Task 1)
- ✅ `(app)/layout.tsx` with auth guard + chrome (Task 1)
- ✅ All app pages moved to `(app)/` (Task 2)
- ✅ Login form placeholder fixed (Task 3)
- ✅ URL paths unchanged (route groups are transparent)
- ✅ No `?next` complexity in centralized redirect

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:** `createClient`, `TopBar`, `BottomNav`, `OfflineToast`, `SwUpdateBanner` are all imported from the same paths as the original `app/layout.tsx`.
