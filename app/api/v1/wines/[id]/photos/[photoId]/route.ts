import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveWineFamily } from '@/lib/api/wine'
import { createAdminClient } from '@/lib/supabase/server'
import { isPhotoPathOwnedByFamily } from '@/lib/storage/wine-photos'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const user = await requireApiUser(request)
    const { id, photoId } = await params
    const admin = createAdminClient()
    const familyId = await resolveWineFamily(admin, user.id, id)

    const { data: photo } = await admin
      .from('wine_photos')
      .select('id, path')
      .eq('id', photoId)
      .eq('wine_id', id)
      .maybeSingle()
    if (!photo) return Response.json({ error: 'Foto nicht gefunden' }, { status: 404 })

    // path is a DB column a family member can reach via a direct PostgREST
    // update to their own row -- only ever delete a storage object that's
    // actually this family's. An out-of-scope value just skips the storage
    // delete; the DB row still gets removed below.
    if (isPhotoPathOwnedByFamily(photo.path, familyId)) {
      await admin.storage.from('wine-photos').remove([photo.path])
    }
    await admin.from('wine_photos').delete().eq('id', photoId)

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
