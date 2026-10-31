import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireFamilyMembership } from '@/lib/api/family'
import { parseCreateCellarBody, seedCellarWithDemoWines } from '@/lib/api/cellar'
import { createAdminClient } from '@/lib/supabase/server'

// Creates an additional cellar for the caller's family -- onboarding's
// create_family_and_cellar RPC only ever creates a family's first one.
// Open to any family member (same level as creating a trip or wine), not
// owner-gated: deleting a cellar is the destructive half, gated
// separately in [id]/route.ts. Optionally seeds the new cellar with the
// same example wines as the onboarding demo cellar
// (lib/api/cellar.ts's seedCellarWithDemoWines), so a family can preview
// the app in a throwaway cellar without it ever becoming a special "demo"
// row that families.is_demo has to track.
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireFamilyMembership(admin, user)

    const body = await request.json().catch(() => null)
    const input = parseCreateCellarBody(body)
    if (!input) return Response.json({ error: 'Bitte einen Namen angeben' }, { status: 400 })

    const { data: cellar, error } = await admin
      .from('cellars')
      .insert({ family_id: membership.familyId, name: input.name })
      .select('id')
      .single()
    if (error || !cellar) return Response.json({ error: error?.message ?? 'Anlegen fehlgeschlagen' }, { status: 500 })

    if (input.seed) {
      await seedCellarWithDemoWines(admin, cellar.id, user.id)
    }

    return Response.json({ cellarId: cellar.id }, { status: 201 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
