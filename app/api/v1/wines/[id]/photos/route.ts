import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveWineFamily } from '@/lib/api/wine'
import { createAdminClient } from '@/lib/supabase/server'

type WinePhotoRow = { id: string; path: string }

// wine_photos is a PowerSync-synced table (metadata only -- see
// lib/powersync/schema.ts's comment); this GET is a convenience for
// non-PowerSync contexts (e.g. a fresh server render). Upload/delete of the
// actual bytes now go through app/api/v1/wines/[id]/photos/[photoId]
// (PUT/DELETE), driven by the AttachmentQueue (lib/powersync/attachment-queues.ts),
// not this route.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    await resolveWineFamily(admin, user.id, id)

    const { data, error } = await admin
      .from('wine_photos')
      .select('id, path')
      .eq('wine_id', id)
      .order('sort_order', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const photos = ((data ?? []) as WinePhotoRow[]).map(row => ({
      id: row.id,
      url: `/api/v1/photos/${row.path}`,
    }))

    return Response.json({ photos })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
