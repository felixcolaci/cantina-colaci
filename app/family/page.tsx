import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyInviteLink } from './copy-invite-link'

export default async function FamilyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id, role, families(name)')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: members } = await supabase
    .from('family_members')
    .select('user_id, role, joined_at')
    .eq('family_id', membership.family_id)

  const family = membership.families as any

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Famiglia</h2>

      <Card>
        <CardHeader>
          <CardTitle>{family?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members?.map(m => (
            <div key={m.user_id} className="flex justify-between items-center py-1">
              <span className="text-sm font-mono text-muted-foreground">{m.user_id.slice(0, 12)}…</span>
              <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {membership.role === 'owner' && (
        <div>
          <h3 className="font-medium mb-2">Invita un membro</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Condividi il link. Dopo il login, il membro verrà aggiunto automaticamente alla tua famiglia.
          </p>
          <CopyInviteLink familyId={membership.family_id} />
        </div>
      )}
    </div>
  )
}
