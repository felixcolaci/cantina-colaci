import { requireApiUser, requireOwnCellar, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import type { WineType } from '@/lib/types'

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling']

// Insert-only: this is the PowerSync upload connector's target for a local
// `wines` row's first upload (UpdateType.PUT, see lib/powersync/connector.ts).
// Editing an existing wine is a later migration's concern (PATCH).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const cellarId = typeof body?.cellar_id === 'string' ? body.cellar_id : null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const type = body?.type as WineType
    if (!cellarId || !name || !WINE_TYPES.includes(type)) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const admin = createAdminClient()
    await requireOwnCellar(admin, user, cellarId)

    // producer is NOT NULL in Postgres -- defaults to '' rather than null for
    // a blank field.
    const { error } = await admin.from('wines').upsert({
      id,
      cellar_id: cellarId,
      name,
      producer: typeof body?.producer === 'string' ? body.producer.trim() : '',
      type,
      region: null,
      country: null,
      grape_variety: null,
      notes: null,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
