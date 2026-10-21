'use client'

import { useQuery } from '@powersync/react'
import type { EntryStatus, WineType } from '@/lib/types'

export type CellarWine = {
  id: string
  name: string
  producer: string
  type: WineType
  vintage: number | null
  totalBottles: number
}

type CellarWineRow = {
  wine_id: string
  name: string
  producer: string
  type: string
  sku_vintage: number | null
  sku_quantity: number | null
}

// A wine only counts as "in the cellar" once it has at least one sku that's
// still in stock -- same rule the legacy /cellar page applied server-side.
// The LEFT JOIN keeps wines with zero in-stock skus in the result set (as a
// single null-sku row) so they can be grouped away below, rather than
// vanishing silently from an INNER JOIN.
const BASE_SQL = `
  SELECT
    wines.id AS wine_id,
    wines.name AS name,
    wines.producer AS producer,
    wines.type AS type,
    skus.vintage AS sku_vintage,
    skus.quantity AS sku_quantity
  FROM wines
  LEFT JOIN skus ON skus.wine_id = wines.id AND skus.status = 'in_stock' AND skus.quantity > 0
  WHERE wines.cellar_id = ?
`

function groupByWine(rows: CellarWineRow[]): CellarWine[] {
  const byId = new Map<string, { name: string; producer: string; type: string; totalBottles: number; vintage: number | null }>()

  for (const row of rows) {
    if (row.sku_quantity == null) continue // no in-stock sku for this wine
    const entry = byId.get(row.wine_id) ?? {
      name: row.name,
      producer: row.producer,
      type: row.type,
      totalBottles: 0,
      vintage: null,
    }
    entry.totalBottles += row.sku_quantity
    if (row.sku_vintage != null && (entry.vintage == null || row.sku_vintage > entry.vintage)) {
      entry.vintage = row.sku_vintage
    }
    byId.set(row.wine_id, entry)
  }

  // Map preserves insertion order, which follows the SQL's `ORDER BY name`.
  return [...byId.entries()].map(([id, w]) => ({ id, ...w, type: w.type as WineType }))
}

export function useCellarWines(cellarId: string, type: WineType | null) {
  const sql = type ? `${BASE_SQL} AND wines.type = ? ORDER BY wines.name` : `${BASE_SQL} ORDER BY wines.name`
  const params = type ? [cellarId, type] : [cellarId]
  const { data, isLoading, error } = useQuery<CellarWineRow>(sql, params)

  return { wines: groupByWine(data), isLoading, error }
}

export type WineDetail = {
  id: string
  name: string
  producer: string
  type: WineType
  country: string | null
  region: string | null
  grapeVariety: string | null
  notes: string | null
}

export type WineDetailEntry = {
  id: string
  vintage: number | null
  quantity: number
  purchasePrice: number | null
  purchaseDate: string | null
  purchaseLocation: string | null
  shelfLocation: string | null
  status: EntryStatus
  storageLocationName: string | null
}

export type WineDetailTasting = {
  id: string
  date: string
  rating: number
  notes: string | null
}

type WineRow = {
  id: string
  name: string
  producer: string
  type: string
  country: string | null
  region: string | null
  grape_variety: string | null
  notes: string | null
}

type EntryRow = {
  id: string
  vintage: number | null
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  status: string
  storage_location_name: string | null
}

type TastingRow = {
  id: string
  date: string
  rating: number
  notes: string | null
}

const WINE_SQL = `SELECT id, name, producer, type, country, region, grape_variety, notes FROM wines WHERE id = ?`

// Every sku the wine has ever had, not just in-stock ones -- the detail
// screen splits in-stock out for the "Im Keller" list but needs the full
// history for the tastings join below (a tasting can point at a sku that's
// since been consumed or gifted).
const ENTRIES_SQL = `
  SELECT
    skus.id AS id,
    skus.vintage AS vintage,
    skus.quantity AS quantity,
    skus.purchase_price AS purchase_price,
    skus.purchase_date AS purchase_date,
    skus.purchase_location AS purchase_location,
    skus.shelf_location AS shelf_location,
    skus.status AS status,
    storage_locations.name AS storage_location_name
  FROM skus
  LEFT JOIN storage_locations ON storage_locations.id = skus.storage_location_id
  WHERE skus.wine_id = ?
  ORDER BY skus.created_at DESC
`

const TASTINGS_SQL = `
  SELECT tastings.id AS id, tastings.date AS date, tastings.rating AS rating, tastings.notes AS notes
  FROM tastings
  JOIN skus ON skus.id = tastings.cellar_entry_id
  WHERE skus.wine_id = ?
  ORDER BY tastings.date DESC
`

