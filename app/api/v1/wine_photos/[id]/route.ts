import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveWineFamily } from '@/lib/api/wine'
import { createAdminClient } from '@/lib/supabase/server'
import { isPhotoPathOwnedByFamily, isValidPhotoPath, isUuid } from '@/lib/storage/wine-photos'

// Target of the PowerSync upload connector (lib/powersync/connector.ts) for
// a local wine_photos row -- metadata only (id, wine_id, path, sort_order,
// created_at), never the photo bytes themselves. Those travel separately
// through the AttachmentQueue's own remote transport, which PUTs straight
// to app/api/v1/wines/[id]/photos/[photoId].
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return Response.json({ error: 'Ungültige ID' }, { status: 400 })

    const user = await requireApiUser(request)
    const body = await request.json().catch(() => null)

    const wineId = typeof body?.wine_id === 'string' ? body.wine_id : null
    const path = typeof body?.path === 'string' ? body.path : null
    const sortOrder = typeof body?.sort_order === 'number' ? body.sort_order : 0
    const createdAt = typeof body?.created_at === 'string' ? body.created_at : null
    if (!wineId || !path || !createdAt) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const admin = createAdminClient()
    const familyId = await resolveWineFamily(admin, user.id, wineId)

    // path is a client-chosen value riding the local CRUD queue -- a family
    // member could otherwise smuggle an arbitrary path into this row (same
    // concern lib/storage/wine-photos.ts's isPhotoPathOwnedByFamily doc
    // comment already flags for signing/deletion). isValidPhotoPath closes
    // the `..`/extra-`/` gap isPhotoPathOwnedByFamily's prefix check alone
    // doesn't catch.
    if (!isValidPhotoPath(path) || !isPhotoPathOwnedByFamily(path, familyId)) {
      return Response.json({ error: 'Ungültiger Foto-Pfad' }, { status: 400 })
    }

    // insert(), not upsert() -- same reasoning as app/api/v1/wines/[id]/route.ts.
    // 23505 means this exact id already landed (e.g. a retried upload).
    const { error } = await admin
      .from('wine_photos')
      .insert({ id, wine_id: wineId, path, sort_order: sortOrder, created_at: createdAt })
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin.from('wine_photos').select('wine_id').eq('id', id).maybeSingle()
    if (!existing) return new Response(null, { status: 204 }) // already gone -- ok

    await resolveWineFamily(admin, user.id, existing.wine_id)

    const { error } = await admin.from('wine_photos').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
