import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError } from '@/lib/api/auth'
import type { WineType } from '@/lib/types'

export type DiscoveryInsert = {
  cellar_id: string
  created_by: string
  name: string
  producer: string | null
  vintage: number | null
  type: WineType | null
  location_text: string | null
  trip_id: string | null
  date: string
  rating: number | null
  notes: string | null
  price: number | null
}

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling']

/**
 * Validates a PUT /api/v1/discoveries/[id] body. created_by is the local
 * writer's own user id, same trust level as tastings.user_id (see
 * lib/api/tasting.ts) -- not re-checked against the authenticated caller
 * here, only used for display attribution; authorization is entirely via
 * requireOwnCellar on cellar_id.
 */
export function parseDiscoveryInsert(body: unknown): DiscoveryInsert | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const cellarId = typeof b.cellar_id === 'string' ? b.cellar_id : null
  const createdBy = typeof b.created_by === 'string' ? b.created_by : null
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const date = typeof b.date === 'string' ? b.date : null
  if (!cellarId || !createdBy || !name || !date) return null

  if ('producer' in b && b.producer != null && typeof b.producer !== 'string') return null
  if ('vintage' in b && b.vintage != null && !Number.isInteger(b.vintage)) return null
  if ('type' in b && b.type != null && !WINE_TYPES.includes(b.type as WineType)) return null
  if ('location_text' in b && b.location_text != null && typeof b.location_text !== 'string') return null
  if ('trip_id' in b && b.trip_id != null && typeof b.trip_id !== 'string') return null
  if ('notes' in b && b.notes != null && typeof b.notes !== 'string') return null
  if ('price' in b && b.price != null && typeof b.price !== 'number') return null

  const rating = b.rating
  if ('rating' in b && rating != null) {
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) return null
  }

  return {
    cellar_id: cellarId,
    created_by: createdBy,
    name,
    producer: typeof b.producer === 'string' ? b.producer.trim() || null : null,
    vintage: typeof b.vintage === 'number' ? b.vintage : null,
    type: b.type != null ? (b.type as WineType) : null,
    location_text: typeof b.location_text === 'string' ? b.location_text.trim() || null : null,
    trip_id: typeof b.trip_id === 'string' ? b.trip_id : null,
    date,
    rating: rating != null ? (rating as number) : null,
    notes: typeof b.notes === 'string' ? b.notes.trim() || null : null,
    price: typeof b.price === 'number' ? b.price : null,
  }
}

/**
 * Resolves the family that owns a discovery, for the photo sub-resource
 * routes (app/api/v1/discoveries/[id]/photo/route.ts) -- mirrors
 * resolveWineFamily in lib/api/wine.ts.
 */
export async function resolveDiscoveryFamily(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  discoveryId: string,
): Promise<{ familyId: string; cellarId: string }> {
  const { data: ctx } = await admin
    .rpc('get_cellar_context', { p_user_id: userId })
    .maybeSingle<{ family_id: string; cellar_id: string | null }>()
  if (!ctx?.cellar_id) throw new ApiAuthError('Kein Keller gefunden', 403)

  const { data: discovery } = await admin
    .from('discoveries').select('cellar_id').eq('id', discoveryId).maybeSingle()
  if (!discovery) throw new ApiAuthError('Entdeckung nicht gefunden', 404)
  if (discovery.cellar_id !== ctx.cellar_id) throw new ApiAuthError('Ungültige Entdeckung', 403)

  return { familyId: ctx.family_id, cellarId: ctx.cellar_id }
}
