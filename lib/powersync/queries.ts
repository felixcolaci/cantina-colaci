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
