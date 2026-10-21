import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveDiscoveryFamily } from '@/lib/api/discovery'
import { createAdminClient } from '@/lib/supabase/server'
import {
  signPhotoPath, buildDiscoveryPhotoPath, ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, BUCKET,
} from '@/lib/storage/wine-photos'

// discovery_photos ist, wie wine_photos, bewusst nicht PowerSync-
// synchronisiert (binärlastig) -- die SPA spricht diese REST-Ressource
// direkt an (apiGet/apiUpload/apiMutate), nie über die lokale CRUD-Queue.
// Höchstens ein Foto pro Entdeckung (unique auf discovery_id), daher
// singulär (GET liefert eine url oder null) statt einer Galerie wie bei
// wines.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    const { familyId } = await resolveDiscoveryFamily(admin, user.id, id)

    const { data: photo } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    const url = photo ? await signPhotoPath(admin, photo.path, familyId) : null

    return Response.json({ url })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Ersetzt ein vorhandenes Foto (altes Storage-Objekt + Zeile zuerst
// löschen) -- es gibt nur einen Slot, anders als das anhängende POST der
// Wein-Galerie.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    const { familyId } = await resolveDiscoveryFamily(admin, user.id, id)

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('photo')
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: 'Kein Foto ausgewählt' }, { status: 400 })
    }
    const ext = ALLOWED_PHOTO_TYPES[file.type]
    if (!ext) return Response.json({ error: 'Format nicht unterstützt (JPEG, PNG, WebP, HEIC)' }, { status: 400 })
    if (file.size > MAX_PHOTO_BYTES) return Response.json({ error: 'Foto zu groß (max 5 MB)' }, { status: 400 })

    const { data: existing } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    if (existing) {
      await admin.storage.from(BUCKET).remove([existing.path])
      await admin.from('discovery_photos').delete().eq('discovery_id', id)
    }

    const photoId = crypto.randomUUID()
    const path = buildDiscoveryPhotoPath(familyId, id, photoId, ext)
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (uploadError) return Response.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })

    const { error: insertError } = await admin.from('discovery_photos').insert({ discovery_id: id, path })
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    const url = await signPhotoPath(admin, path, familyId)
    return Response.json({ url }, { status: 201 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    await resolveDiscoveryFamily(admin, user.id, id)

    const { data: existing } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    if (existing) {
      await admin.storage.from(BUCKET).remove([existing.path])
      await admin.from('discovery_photos').delete().eq('discovery_id', id)
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
