import type { WineType } from '@/lib/types'
import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError } from '@/lib/api/auth'

type CellarContextRow = { family_id: string; cellar_id: string | null }

export const WINE_PATCH_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling']

export type WinePatchFields = {
  name?: string
  producer?: string
  type?: WineType
  region?: string | null
  country?: string | null
  grape_variety?: string | null
  notes?: string | null
}

/**
 * Validates a PATCH /api/v1/wines/[id] body. Every field is optional -- the
 * PowerSync upload connector drains a local UPDATE as a PATCH carrying
 * whatever columns the CRUD op recorded, not necessarily the full row -- but
 * a field that IS present must still satisfy the same constraints as a
 * fresh insert (name/producer can't be patched blank, type must stay a
 * known enum value). Returns null for a malformed body or an invalid field;
 * an empty object (no fields present) is valid shape-wise but the caller
 * should still reject it as a no-op PATCH.
 */
export function parseWinePatch(body: unknown): WinePatchFields | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const fields: WinePatchFields = {}

  if ('name' in b) {
    if (typeof b.name !== 'string' || !b.name.trim()) return null
    fields.name = b.name.trim()
  }
  if ('producer' in b) {
    if (typeof b.producer !== 'string' || !b.producer.trim()) return null
    fields.producer = b.producer.trim()
  }
  if ('type' in b) {
    if (!WINE_PATCH_TYPES.includes(b.type as WineType)) return null
    fields.type = b.type as WineType
  }
  for (const key of ['region', 'country', 'grape_variety', 'notes'] as const) {
    if (key in b) {
      const value = b[key]
      if (value !== null && typeof value !== 'string') return null
      fields[key] = typeof value === 'string' ? value.trim() || null : null
    }
  }

  return fields
}

/**
 * Resolves the family a wine's photos belong to, after confirming the wine
 * is actually in the caller's own cellar. Shared by every /api/v1/wines/[id]/
 * photos* route, which all need the familyId for signing/building storage
 * paths (see lib/storage/wine-photos.ts) in addition to the usual ownership
 * check requireOwnCellar does for the synced tables.
 */
export async function resolveWineFamily(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  wineId: string,
): Promise<string> {
  const { data: ctx } = await admin
    .rpc('get_cellar_context', { p_user_id: userId })
    .maybeSingle<CellarContextRow>()
  if (!ctx?.cellar_id) throw new ApiAuthError('Kein Keller gefunden', 403)

  const { data: wine } = await admin.from('wines').select('cellar_id').eq('id', wineId).maybeSingle()
  if (!wine) throw new ApiAuthError('Wein nicht gefunden', 404)
  if (wine.cellar_id !== ctx.cellar_id) throw new ApiAuthError('Ungültiger Wein', 403)

  return ctx.family_id
}
