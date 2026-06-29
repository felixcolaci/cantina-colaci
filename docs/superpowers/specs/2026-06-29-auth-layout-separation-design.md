---
title: Auth/App Layout Separation
date: 2026-06-29
status: approved
---

# Auth/App Layout Separation

## Goal

Separate authenticated and unauthenticated layouts into proper Next.js Route Groups, removing auth-state conditionals from the root layout.

## Current Problem

The root `app/layout.tsx` does a Supabase user fetch on every request and conditionally renders `TopBar`, `BottomNav`, `OfflineToast`, and `SwUpdateBanner`. The `(auth)` route group has no dedicated layout. This couples auth state to the root layout unnecessarily.

## Target Architecture

```
app/
  layout.tsx              ← minimal: Fonts, metadata, <html>, <body>, {children}
  (auth)/
    layout.tsx            ← NEW: passthrough, no user check
    login/
      page.tsx            ← unchanged
      login-form.tsx      ← placeholder: "deine@email.de"
  (app)/
    layout.tsx            ← NEW: user check + redirect + TopBar/BottomNav/OfflineToast/SwUpdateBanner
    page.tsx              ← moved from app/page.tsx
    cellar/               ← moved
    wine/                 ← moved
    trips/                ← moved
    family/               ← moved
    settings/             ← moved
    history/              ← moved
    join/                 ← moved (authenticated, shows app chrome)
  auth/callback/          ← unchanged (route handler)
  api/                    ← unchanged
```

## Component Responsibilities

### `app/layout.tsx` (updated)
- Font variables (`Cormorant_Garamond`, `Plus_Jakarta_Sans`, `DM_Mono`)
- `<Metadata>` export
- `<html lang="de">` and `<body>` wrapper
- No Supabase import, no user check, no conditional rendering

### `app/(auth)/layout.tsx` (new)
- Passthrough: just renders `{children}`
- No Supabase call, no chrome

### `app/(app)/layout.tsx` (new)
- Fetches user via `createClient().auth.getUser()`
- If no user → `redirect('/login')`
- Renders `<TopBar />`, `<main className="pt-14 pb-16 min-h-screen">`, `<BottomNav />`, `<OfflineToast />`, `<SwUpdateBanner />`
- Individual pages no longer need their own auth-redirect guards (can be cleaned up over time)

### `app/(auth)/login/login-form.tsx` (updated)
- Change `placeholder="felix@colaci.eu"` → `placeholder="deine@email.de"`

## Files to Move

| From | To |
|------|----|
| `app/page.tsx` | `app/(app)/page.tsx` |
| `app/cellar/` | `app/(app)/cellar/` |
| `app/wine/` | `app/(app)/wine/` |
| `app/trips/` | `app/(app)/trips/` |
| `app/family/` | `app/(app)/family/` |
| `app/settings/` | `app/(app)/settings/` |
| `app/history/` | `app/(app)/history/` |
| `app/join/` | `app/(app)/join/` |

## Notes

- URL paths are unchanged — route groups (`(auth)`, `(app)`) are not reflected in URLs
- Individual pages that currently do their own `redirect('/')` or `redirect('/login')` can keep that logic; the centralized redirect in `(app)/layout.tsx` acts as an additional guard
- The `?next` param in the login redirect should be preserved: `redirect('/login?next=' + encodeURIComponent(pathname))`
