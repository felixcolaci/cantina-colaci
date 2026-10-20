import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function InvalidInviteMessage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-muted-foreground">
          Dieser Einladungslink ist ungültig oder abgelaufen.
        </p>
      </div>
    </div>
  )
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) {
    redirect('/')
    return
  }

  const { data: { user } } = await getAuthenticatedUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`)
    return
  }

  // redeem_family_invite (supabase/migrations/20261020130000_family_invites.sql)
  // validates the token (exists, unused, unexpired) and joins the caller to
  // its family. Called via the admin client because the RPC takes the
  // caller's user id as an explicit parameter rather than relying on
  // auth.uid() — see that migration's header comment for why.
  const admin = createAdminClient()
  const { error } = await admin.rpc('redeem_family_invite', {
    p_token: token,
    p_user_id: user.id,
  })

  if (error) {
    return <InvalidInviteMessage />
  }

  redirect('/')
}
