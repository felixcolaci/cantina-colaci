import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveWineFamily } from '@/lib/api/wine'
import { createAdminClient } from '@/lib/supabase/server'
import {
  signPhotoPath, signPhotoPaths, buildWinePhotoPath, ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES,
} from '@/lib/storage/wine-photos'

type WinePhotoRow = { id: string; path: string }

// wine_photos is deliberately not a PowerSync-synced table (binary-heavy,
// see lib/powersync/schema.ts's comment) -- this is a plain REST resource
// the SPA reads/writes directly (lib/spa/api-client.ts's apiGet/apiUpload),
// not something the PowerSync upload connector ever touches.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    const familyId = await resolveWineFamily(admin, user.id, id)

    const { data, error } = await admin
      .from('wine_photos')
      .select('id, path')
      .eq('wine_id', id)
      .order('sort_order', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as WinePhotoRow[]
    const signed = await signPhotoPaths(admin, rows.map(row => row.path), familyId)
    const photos = rows
      .map(row => ({ id: row.id, url: signed.get(row.path) ?? null }))
      .filter((photo): photo is { id: string; url: string } => photo.url !== null)

    return Response.json({ photos })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Upload a new photo (multipart/form-data, field "photo"). sort_order is just
// the current photo count -- good enough for append-only uploads; nothing
// here ever reorders existing photos.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    const familyId = await resolveWineFamily(admin, user.id, id)

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('photo')
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: 'Kein Foto ausgewählt' }, { status: 400 })
    }
    const ext = ALLOWED_PHOTO_TYPES[file.type]
    if (!ext) {
      return Response.json({ error: 'Format nicht unterstützt (JPEG, PNG, WebP, HEIC)' }, { status: 400 })
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: 'Foto zu groß (max 5 MB)' }, { status: 400 })
    }

    const { count } = await admin
      .from('wine_photos')
      .select('*', { count: 'exact', head: true })
      .eq('wine_id', id)

    const photoId = crypto.randomUUID()
    const path = buildWinePhotoPath(familyId, id, photoId, ext)
    const { error: uploadError } = await admin.storage
      .from('wine-photos')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (uploadError) return Response.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })

    const { error: insertError } = await admin
      .from('wine_photos')
      .insert({ id: photoId, wine_id: id, path, sort_order: count ?? 0 })
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    const url = await signPhotoPath(admin, path, familyId)
    return Response.json({ id: photoId, url }, { status: 201 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
