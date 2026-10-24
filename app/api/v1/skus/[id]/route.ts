import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { parseSkuInsertExtra, parseSkuPatch, requireOwnCellarForWine, requireOwnStorageLocation } from '@/lib/api/sku'

// Insert-only, same scope as app/api/v1/wines/[id]/route.ts: the PowerSync
// upload connector's target for a local `skus` row's first upload. Ownership
// runs through the sku's wine rather than a direct cellar_id, since skus
// don't carry one -- wine_id -> wines.cellar_id -> requireOwnCellar.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const wineId = typeof body?.wine_id === 'string' ? body.wine_id : null
    const quantity = body?.quantity
    const vintage = body?.vintage
    if (
      !wineId ||
      !Number.isInteger(quantity) || quantity < 0 ||
      (vintage !== null && vintage !== undefined && !Number.isInteger(vintage))
    ) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const extra = parseSkuInsertExtra(body)
    if (!extra) return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })

    const admin = createAdminClient()
    const cellarId = await requireOwnCellarForWine(admin, user, wineId)
    if (extra.storage_location_id) {
      await requireOwnStorageLocation(admin, cellarId, extra.storage_location_id)
    }

    // insert(), not upsert() -- see the same note in
    // app/api/v1/wines/[id]/route.ts. A 23505 means this id already landed.
    const { error } = await admin.from('skus').insert({
      id,
      wine_id: wineId,
      vintage: vintage ?? null,
      quantity,
      status: 'in_stock',
      trip_id: null,
      photo_path: null,
      ...extra,
    })
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Edit path for an existing sku: the PowerSync upload connector's target for
// a local `skus` row's UPDATE (UpdateType.PATCH, see lib/powersync/connector.ts).
// Currently only driven by the "open bottle" action (app/app/open-bottle-button.tsx),
// which decrements quantity and flips status client-side, then lets this route
// persist exactly those two columns -- it doesn't (yet) write a tasting row the
// way the legacy openBottle action did in one transaction; that's the tasting-
// migration's job to add back, either here or alongside its own insert.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const fields = parseSkuPatch(body)
    if (!fields || Object.keys(fields).length === 0) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: existing } = await admin.from('skus').select('wine_id').eq('id', id).maybeSingle()
    if (!existing) return Response.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
    await requireOwnCellarForWine(admin, user, existing.wine_id)

    const { error } = await admin.from('skus').update(fields).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Drained by the connector as UpdateType.DELETE at the same route -- same
// not-found-is-ok shape as app/api/v1/wines/[id]/route.ts's DELETE, since a
// whole-wine delete queues this for every one of its skus too and may well
// race Postgres's own cascade from the wines delete.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin.from('skus').select('wine_id').eq('id', id).maybeSingle()
    if (!existing) return new Response(null, { status: 204 }) // already gone -- ok
    await requireOwnCellarForWine(admin, user, existing.wine_id)

    const { error } = await admin.from('skus').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