export function useWineDetail(wineId: string) {
  const wineQuery = useQuery<WineRow>(WINE_SQL, [wineId])
  const entriesQuery = useQuery<EntryRow>(ENTRIES_SQL, [wineId])
  const tastingsQuery = useQuery<TastingRow>(TASTINGS_SQL, [wineId])

  const wineRow = wineQuery.data[0] ?? null
  const wine: WineDetail | null = wineRow && {
    id: wineRow.id,
    name: wineRow.name,
    producer: wineRow.producer,
    type: wineRow.type as WineType,
    country: wineRow.country,
    region: wineRow.region,
    grapeVariety: wineRow.grape_variety,
    notes: wineRow.notes,
  }

  const entries: WineDetailEntry[] = entriesQuery.data.map(row => ({
    id: row.id,
    vintage: row.vintage,
    quantity: row.quantity,
    purchasePrice: row.purchase_price,
    purchaseDate: row.purchase_date,
    purchaseLocation: row.purchase_location,
    shelfLocation: row.shelf_location,
    status: row.status as EntryStatus,
    storageLocationName: row.storage_location_name,
  }))

  const tastings: WineDetailTasting[] = tastingsQuery.data.map(row => ({
    id: row.id,
    date: row.date,
    rating: row.rating,
    notes: row.notes,
  }))

  const isLoading = wineQuery.isLoading || entriesQuery.isLoading || tastingsQuery.isLoading

  return { wine, entries, tastings, isLoading }
}

export type CellarStats = {
  totalBottles: number
  distinctWines: number
  distinctOrigins: number
  byType: { type: WineType; bottles: number }[]
  totalValue: number | null
  avgRating: number | null
  ratedCount: number
  oldestVintage: number | null
  lastAdded: { wineName: string; vintage: number | null } | null
}

type StatsRow = {
  wine_id: string
  wine_name: string
  type: string
  region: string | null
  country: string | null
  quantity: number
  purchase_price: number | null
  vintage: number | null
  created_at: string
}

type RatingRow = { avg_rating: number | null; rated_count: number }

// In-stock skus joined with their wine, scoped to this cellar -- the same
// base shape as useCellarWines's BASE_SQL, but aggregated differently
// (across types/origins/value instead of grouped per-wine) so it stays a
// second query rather than overloading groupByWine's job.
const STATS_SQL = `
  SELECT
    wines.id AS wine_id,
    wines.name AS wine_name,
    wines.type AS type,
    wines.region AS region,
    wines.country AS country,
    skus.quantity AS quantity,
    skus.purchase_price AS purchase_price,
    skus.vintage AS vintage,
    skus.created_at AS created_at
  FROM skus
  JOIN wines ON wines.id = skus.wine_id
  WHERE wines.cellar_id = ? AND skus.status = 'in_stock' AND skus.quantity > 0
`

const RATING_SQL = `
  SELECT AVG(tastings.rating) AS avg_rating, COUNT(tastings.id) AS rated_count
  FROM tastings
  JOIN skus ON skus.id = tastings.cellar_entry_id
  JOIN wines ON wines.id = skus.wine_id
  WHERE wines.cellar_id = ?
`

// Everything the home screen's "Kellerstatistik" panel shows, aggregated
// client-side from one flat query -- cheaper than a SQL query per metric,
// and keeps the shape (one row per in-stock sku) easy to reason about.
export function useCellarStats(cellarId: string): CellarStats & { isLoading: boolean } {
  const statsQuery = useQuery<StatsRow>(STATS_SQL, [cellarId])
  const ratingQuery = useQuery<RatingRow>(RATING_SQL, [cellarId])

  const rows = statsQuery.data

  let totalBottles = 0
  let totalValue = 0
  let hasValue = false
  let oldestVintage: number | null = null
  const wineIds = new Set<string>()
  const origins = new Set<string>()
  const byTypeMap = new Map<string, number>()
  let lastAddedRow: StatsRow | null = null

  for (const row of rows) {
    totalBottles += row.quantity
    wineIds.add(row.wine_id)
    const origin = row.region ?? row.country
    if (origin) origins.add(origin)
    byTypeMap.set(row.type, (byTypeMap.get(row.type) ?? 0) + row.quantity)
    if (row.purchase_price != null) {
      totalValue += row.purchase_price * row.quantity
      hasValue = true
    }
    if (row.vintage != null && (oldestVintage == null || row.vintage < oldestVintage)) {
      oldestVintage = row.vintage
    }
    if (!lastAddedRow || row.created_at > lastAddedRow.created_at) lastAddedRow = row
  }

  const byType = [...byTypeMap.entries()]
    .map(([type, bottles]) => ({ type: type as WineType, bottles }))
    .sort((a, b) => b.bottles - a.bottles)

  const ratingRow = ratingQuery.data[0] ?? null

  return {
    totalBottles,
    distinctWines: wineIds.size,
    distinctOrigins: origins.size,
    byType,
    totalValue: hasValue ? totalValue : null,
    avgRating: ratingRow?.avg_rating ?? null,
    ratedCount: ratingRow?.rated_count ?? 0,
    oldestVintage,
    lastAdded: lastAddedRow ? { wineName: lastAddedRow.wine_name, vintage: lastAddedRow.vintage } : null,
    isLoading: statsQuery.isLoading || ratingQuery.isLoading,
  }
}

