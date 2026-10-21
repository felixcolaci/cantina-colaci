import { requireApiUser, requireOwnCellar, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { parseWinePatch } from '@/lib/api/wine'
import type { WineType } from '@/lib/types'

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling']

// Insert-only: this is the PowerSync upload connector's target for a local
// `wines` row's first upload (UpdateType.PUT, see lib/powersync/connector.ts).
// Editing an existing wine is a later migration's concern (PATCH).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const cellarId = typeof body?.cellar_id === 'string' ? body.cellar_id : null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const type = body?.type as WineType
    if (!cellarId || !name || !WINE_TYPES.includes(type)) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const admin = createAdminClient()
    await requireOwnCellar(admin, user, cellarId)

    // producer is NOT NULL in Postgres -- defaults to '' rather than null for
    // a blank field.
    //
    // insert(), not upsert(): requireOwnCellar only validates the cellarId
    // the caller supplied, not whatever cellar `id` might already belong to
    // -- an upsert would let a guessed/known id silently overwrite another
    // family's existing row. A 23505 (unique_violation) means this exact id
    // already landed (e.g. a retried upload), which is fine to treat as a
    // no-op rather than an error.
    const { error } = await admin.from('wines').insert({
      id,
      cellar_id: cellarId,
      name,
      producer: typeof body?.producer === 'string' ? body.producer.trim() : '',
      type,
      region: null,
      country: null,
      grape_variety: null,
      notes: null,
    })
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Edit path for an existing wine: the PowerSync upload connector's target for
// a local `wines` row's UPDATE (UpdateType.PATCH, see lib/powersync/connector.ts).
// Unlike PUT above, this is a real update -- every field is optional (only
// the columns the local UPDATE actually touched are present) and an existing
// row is required.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const fields = parseWinePatch(body)
    if (!fields || Object.keys(fields).length === 0) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: existing } = await admin.from('wines').select('cellar_id').eq('id', id).maybeSingle()
    if (!existing) return Response.json({ error: 'Wein nicht gefunden' }, { status: 404 })
    await requireOwnCellar(admin, user, existing.cellar_id)

    const { error } = await admin.from('wines').update(fields).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
