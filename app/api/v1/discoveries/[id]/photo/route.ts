import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveDiscoveryFamily } from '@/lib/api/discovery'
import { createAdminClient } from '@/lib/supabase/server'

// discovery_photos ist jetzt eine PowerSync-synchronisierte Tabelle
// (Metadaten, siehe lib/powersync/schema.ts) -- dieses GET ist eine
// Bequemlichkeit für Nicht-PowerSync-Kontexte. Hochladen/Löschen der
// eigentlichen Bytes läuft über app/api/v1/discoveries/[id]/photo/[photoId]
// (PUT/DELETE), getrieben von der AttachmentQueue
// (lib/powersync/attachment-queues.ts), nicht über diese Route. Höchstens
// ein Foto pro Entdeckung (unique auf discovery_id), daher singulär (GET
// liefert eine url oder null) statt einer Galerie wie bei wines.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    await resolveDiscoveryFamily(admin, user.id, id)

    const { data: photo } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    const url = photo ? `/api/v1/photos/${photo.path}` : null

    return Response.json({ url })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
