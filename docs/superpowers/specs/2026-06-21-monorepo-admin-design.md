# Monorepo & Admin Backoffice — Design Spec

**Date:** 2026-06-21
**Repository:** git@github.com:felixcolaci/cantina-colaci.git
**Status:** Approved
**Target:** v2.1

---

## Overview

Restructure the repository as a Turborepo monorepo with two apps and shared packages. The existing PWA becomes `apps/web`; a new desktop-optimized admin backoffice becomes `apps/admin`. Shared TypeScript types and Supabase clients live in `packages/` and are imported by both apps.

---

## Monorepo Structure

```
cantina-colaci/                        ← repo root
├── apps/
│   ├── web/                           ← current PWA (moved from root)
│   └── admin/                         ← new Next.js admin backoffice
├── packages/
│   ├── types/                         ← shared TypeScript interfaces
│   └── supabase/                      ← shared Supabase client helpers
├── turbo.json
├── pnpm-workspace.yaml
└── package.json                       ← root (no app code, only tooling)
```

### `packages/types`
All interfaces from `lib/types.ts` (Wine, CellarEntry, Family, StorageLocation, etc.) plus `FeatureFlags` and `FlagName` from `lib/flags.ts`. Imported as `@cantina/types` in both apps.

### `packages/supabase`
Browser client, server client (cookie-based), and service role client — currently in `apps/web/lib/supabase/`. Exported as `@cantina/supabase`. Both apps share the same connection logic, not the same client instance.

---

## Admin App (`apps/admin`)

A standard desktop Next.js App Router application — no PWA, no bottom nav, no mobile-first layout. Deployed to Vercel as a separate project.

**Auth:** Magic link restricted to emails listed in `ADMIN_EMAILS` env var. No family/onboarding flow.

**Pages:**

| Route | Description |
|---|---|
| `/` | Dashboard: total families, total users, plan breakdown |
| `/families` | List all families with plan badge; click to drill in |
| `/families/[id]` | Family detail: members, plan, flag overrides, API keys |
| `/flags` | Global flag overview across all families |

**Key capabilities:**
- Change a family's `plan` (`free` / `pro` / `business`)
- Set or remove individual `feature_flag_overrides` per family
- View and revoke API keys
- Read-only view of cellar stats per family (bottle count, last activity)

All writes go through Server Actions using the Supabase **service role** client (`@cantina/supabase/service`).

---

## Shared Package Contracts

`@cantina/types` exports all interfaces — both apps import from there, never from each other.

`@cantina/supabase` exports three functions:
- `createBrowserClient()` — for client components in `apps/web`
- `createServerClient(cookieStore)` — for server components/actions in both apps
- `createServiceClient()` — for admin actions and MCP endpoint

---

## Deployment

| App | Vercel Project | URL |
|---|---|---|
| `apps/web` | `cantina-colaci` | `cantina-colaci.vercel.app` |
| `apps/admin` | `cantina-colaci-admin` | `admin.cantina-colaci.vercel.app` |

Both projects share the same Supabase instance and environment variables. `ADMIN_EMAILS` is set only on the admin project.

---

## Out of Scope

- `packages/ui` (shared shadcn components) — both apps maintain their own `components/ui/`; sharing components adds complexity without enough benefit at this scale
- CI/CD pipeline changes beyond Vercel auto-deploy
- Database per environment (dev/staging/prod) — single Supabase project for now
