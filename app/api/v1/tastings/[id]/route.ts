import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { parseTastingInsert, requireOwnCellarForSku } from '@/lib/api/tasting'

// Insert-only, same scope as app/api/v1/skus/[id]/route.ts: the PowerSync
// upload connector's target for a local `tastings` row's first upload.
// Ownership runs through the tasting's sku (cellar_entry_id) rather than a
// direct cellar_id, since tastings don't carry one.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const fields = parseTastingInsert(body)
    if (!fields) return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })

    const admin = createAdminClient()
    await requireOwnCellarForSku(admin, user, fields.cellar_entry_id)

    // insert(), not upsert() -- see the same note in
    // app/api/v1/wines/[id]/route.ts. A 23505 means this id already landed.
    //
    // user_id is overridden from the verified session, not trusted from
    // fields.user_id -- the body's value is only needed so the local
    // PowerSync row (written before this route ever runs) has something to
    // display immediately; without this override, any family member could
    // attribute a tasting to a different member.
    const { error } = await admin.from('tastings').insert({ ...fields, id, user_id: user.id })
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
