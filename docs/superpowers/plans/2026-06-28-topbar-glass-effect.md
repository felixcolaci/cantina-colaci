# Top-Bar Glasmorphismus-Effekt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frosted-glass backdrop effect to the TopBar, matching the design pattern already used by BottomNav.

**Architecture:** Single-file change in `components/nav/top-bar.tsx`. Remove `bg-background border-b` Tailwind classes from the header element, add inline `style` prop with `color-mix` background, `backdropFilter`, and `borderBottom` — identical pattern to BottomNav.

**Tech Stack:** Next.js App Router (Server Component), CSS custom properties design system.

## Global Constraints

- All visual tokens via `var(--...)` — no hardcoded hex or Tailwind color classes
- Glass formula must match BottomNav exactly: `color-mix(in oklab, var(--card) 88%, transparent)` + `saturate(140%) blur(12px)`
- Run build: `npm run build`

---

### Task 1: Add glass effect to TopBar header

**Files:**
- Modify: `components/nav/top-bar.tsx`

**Reference — BottomNav glass style (in `components/nav/bottom-nav.tsx`):**
```tsx
style={{
  background: 'color-mix(in oklab, var(--card) 88%, transparent)',
  backdropFilter: 'saturate(140%) blur(12px)',
  borderTop: '1px solid var(--border)',
  boxShadow: 'var(--shadow-nav-top)',
}}
```

- [ ] **Step 1: Update top-bar.tsx**

Replace the full `components/nav/top-bar.tsx`:

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
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{
        height: '3.5rem',
        background: 'color-mix(in oklab, var(--card) 88%, transparent)',
        backdropFilter: 'saturate(140%) blur(12px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(61,38,22,0.06)',
      }}
    >
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
          <DropdownMenuItem render={<Link href="/settings/locations" />}>
            Lagerorte
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings/api-keys" />}>
            API-Schlüssel
          </DropdownMenuItem>
          <LogoutButton />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

Changes vs. original:
- Removed `bg-background border-b h-14` from `className`
- Added `style` prop with glass background, `backdropFilter`, `borderBottom`, `boxShadow`, and `height: '3.5rem'` (equivalent to `h-14`)

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Generating static pages` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/nav/top-bar.tsx
git commit -m "style: add frosted-glass effect to TopBar, matching BottomNav"
```