export type StorageLocation = {
  id: string
  name: string
}

const STORAGE_LOCATIONS_SQL = `SELECT id, name FROM storage_locations WHERE cellar_id = ? ORDER BY name`

// Read-only picker for AddSkuSheet (app/app/add-sku-sheet.tsx) -- managing
// storage locations themselves (create/rename) is a separate migration.
export function useStorageLocations(cellarId: string) {
  const { data, isLoading, error } = useQuery<StorageLocation>(STORAGE_LOCATIONS_SQL, [cellarId])
  return { storageLocations: data, isLoading, error }
}

export type StorageLocationWithType = StorageLocation & { type: StorageLocationTypeValue }

type StorageLocationTypeValue = 'fridge' | 'cellar' | 'climate_cabinet' | 'other'

const STORAGE_LOCATIONS_WITH_TYPE_SQL = `SELECT id, name, type FROM storage_locations WHERE cellar_id = ? ORDER BY name`

// Full read for the Lagerorte settings screen (app/app/storage-locations-screen.tsx).
export function useStorageLocationsSettings(cellarId: string) {
  const { data, isLoading, error } = useQuery<StorageLocationWithType>(STORAGE_LOCATIONS_WITH_TYPE_SQL, [cellarId])
  return { storageLocations: data, isLoading, error }
}

type OwnFamilyMemberRow = { id: string; display_name: string | null }

const OWN_FAMILY_MEMBER_SQL = `SELECT id, display_name FROM family_members WHERE user_id = ?`

// The caller's own family_members row -- just enough to drive
// EditNameSheet's local-first UPDATE (app/app/family-screen.tsx). Everyone
// else's email/display name comes from GET /api/v1/family instead, since
// resolving another member's email needs a privileged admin call that has
// no business running on-device.
export function useOwnFamilyMember(userId: string) {
  const { data, isLoading } = useQuery<OwnFamilyMemberRow>(OWN_FAMILY_MEMBER_SQL, [userId])
  const row = data[0] ?? null
  return { id: row?.id ?? null, displayName: row?.display_name ?? null, isLoading }
}

type CellarRow = { name: string }

const CELLAR_SQL = `SELECT name FROM cellars WHERE id = ?`

// Cellar name for the settings/cellar screen's heading and its reset
// sheet's type-to-confirm check. Role/is_demo for that screen come from
// GET /api/v1/family instead (already fetched by FamilyScreen too, so the
// two screens share the ['family'] query cache) -- no separate local read
// needed for those.
export function useCellar(cellarId: string) {
  const { data, isLoading } = useQuery<CellarRow>(CELLAR_SQL, [cellarId])
  return { name: data[0]?.name ?? null, isLoading }
}

export type TripSummary = {
  id: string
  name: string
  location: string | null
  dateStart: string | null
  dateEnd: string | null
  wineCount: number
}

type TripRow = {
  id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
  wine_count: number
}

// wine_count is scoped to in-stock skus tagged with this trip -- a wine
// whose trip bottles have since all been consumed drops off the list, same
// simplification useTripDetail's wines query makes (see its comment).
const TRIPS_SQL = `
  SELECT
    trips.id AS id,
    trips.name AS name,
    trips.location AS location,
    trips.date_start AS date_start,
    trips.date_end AS date_end,
    (
      SELECT COUNT(DISTINCT skus.wine_id) FROM skus
      WHERE skus.trip_id = trips.id AND skus.status = 'in_stock' AND skus.quantity > 0
    ) AS wine_count
  FROM trips
  WHERE trips.cellar_id = ?
  ORDER BY trips.created_at DESC
`

export function useTrips(cellarId: string) {
  const { data, isLoading, error } = useQuery<TripRow>(TRIPS_SQL, [cellarId])
  const trips: TripSummary[] = data.map(row => ({
    id: row.id,
    name: row.name,
    location: row.location,
    dateStart: row.date_start,
    dateEnd: row.date_end,
    wineCount: row.wine_count,
  }))
  return { trips, isLoading, error }
}

