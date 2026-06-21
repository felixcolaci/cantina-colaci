# Storage Locations — Design Spec

**Date:** 2026-06-21
**Repository:** git@github.com:felixcolaci/cantina-colaci.git
**Status:** Approved
**Depends on:** `2026-06-21-cantina-colaci-design.md`

---

## Overview

Add named, typed storage locations to Cantina Colaci so users can track exactly where each bottle physically lives — fridge in the kitchen island, main cellar, climate cabinet under the stairs, etc. A bottle's location is a reference to a named location plus an optional free-text position within it.

---

## Data Model Change

### New table: `storage_locations`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| cellar_id | uuid | FK → cellars |
| name | text | e.g. "Klimaschrank Treppe" |
| type | text | `fridge` \| `cellar` \| `climate_cabinet` \| `other` |
| created_at | timestamptz | |

### Modified: `cellar_entries`

Add one nullable column:

| Column | Type | Notes |
|---|---|---|
| storage_location_id | uuid | FK → storage_locations, nullable, on delete set null |

The existing `shelf_location` text column stays — it becomes the position *within* the storage location (e.g. "Reihe 2, Fach B").

### RLS

Storage locations follow the same family-membership pattern as cellars: only family members of the owning cellar can read or write them.

---

## Pages & UI Changes

### New: `/settings/locations` — Manage Storage Locations

Accessible from the profile dropdown menu. Shows all locations for the current cellar with their type icon. Owner can create, rename, and delete locations.

Deleting a location sets `storage_location_id = null` on all affected entries (handled by `on delete set null` in the FK).

### Modified: `/cellar` — Add location filter

A second filter row (below the type filter) lists storage locations as pills. Selecting one filters the wine list to bottles stored there.

### Modified: `/wine/new` — Add location picker

The "Posizione in cantina" section gets a dropdown to select a named storage location, plus the existing free-text field for the exact position within it.

### Modified: `/wine/[id]` — Show location badge

Display the storage location name as a badge next to the bottle count.

---

## Out of Scope

- Multiple locations per bottle (one location per cellar_entry is sufficient)
- Capacity tracking per location (future)
- Map/diagram of cellar layout (future)
