import type { StorageLocationType } from '@/lib/types'

export const STORAGE_LOCATION_TYPES: StorageLocationType[] = ['fridge', 'cellar', 'climate_cabinet', 'other']

export type StorageLocationInsert = {
  cellar_id: string
  name: string
  type: StorageLocationType
}

/**
 * Validates a PUT /api/v1/storage_locations/[id] body. Mirrors the legacy
 * createLocation action's shape (legacy/lib/actions/storage-locations.ts):
 * name + type are required, cellar_id is required so the route can run the
 * usual requireOwnCellar check before the insert lands.
 */
export function parseStorageLocationInsert(body: unknown): StorageLocationInsert | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const cellarId = typeof b.cellar_id === 'string' ? b.cellar_id : null
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const type = b.type as StorageLocationType

  if (!cellarId || !name || !STORAGE_LOCATION_TYPES.includes(type)) return null

  return { cellar_id: cellarId, name, type }
}
