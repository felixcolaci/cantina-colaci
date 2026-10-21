import { requireApiUser, requireOwnCellar, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'

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

    const admin = createAdminClient()
    const { data: wine } = await admin.from('wines').select('cellar_id').eq('id', wineId).maybeSingle()
    if (!wine) return Response.json({ error: 'Wein nicht gefunden' }, { status: 404 })
    await requireOwnCellar(admin, user, wine.cellar_id)

    // insert(), not upsert() -- see the same note in
    // app/api/v1/wines/[id]/route.ts. A 23505 means this id already landed.
    const { error } = await admin.from('skus').insert({
      id,
      wine_id: wineId,
      vintage: vintage ?? null,
      quantity,
      storage_location_id: null,
      status: 'in_stock',
      purchase_price: null,
      purchase_date: null,
      purchase_location: null,
      shelf_location: null,
      trip_id: null,
      photo_path: null,
    })
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
