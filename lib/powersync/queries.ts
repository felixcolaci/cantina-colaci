'use client'

import { useQuery } from '@powersync/react'
import type { WineType } from '@/lib/types'

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
