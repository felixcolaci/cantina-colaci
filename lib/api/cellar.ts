import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError } from '@/lib/api/auth'
import { DEMO_WINES, DEMO_STORAGE_LOCATIONS, DEMO_TRIP } from '@/lib/seed/demo-data'

type AdminClient = ReturnType<typeof createAdminClient>

export type CreateCellarInput = { name: string; seed: boolean }

/**
 * Validates a POST /api/v1/cellars body: name required (trimmed, capped
 * at 60 chars like onboarding's cellarName), seed optional and defaults
 * to false.
 */
export function parseCreateCellarBody(body: unknown): CreateCellarInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : ''
  if (!name) return null

  if ('seed' in b && typeof b.seed !== 'boolean') return null

  return { name, seed: b.seed === true }
}

export type CellarRename = { name: string }

/**
 * Validates a PATCH /api/v1/cellars/[id] body: the only field a cellar can
 * ever be patched with is its name (app/app/edit-cellar-name-sheet.tsx) --
 * same trim-and-cap-at-60 shape as a fresh create (parseCreateCellarBody).
 */
export function parseCellarRename(body: unknown): CellarRename | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  if (typeof b.name !== 'string') return null
  const name = b.name.trim().slice(0, 60)
  if (!name) return null

  return { name }
}

/**
 * Confirms `cellarId` actually belongs to `familyId` before it's allowed
 * into a cross-table reference -- family_members.current_cellar_id (cellar
 * switching) or a delete target (cellar deletion). The same ownership
 * boundary requireOwnCellar gives the synced tables, but keyed by family
 * rather than by the caller's own already-resolved cellar.
 */
export async function requireCellarInFamily(admin: AdminClient, cellarId: string, familyId: string): Promise<void> {
  const { data } = await admin.from('cellars').select('id').eq('id', cellarId).eq('family_id', familyId).maybeSingle()
  if (!data) throw new ApiAuthError('Ungültiger Keller', 403)
}

/**
 * Populates a brand-new cellar with the same example wines, storage
 * locations, trip and tastings as the onboarding demo cellar
 * (seedDemoCellar, legacy/lib/seed/seed-demo-cellar.ts) -- minus the
 * family/cellar creation and is_demo flag, since this is a one-time
 * content seed for an additional cellar, not the family-wide "demo mode"
 * families.is_demo already tracks. The cellar this writes into is never
 * marked is_demo.
 */
export async function seedCellarWithDemoWines(admin: AdminClient, cellarId: string, userId: string): Promise<void> {
  const { data: locations, error: locationsError } = await admin
    .from('storage_locations')
    .insert(DEMO_STORAGE_LOCATIONS.map(loc => ({ ...loc, cellar_id: cellarId })))
    .select()
  if (locationsError) throw locationsError
  if (!locations) return

  const { data: trips, error: tripError } = await admin
    .from('trips')
    .insert([{ ...DEMO_TRIP, cellar_id: cellarId }])
    .select()
  if (tripError) throw tripError
  const demoTrip = trips?.[0] ?? null

  const { data: wines, error: winesError } = await admin
    .from('wines')
    .insert(DEMO_WINES.map(demoWine => ({
      cellar_id: cellarId,
      name: demoWine.name,
      producer: demoWine.producer,
      type: demoWine.type,
      region: demoWine.region,
      country: demoWine.country,
      grape_variety: demoWine.grape_variety,
      notes: demoWine.notes,
    })))
    .select()
  if (winesError) throw winesError
  if (!wines) return

  // Relies on a single multi-row INSERT ... RETURNING preserving the input
  // order, which both Postgres and PostgREST do -- same assumption
  // seedDemoCellar makes to line up skus with the wines just inserted.
  const { data: entries, error: entriesError } = await admin
    .from('skus')
    .insert(DEMO_WINES.map((demoWine, i) => {
      const wine = wines[i]
      const location = locations[demoWine.storageLocationIndex]
      const trip = demoWine.tripIndex !== null ? demoTrip : null

      return {
        wine_id: wine.id,
        vintage: demoWine.vintage,
        quantity: demoWine.quantity,
        purchase_price: demoWine.purchase_price,
        purchase_location: demoWine.purchase_location,
        storage_location_id: location?.id ?? null,
        trip_id: trip?.id ?? null,
        photo_path: demoWine.demoPhotoPath,
        status: 'in_stock',
      }
    }))
    .select()
  if (entriesError) throw entriesError
  if (!entries) return

  const tastingRows = DEMO_WINES
    .map((demoWine, i) => ({ demoWine, entry: entries[i] }))
    .filter(({ demoWine }) => demoWine.tasting !== null)
    .map(({ demoWine, entry }) => ({
      cellar_entry_id: entry.id,
      user_id: userId,
      date: '2026-06-01',
      rating: demoWine.tasting!.rating,
      notes: demoWine.tasting!.notes,
    }))

  if (tastingRows.length > 0) {
    const { error: tastingsError } = await admin.from('tastings').insert(tastingRows)
    if (tastingsError) throw tastingsError
  }
}
