import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireResettableOwner, wipeCellarData, confirmMatches } from '@/lib/api/reset'
import { createAdminClient } from '@/lib/supabase/server'

type CellarContextRow = { family_id: string; cellar_id: string | null }

// Wipes every wine/sku/tasting/trip/storage-location (and wine-photos
// storage objects) in the caller's own cellar. Owner-only, never for a
// demo family (see requireResettableOwner). The cellar row itself survives
// empty -- this is lib/actions/reset.ts's resetCellar, ported to a REST
// command route instead of a Server Action.
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireResettableOwner(admin, user)

    const { data: ctx } = await admin
      .rpc('get_cellar_context', { p_user_id: user.id })
      .maybeSingle<CellarContextRow>()
    if (!ctx?.cellar_id) return Response.json({ error: 'Kein Keller gefunden' }, { status: 404 })

    const { data: cellar } = await admin.from('cellars').select('name').eq('id', ctx.cellar_id).maybeSingle()
    if (!cellar) return Response.json({ error: 'Kein Keller gefunden' }, { status: 404 })

    const body = await request.json().catch(() => null)
    if (!confirmMatches(body, cellar.name)) {
      return Response.json({ error: 'Bestätigungstext stimmt nicht mit dem Namen des Kellers überein' }, { status: 400 })
    }

    await wipeCellarData(admin, ctx.cellar_id, membership.familyId)

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
