import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireFamilyMembership, requireOwnerRole } from '@/lib/api/family'
import { createAdminClient } from '@/lib/supabase/server'

// Revoke. Owner-only, and the delete itself is scoped to
// .eq('family_id', membership.familyId) in addition to the id -- the same
// IDOR guard legacy's revokeApiKey already had, kept exactly: without it,
// an owner could pass another family's key id and silently no-op a delete
// that looks successful but hits zero rows, or (worse, if that scoping
// were ever dropped) actually revoke someone else's key.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    const membership = await requireFamilyMembership(admin, user)
    requireOwnerRole(membership)

    const { error } = await admin.from('api_keys').delete().eq('id', id).eq('family_id', membership.familyId)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