export type TripDetail = {
  id: string
  name: string
  location: string | null
  dateStart: string | null
  dateEnd: string | null
}

export type TripStats = {
  totalBottles: number
  avgRating: number | null
  totalSpend: number | null
}

type TripDetailRow = {
  id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
}

type TripStatsRow = {
  total_bottles: number
  avg_rating: number | null
  total_spend: number | null
}

const TRIP_SQL = `SELECT id, name, location, date_start, date_end FROM trips WHERE id = ?`

// Wines shown on a trip's page are scoped to skus actually tagged with this
// trip_id and still in stock -- deliberately narrower than the legacy page,
// which showed every sku of any wine that had ever had a trip-tagged sku
// (so a wine bought again elsewhere would show up on an old trip's page
// too). Stats below use the same trip_id scoping, for the same reason.
const TRIP_WINES_SQL = `
  SELECT
    wines.id AS wine_id,
    wines.name AS name,
    wines.producer AS producer,
    wines.type AS type,
    skus.vintage AS sku_vintage,
    skus.quantity AS sku_quantity
  FROM skus
  JOIN wines ON wines.id = skus.wine_id
  WHERE skus.trip_id = ? AND skus.status = 'in_stock' AND skus.quantity > 0
  ORDER BY wines.name
`

const TRIP_STATS_SQL = `
  SELECT
    (SELECT COALESCE(SUM(quantity), 0) FROM skus WHERE trip_id = ? AND status = 'in_stock') AS total_bottles,
    (SELECT AVG(rating) FROM tastings JOIN skus ON skus.id = tastings.cellar_entry_id WHERE skus.trip_id = ?) AS avg_rating,
    (SELECT SUM(purchase_price) FROM skus WHERE trip_id = ? AND purchase_price IS NOT NULL) AS total_spend
`

export type TastingHistoryEntry = {
  id: string
  date: string
  rating: number
  notes: string | null
  wineId: string
  wineName: string
  wineProducer: string | null
  vintage: number | null
}

type TastingHistoryRow = {
  id: string
  date: string
  rating: number
  notes: string | null
  wine_id: string
  wine_name: string
  wine_producer: string | null
  vintage: number | null
}

const TASTINGS_HISTORY_SQL = `
  SELECT
    tastings.id AS id,
    tastings.date AS date,
    tastings.rating AS rating,
    tastings.notes AS notes,
    skus.wine_id AS wine_id,
    skus.vintage AS vintage,
    wines.name AS wine_name,
    wines.producer AS wine_producer
  FROM tastings
  JOIN skus ON skus.id = tastings.cellar_entry_id
  JOIN wines ON wines.id = skus.wine_id
  WHERE wines.cellar_id = ?
  ORDER BY tastings.date DESC
`

// Kellerchronik (app/app/history-screen.tsx): every tasting across the
// whole cellar, newest first, regardless of which wine or trip it belongs
// to -- mirrors legacy/app/(app)/history/page.tsx.
export function useTastingsHistory(cellarId: string) {
  const { data, isLoading, error } = useQuery<TastingHistoryRow>(TASTINGS_HISTORY_SQL, [cellarId])
  const tastings: TastingHistoryEntry[] = data.map(row => ({
    id: row.id,
    date: row.date,
    rating: row.rating,
    notes: row.notes,
    wineId: row.wine_id,
    wineName: row.wine_name,
    wineProducer: row.wine_producer,
    vintage: row.vintage,
  }))
  return { tastings, isLoading, error }
}

export function useTripDetail(tripId: string) {
  const tripQuery = useQuery<TripDetailRow>(TRIP_SQL, [tripId])
  const winesQuery = useQuery<CellarWineRow>(TRIP_WINES_SQL, [tripId])
  const statsQuery = useQuery<TripStatsRow>(TRIP_STATS_SQL, [tripId, tripId, tripId])

  const tripRow = tripQuery.data[0] ?? null
  const trip: TripDetail | null = tripRow && {
    id: tripRow.id,
    name: tripRow.name,
    location: tripRow.location,
    dateStart: tripRow.date_start,
    dateEnd: tripRow.date_end,
  }

  const wines = groupByWine(winesQuery.data)

  const statsRow = statsQuery.data[0] ?? null
  const stats: TripStats = {
    totalBottles: statsRow?.total_bottles ?? 0,
    avgRating: statsRow?.avg_rating ?? null,
    totalSpend: statsRow?.total_spend ?? null,
  }

  const isLoading = tripQuery.isLoading || winesQuery.isLoading || statsQuery.isLoading

  return { trip, wines, stats, isLoading }
}
