import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'

type OnboardingResultRow = {
  family_id: string
  cellar_id: string | null
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request)
    const body = await request.json().catch(() => null)

    const familyName = typeof body?.familyName === 'string' ? body.familyName.trim().slice(0, 60) : ''
    const cellarName = typeof body?.cellarName === 'string' ? body.cellarName.trim().slice(0, 60) : ''
    if (!familyName || !cellarName) {
      return Response.json({ error: 'Bitte Familien- und Kellernamen angeben' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .rpc('create_family_and_cellar', {
        p_user_id: user.id,
        p_family_name: familyName,
        p_cellar_name: cellarName,
      })
      .maybeSingle<OnboardingResultRow>()
    if (error) return Response.json({ error: 'Anlegen fehlgeschlagen' }, { status: 500 })

    return Response.json({ familyId: data?.family_id ?? null, cellarId: data?.cellar_id ?? null })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
