import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveDiscoveryFamily } from '@/lib/api/discovery'
import { createAdminClient } from '@/lib/supabase/server'
import {
  BUCKET, ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, buildDiscoveryPhotoPath,
  isPhotoPathOwnedByFamily, isValidPhotoPath, isUuid,
} from '@/lib/storage/wine-photos'

// Bytes-only endpoint, mirrors app/api/v1/wines/[id]/photos/[photoId]/route.ts
// -- see that file's comment for the full rationale. `photoId` here is the
// same id as the discovery_photos row's `id` (app/api/v1/discovery_photos/[id]/route.ts),
// chosen client-side.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const { id, photoId } = await params
    if (!isUuid(id) || !isUuid(photoId)) return Response.json({ error: 'Ungültige ID' }, { status: 400 })

    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const { familyId } = await resolveDiscoveryFamily(admin, user.id, id)

    const contentType = request.headers.get('content-type') ?? ''
    const ext = ALLOWED_PHOTO_TYPES[contentType]
    if (!ext) return Response.json({ error: 'Format nicht unterstützt (JPEG, PNG, WebP, HEIC)' }, { status: 400 })

    const body = await request.arrayBuffer()
    if (body.byteLength === 0) return Response.json({ error: 'Kein Foto übermittelt' }, { status: 400 })
    if (body.byteLength > MAX_PHOTO_BYTES) return Response.json({ error: 'Foto zu groß (max 5 MB)' }, { status: 400 })

    const path = buildDiscoveryPhotoPath(familyId, id, photoId, ext)
    if (!isValidPhotoPath(path)) return Response.json({ error: 'Ungültiger Foto-Pfad' }, { status: 400 })

    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, body, { contentType, cacheControl: '31536000', upsert: true })
    if (error) return Response.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Storage-object removal only -- the discovery_photos row's own deletion is
// a separate, independent sync op (DELETE app/api/v1/discovery_photos/[id]/route.ts).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const { id, photoId } = await params
    if (!isUuid(id) || !isUuid(photoId)) return Response.json({ error: 'Ungültige ID' }, { status: 400 })

    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const { familyId } = await resolveDiscoveryFamily(admin, user.id, id)

    const { data: photo } = await admin
      .from('discovery_photos')
      .select('id, path')
      .eq('id', photoId)
      .eq('discovery_id', id)
      .maybeSingle()
    if (!photo) return new Response(null, { status: 204 })

    if (isValidPhotoPath(photo.path) && isPhotoPathOwnedByFamily(photo.path, familyId)) {
      await admin.storage.from(BUCKET).remove([photo.path])
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
