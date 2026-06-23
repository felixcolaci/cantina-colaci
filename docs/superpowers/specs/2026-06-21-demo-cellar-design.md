# Demo Cellar — Design Spec

**Date:** 2026-06-21
**Repository:** git@github.com:felixcolaci/cantina-colaci.git
**Status:** Approved

---

## Overview

Every new user automatically gets a pre-seeded demo cellar on first login — no onboarding form required. The cellar contains realistic Italian wines across all types, two storage locations, a past trip, and a couple of pre-recorded tastings. A dismissible banner signals demo mode. When the user is ready, one click wipes the demo wines and renames the cellar to start fresh.

The goal is to let users explore every feature — filtering, opening bottles, tasting notes, storage locations — before committing to their own data.

---

## Flow

```
First login
    │
    ▼
Auto-create family + cellar + seed data
    │
    ▼
Land on /cellar with demo banner:
"Du befindest dich im Demo-Modus. Erkunde die Cantina und klicke auf
'Eigene Cantina starten' wenn du bereit bist."  [Eigene Cantina starten]
    │
    ├─ User explores freely (all features work)
    │
    └─ User clicks "Eigene Cantina starten"
           │
           ▼
       Confirm dialog: "Demo-Weine löschen und neu starten?"
           │
           ▼
       Delete all seed wines/entries/tastings/trips
       Show rename form: "Wie heißt deine Cantina?"
           │
           ▼
       Normal app (no banner)
```

---

## Data Model Change

### Modified: `families`

Add one boolean column:

| Column | Type | Notes |
|---|---|---|
| is_demo | boolean | default `true`; set to `false` when user starts their own cellar |

The demo banner shows when `families.is_demo = true`. All other logic is unchanged.

---

## Seed Data (per new user)

**Storage locations (2):**
- "Klimaschrank" (climate_cabinet)
- "Kühlschrank" (fridge)

**Wines (6):**

| Name | Producer | Vintage | Type | Region | Qty | Location |
|---|---|---|---|---|---|---|
| Brunello di Montalcino | Casanova di Neri | 2018 | red | Toscana | 2 | Klimaschrank |
| Barolo | Giacomo Conterno | 2019 | red | Piemonte | 3 | Klimaschrank |
| Pinot Grigio | Santa Margherita | 2022 | white | Alto Adige | 4 | Kühlschrank |
| Prosecco Superiore | Bisol | NV | sparkling | Veneto | 6 | Kühlschrank |
| Chianti Classico Riserva | Antinori | 2020 | red | Toscana | 2 | Klimaschrank |
| Rosé di Montepulciano | Avignonesi | 2023 | rosé | Toscana | 2 | Kühlschrank |

### Demo Photos (shared, not per-user)

Bottle photos are uploaded **once** to Supabase Storage and shared across all demo cellars. No per-user copies are created.

- **Bucket:** `wine-photos` (existing public bucket)
- **Path prefix:** `demo/` (e.g. `demo/brunello.jpg`)
- **Upload:** one-time manual upload during initial setup
- **Reference:** `cellar_entries.photo_url` is set to the public URL of the shared file

When a user clears their demo cellar, the database rows are deleted but **the Storage files are never touched** — they remain available for the next new user's demo cellar.

**Trip (1):**
- Name: "Toskana Mai 2026", location: "Toscana, Italia"
- Brunello + Chianti Classico linked to this trip

**Tastings (2, pre-recorded):**
- Prosecco: rating 8, notes: "Frisch und lebendig — perfekt als Aperitivo"
- Pinot Grigio: rating 7, notes: "Leicht und mineralisch, gut zum Fisch"

---

## UI Changes

### Demo banner on `/cellar`

Shown when `family.is_demo = true`. Dismissible per session (localStorage) but reappears on next visit until the user starts their own cellar.

```
┌─────────────────────────────────────────────────────┐
│ 🍷 Demo-Modus — Erkunde deine Cantina              │
│ Wenn du bereit bist, starte mit deinen echten Weinen│
│                          [Eigene Cantina starten →] │
└─────────────────────────────────────────────────────┘
```

### "Eigene Cantina starten" flow

Accessible from the demo banner and from `/family`. Triggers a confirmation sheet, then:
1. Deletes all `tastings`, `cellar_entries`, `wines`, `trips`, `storage_locations` belonging to the cellar
2. Updates `families.is_demo = false`
3. Prompts for a new cellar name (pre-filled with "Meine Cantina")
4. Redirects to `/cellar` — now empty, banner gone

### Onboarding page (`/onboarding`)

**Removed.** The family + cellar are now auto-created on first login. The middleware redirect to `/onboarding` for users without a family is replaced by the auto-seeding logic.

---

## Out of Scope

- Shared/global demo cellar (per-user copy is better UX)
- Resetting demo data after partial exploration
- Demo mode for invited family members (they join an existing real cellar)
