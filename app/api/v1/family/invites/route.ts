import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireFamilyMembership, requireOwnerRole } from '@/lib/api/family'
import { createAdminClient } from '@/lib/supabase/server'

// Mints a 7-day single-use invite token via the create_family_invite RPC
// (supabase/migrations/20261020123346_family_invites.sql), then optionally
// emails it -- combines legacy's two actions (createFamilyInvite for
// CopyInviteLink, inviteFamilyMember for InviteForm) into one endpoint: an
// empty body is the "copy link" flow, an {email} body is the "send
// invite" flow.
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireFamilyMembership(admin, user)
    requireOwnerRole(membership)

    const { data: token, error } = await admin.rpc('create_family_invite', {
      p_family_id: membership.familyId,
      p_user_id: user.id,
    })
    if (error || !token) {
      return Response.json({ error: 'Einladungslink konnte nicht erstellt werden.' }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim() : null

    if (email) {
      // Prefer a server-configured canonical origin over request headers --
      // host/x-forwarded-* are caller-controlled and would otherwise let a
      // forged request poison the emailed invite link's redirect target.
      // Supabase's own redirectTo allowlist is a second backstop, but this
      // route shouldn't rely on that alone. Falls back to header-derived
      // origin only when SITE_URL isn't set (local/dev convenience).
      const origin =
        process.env.SITE_URL ??
        (request.headers.get('x-forwarded-proto')
          ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
          : new URL(request.url).origin)

      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/join?token=${token}`)}`,
      })
      if (inviteError) {
        const msg = inviteError.message.toLowerCase()
        if (inviteError.status === 422 || msg.includes('already been registered') || msg.includes('already exists')) {
          return Response.json(
            { error: `${email} hat bereits einen Account — einfach einloggen und dann dem Einladungslink folgen.` },
            { status: 409 },
          )
        }
        return Response.json({ error: 'Einladung konnte nicht gesendet werden.' }, { status: 500 })
      }
    }

    return Response.json({ token })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
