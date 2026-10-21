export type TripInsert = {
  cellar_id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
}

/**
 * Validates a PUT /api/v1/trips/[id] body. Mirrors the legacy createTrip
 * action's shape (legacy/lib/actions/trips.ts): name + cellar_id required,
 * everything else optional. Dates are trusted as plain strings, same level
 * of validation as purchase_date on skus (lib/api/sku.ts) -- the DatePicker
 * component already emits ISO 'YYYY-MM-DD', so there's no legacy dd.mm.yyyy
 * input path to re-parse here.
 */
export function parseTripInsert(body: unknown): TripInsert | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const cellarId = typeof b.cellar_id === 'string' ? b.cellar_id : null
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!cellarId || !name) return null

  if ('location' in b && b.location != null && typeof b.location !== 'string') return null
  if ('date_start' in b && b.date_start != null && typeof b.date_start !== 'string') return null
  if ('date_end' in b && b.date_end != null && typeof b.date_end !== 'string') return null

  const location = typeof b.location === 'string' ? b.location.trim() || null : null

  return {
    cellar_id: cellarId,
    name,
    location,
    date_start: typeof b.date_start === 'string' ? b.date_start : null,
    date_end: typeof b.date_end === 'string' ? b.date_end : null,
  }
}
