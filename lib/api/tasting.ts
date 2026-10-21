import type { User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError, requireOwnCellar } from '@/lib/api/auth'

export type TastingInsert = {
  cellar_entry_id: string
  user_id: string
  date: string
  rating: number
  notes: string | null
}

/**
 * Validates a PUT /api/v1/tastings/[id] body. Mirrors the legacy openBottle
 * action's tasting insert (legacy/lib/actions/tasting.ts): cellar_entry_id,
 * date and rating (1-5) are required, notes optional. user_id is supplied
 * by the client (it's just the local writer's id, same trust level as any
 * other PowerSync-synced row) but is NOT used for authorization -- that
 * still runs through requireOwnCellarForSku below, same as every other
 * write route.
 */
export function parseTastingInsert(body: unknown): TastingInsert | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const cellarEntryId = typeof b.cellar_entry_id === 'string' ? b.cellar_entry_id : null
  const userId = typeof b.user_id === 'string' ? b.user_id : null
  const date = typeof b.date === 'string' ? b.date : null
  const rating = b.rating
  if (!cellarEntryId || !userId || !date || !Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    return null
  }

  if ('notes' in b && b.notes != null && typeof b.notes !== 'string') return null
  const notes = typeof b.notes === 'string' ? b.notes.trim() || null : null

  return { cellar_entry_id: cellarEntryId, user_id: userId, date, rating: rating as number, notes }
}

/**
 * Shared ownership resolver for a tasting identified only by its sku
 * (cellar_entry_id): tastings don't carry a cellar_id directly, so this
 * walks cellar_entry_id -> skus.wine_id -> wines.cellar_id and reuses the
 * same requireOwnCellar check every other write route applies.
 */
export async function requireOwnCellarForSku(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
  skuId: string,
): Promise<void> {
  const { data: sku } = await admin.from('skus').select('wine_id').eq('id', skuId).maybeSingle()
  if (!sku) throw new ApiAuthError('Posten nicht gefunden', 404)

  const { data: wine } = await admin.from('wines').select('cellar_id').eq('id', sku.wine_id).maybeSingle()
  if (!wine) throw new ApiAuthError('Wein nicht gefunden', 404)

  await requireOwnCellar(admin, user, wine.cellar_id)
}
