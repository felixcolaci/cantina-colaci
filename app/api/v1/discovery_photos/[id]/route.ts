import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveDiscoveryFamily } from '@/lib/api/discovery'
import { createAdminClient } from '@/lib/supabase/server'
import { isPhotoPathOwnedByFamily, isValidPhotoPath, isUuid } from '@/lib/storage/wine-photos'

// Target of the PowerSync upload connector for a local discovery_photos row
// -- metadata only, see app/api/v1/wine_photos/[id]/route.ts's comment for
// the full rationale (same pattern, discoveries instead of wines). Single-
// slot replace semantics (delete-old-then-insert-new) are enforced
// client-side in the same local transaction, not here.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return Response.json({ error: 'Ungültige ID' }, { status: 400 })

    const user = await requireApiUser(request)
    const body = await request.json().catch(() => null)

    const discoveryId = typeof body?.discovery_id === 'string' ? body.discovery_id : null
    const path = typeof body?.path === 'string' ? body.path : null
    const createdAt = typeof body?.created_at === 'string' ? body.created_at : null
    if (!discoveryId || !path || !createdAt) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { familyId } = await resolveDiscoveryFamily(admin, user.id, discoveryId)

    if (!isValidPhotoPath(path) || !isPhotoPathOwnedByFamily(path, familyId)) {
      return Response.json({ error: 'Ungültiger Foto-Pfad' }, { status: 400 })
    }

    const { error } = await admin
      .from('discovery_photos')
      .insert({ id, discovery_id: discoveryId, path, created_at: createdAt })
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

    const { data: existing } = await admin.from('discovery_photos').select('discovery_id').eq('id', id).maybeSingle()
    if (!existing) return new Response(null, { status: 204 })

    await resolveDiscoveryFamily(admin, user.id, existing.discovery_id)

    const { error } = await admin.from('discovery_photos').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
