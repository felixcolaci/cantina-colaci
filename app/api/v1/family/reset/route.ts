import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireResettableOwner, wipeCellarData, confirmMatches } from '@/lib/api/reset'
import { createAdminClient } from '@/lib/supabase/server'

// Wipes every cellar belonging to the caller's family (lib/actions/
// reset.ts's resetFamily). Owner-only, never for a demo family.
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireResettableOwner(admin, user)

    const body = await request.json().catch(() => null)
    if (!confirmMatches(body, membership.familyName)) {
      return Response.json({ error: 'Bestätigungstext stimmt nicht mit dem Namen der Familie überein' }, { status: 400 })
    }

    const { data: cellars, error: cellarsError } = await admin
      .from('cellars').select('id').eq('family_id', membership.familyId)
    if (cellarsError) return Response.json({ error: cellarsError.message }, { status: 500 })

    for (const cellar of cellars ?? []) {
      await wipeCellarData(admin, cellar.id, membership.familyId)
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
