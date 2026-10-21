import { requireApiUser, apiAuthErrorResponse, ApiAuthError } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { parseFamilyMemberPatch } from '@/lib/api/family'

// The PowerSync upload connector's target for a local `family_members`
// row's UPDATE (display name edits, see app/app/edit-name-sheet.tsx) --
// family_members has only a surrogate `id` (added in
// supabase/migrations/20261021092549_family_members_surrogate_id.sql)
// specifically so PowerSync can address it. No PUT here: new rows only
// ever land via the redeem_family_invite RPC, never a direct client
// insert.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const fields = parseFamilyMemberPatch(body)
    if (!fields) return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })

    const admin = createAdminClient()
    const { data: existing } = await admin.from('family_members').select('user_id').eq('id', id).maybeSingle()
    if (!existing) return Response.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
    // Self-only: a member can rename themselves, never another member --
    // tighter than the usual requireOwnCellar check since there's no
    // family-wide write to defend here.
    if (existing.user_id !== user.id) throw new ApiAuthError('Ungültiger Eintrag', 403)

    const { error } = await admin.from('family_members').update(fields).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
