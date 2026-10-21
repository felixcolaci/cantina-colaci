import { requireApiUser, requireOwnCellar, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { parseStorageLocationInsert } from '@/lib/api/storage-location'

// Insert-only, same scope as app/api/v1/wines/[id]/route.ts: the PowerSync
// upload connector's target for a local `storage_locations` row's first
// upload. storage_locations carries cellar_id directly, so ownership is a
// plain requireOwnCellar call -- no FK walk needed like skus' wine_id.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const fields = parseStorageLocationInsert(body)
    if (!fields) return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })

    const admin = createAdminClient()
    await requireOwnCellar(admin, user, fields.cellar_id)

    // insert(), not upsert() -- see the same note in
    // app/api/v1/wines/[id]/route.ts. A 23505 means this id already landed.
    const { error } = await admin.from('storage_locations').insert({ id, ...fields })
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
