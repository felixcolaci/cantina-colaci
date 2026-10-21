import type { User } from '@supabase/supabase-js'
import type { EntryStatus } from '@/lib/types'
import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError, requireOwnCellar } from '@/lib/api/auth'

const SKU_PATCH_STATUSES: EntryStatus[] = ['in_stock', 'consumed', 'gifted']

export type SkuInsertExtra = {
  storage_location_id: string | null
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
}

/**
 * Validates the optional fields on top of a PUT /api/v1/skus/[id] insert
 * (wine_id/quantity/vintage are validated inline by the route, unchanged
 * since they're required). Every field here is optional and defaults to
 * null, matching the legacy addSku action's shape (lib/actions/skus.ts).
 */
export function parseSkuInsertExtra(body: unknown): SkuInsertExtra | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const extra: SkuInsertExtra = {
    storage_location_id: null,
    purchase_price: null,
    purchase_date: null,
    purchase_location: null,
    shelf_location: null,
  }

  if ('storage_location_id' in b && b.storage_location_id != null) {
    if (typeof b.storage_location_id !== 'string') return null
    extra.storage_location_id = b.storage_location_id
  }
  if ('purchase_price' in b && b.purchase_price != null) {
    if (typeof b.purchase_price !== 'number' || !Number.isFinite(b.purchase_price)) return null
    extra.purchase_price = b.purchase_price
  }
  for (const key of ['purchase_date', 'purchase_location', 'shelf_location'] as const) {
    if (key in b && b[key] != null) {
      if (typeof b[key] !== 'string') return null
      extra[key] = b[key] as string
    }
  }

  return extra
}

export type SkuPatchFields = {
  quantity?: number
  status?: EntryStatus
}

/**
 * Validates a PATCH /api/v1/skus/[id] body. Currently only used by the
 * "open bottle" action (app/app/open-bottle-button.tsx), which only ever
 * sends quantity + status together -- but each field is independently
 * optional/validated the same way parseWinePatch treats wines, so a future
 * caller (e.g. editing an existing sku's purchase details) can PATCH a
 * subset without this needing to change.
 */
export function parseSkuPatch(body: unknown): SkuPatchFields | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const fields: SkuPatchFields = {}

  if ('quantity' in b) {
    if (!Number.isInteger(b.quantity) || (b.quantity as number) < 0) return null
    fields.quantity = b.quantity as number
  }
  if ('status' in b) {
    if (!SKU_PATCH_STATUSES.includes(b.status as EntryStatus)) return null
    fields.status = b.status as EntryStatus
  }

  return fields
}

/**
 * Shared ownership resolver for a sku identified only by its wine: skus
 * don't carry a cellar_id directly, so every /api/v1/skus/[id] handler
 * (PUT's insert, PATCH's update) walks wine_id -> wines.cellar_id and then
 * reuses the same requireOwnCellar check every other write route applies.
 */
export async function requireOwnCellarForWine(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
  wineId: string,
): Promise<void> {
  const { data: wine } = await admin.from('wines').select('cellar_id').eq('id', wineId).maybeSingle()
  if (!wine) throw new ApiAuthError('Wein nicht gefunden', 404)
  await requireOwnCellar(admin, user, wine.cellar_id)
}
