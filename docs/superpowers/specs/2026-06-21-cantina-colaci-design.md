# La Cantina Colaci — Design Spec

**Date:** 2026-06-21  
**Repository:** git@github.com:felixcolaci/cantina-colaci.git  
**Status:** Approved

---

## Overview

A Progressive Web App for cataloging and managing a personal wine collection. Primary users are Felix Colaci and Anna Goetz, with multi-account support so family members (parents, brother) can each maintain their own cellar. The app has an Italian character reflecting the family's heritage.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Hosting | Vercel |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (Magic Link / Google OAuth) |
| File Storage | Supabase Storage |
| UI Components | shadcn/ui |
| PWA / Service Worker | serwist |

---

## Data Model

### `families`
Top-level entity. Each family group (e.g. "Colaci", "Colaci Senior") owns one or more cellars.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Colaci" |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |

### `family_members`
Links users to families with a role.

| Column | Type | Notes |
|---|---|---|
| family_id | uuid | FK → families |
| user_id | uuid | FK → auth.users |
| role | text | `owner` \| `member` |
| joined_at | timestamptz | |

### `cellars`
A cellar belongs to a family. A family can have multiple cellars (e.g. main + holiday cellar).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK → families |
| name | text | e.g. "Hauptkeller Brunsbüttel" |
| created_at | timestamptz | |

### `wines`
The wine itself, independent of physical bottles.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| cellar_id | uuid | FK → cellars |
| name | text | Wine name |
| producer | text | Winery / producer |
| vintage | int | Year, nullable (NV wines) |
| region | text | e.g. "Toscana", "Barolo" |
| country | text | e.g. "Italy" |
| grape_variety | text | e.g. "Sangiovese" |
| type | text | `red` \| `white` \| `rosé` \| `sparkling` |
| notes | text | General notes |
| created_at | timestamptz | |

### `cellar_entries`
A physical bottle or group of bottles in a cellar.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| wine_id | uuid | FK → wines |
| quantity | int | Number of bottles |
| purchase_price | numeric | Per bottle, nullable |
| purchase_date | date | nullable |
| purchase_location | text | e.g. "Montalcino, Italy" |
| shelf_location | text | e.g. "Regal B / Reihe 3" |
| photo_url | text | Supabase Storage URL |
| trip_id | uuid | FK → trips, nullable |
| status | text | `in_stock` \| `consumed` \| `gifted` |
| created_at | timestamptz | |

### `tastings`
A tasting/consumption event for a cellar entry.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| cellar_entry_id | uuid | FK → cellar_entries |
| user_id | uuid | FK → auth.users |
| date | date | When opened |
| rating | int | 1–10 |
| notes | text | Tasting notes |
| created_at | timestamptz | |

### `trips`
Optional grouping of purchases from a shopping trip (e.g. Italy holiday).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| cellar_id | uuid | FK → cellars |
| name | text | e.g. "Toskana Mai 2026" |
| location | text | e.g. "Toscana, Italy" |
| date_start | date | nullable |
| date_end | date | nullable |
| created_at | timestamptz | |

---

## Access Control

Supabase Row Level Security (RLS) enforces all access rules:
- A user can only read/write data belonging to families they are a member of.
- All queries filter through `family_members` → `cellars` → `wines` / `cellar_entries`.

---

## Pages & Navigation

Mobile-first bottom navigation with 4 items. Family management is accessible via a profile menu (top-right avatar).

**Bottom Navigation:**

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Stats: total bottles, recent additions, latest tastings |
| `/cellar` | Cellar | Current inventory, filterable by type / region / vintage |
| `/trips` | Trips | Shopping trips; purchases grouped per trip |
| `/history` | History | All consumed / gifted wines with ratings |

**Detail / Secondary Routes:**

| Route | Page | Description |
|---|---|---|
| `/wine/[id]` | Wine Detail | Info, photos, current bottles, tasting history |
| `/family` | Family | Invite members, manage cellars (via profile menu) |

---

## Key User Flows

### Add a Wine
1. Tap "+" → take photo or pick from gallery
2. Fill in details: name, producer, vintage, region, type, quantity, price, shelf location
3. Optionally assign to a trip
4. Save → appears in `/cellar`

### Open a Bottle
1. Find wine in `/cellar`
2. Tap "Flasche öffnen"
3. Enter rating (1–10) and tasting notes
4. Quantity decrements; if 0 → status becomes `consumed` → moves to `/history`

### Create a Trip
1. Go to `/trips` → "New Trip"
2. Enter name, location, dates
3. When adding wines, select trip from dropdown

---

## PWA & Offline

- **Service Worker (serwist)** caches app shell on install
- `/cellar` and `/history` pages are cached after first visit (read-only offline)
- Bottle photos are lazy-cached after first load
- Write actions (add wine, tasting) require internet — clear offline indicator shown in UI
- Supabase Auth session is persisted in localStorage → user stays logged in offline

## Photo Handling

- PWA `capture` API used to open camera directly on mobile
- Images compressed client-side to max 1MB before upload
- Stored in Supabase Storage under `families/{family_id}/wines/{wine_id}/`
- RLS on storage bucket mirrors database access rules

---

## Out of Scope (v1)

- Wine recommendation engine
- Barcode / label scanning (can be added later)
- Cross-family sharing / recommendations
- Drinking window / peak maturity tracking
- Export to PDF / CSV
