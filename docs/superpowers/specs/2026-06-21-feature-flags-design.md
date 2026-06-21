# Feature Flags — Design Spec

**Date:** 2026-06-21
**Repository:** git@github.com:felixcolaci/cantina-colaci.git
**Status:** Approved
**Target:** v2 (social network)

---

## Overview

A lightweight feature flag system that gates features per family. Initially all flags are enabled for everyone. Later, flags get tied to subscription plans — without touching feature code, only flag configuration.

The system has two layers:
1. **Plan** — a family's subscription tier (`free` | `pro` | `business`). Determines the default flag set.
2. **Overrides** — per-family flag overrides for beta access, manual upgrades, or exceptions.

---

## Data Model

### Modified: `families`

Add one column:

| Column | Type | Notes |
|---|---|---|
| plan | text | `'free'` \| `'pro'` \| `'business'`, default `'free'` |

### New table: `feature_flag_overrides`

| Column | Type | Notes |
|---|---|---|
| family_id | uuid | FK → families |
| flag | text | Flag name, e.g. `'mcp_integration'` |
| enabled | boolean | Override value |
| created_at | timestamptz | |
| primary key | (family_id, flag) | |

### Flag resolution order (highest priority first):

1. `feature_flag_overrides` row for this family → use `enabled` value
2. Plan-level default from `PLAN_FLAGS` config (code, not DB)
3. Global default from `DEFAULT_FLAGS` config (code, not DB)

---

## Flag Definitions (v2 launch)

Defined in code (`lib/flags.ts`) — not in the database. Adding a new flag = one line of code.

| Flag | free | pro | business | Description |
|---|---|---|---|---|
| `mcp_integration` | ✓ | ✓ | ✓ | MCP server / Claude integration |
| `unlimited_cellar` | ✗ (max 50) | ✓ | ✓ | Unlimited wine entries |
| `advanced_stats` | ✗ | ✓ | ✓ | Analytics: spend, regions, vintage trends |
| `shared_tours` | ✓ | ✓ | ✓ | Collaborative wine tours |
| `winery_profiles` | ✗ | ✗ | ✓ | Verified winery profile management |
| `social_map` | ✓ | ✓ | ✓ | Friend region map |

During v2 beta: all flags enabled for all families via global default override. When billing goes live, global override is removed and plan defaults kick in.

---

## Server Usage

```typescript
import { getFeatureFlags } from '@/lib/flags'

// In a Server Component or Server Action:
const flags = await getFeatureFlags(familyId)

if (!flags.unlimited_cellar) {
  // check count, return error if over limit
}
```

## Client Usage

Flags are passed as props from Server Components — never fetched client-side (avoids flicker and bypassing).

```tsx
// Server Component passes flags down:
<WineForm flags={flags} />

// Client Component receives as prop:
export function WineForm({ flags }: { flags: FeatureFlags }) {
  if (!flags.advanced_stats) return null
  // ...
}
```

---

## Admin Override UI

A minimal `/admin/flags` page (protected by a hardcoded admin email list) lets you toggle per-family overrides — useful for granting beta access or manually upgrading a family without billing.

---

## Out of Scope

- User-level flags (family-level is sufficient)
- Real-time flag changes without page reload
- A/B testing (different flag values for different % of users)
- Billing / Stripe integration (separate feature)
