import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'

type CellarContextRow = {
  family_id: string
  cellar_id: string | null
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const { data } = await admin
      .rpc('get_cellar_context', { p_user_id: user.id })
      .maybeSingle<CellarContextRow>()

    return Response.json({
      userId: user.id,
      email: user.email ?? null,
      familyId: data?.family_id ?? null,
      cellarId: data?.cellar_id ?? null,
    })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
