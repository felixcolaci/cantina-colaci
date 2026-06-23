import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyInviteLink } from './copy-invite-link'
import { StartOwnCellar } from './start-own-cellar'

export default async function FamilyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id, role, families(name, is_demo)')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: members } = await admin
    .from('family_members')
    .select('user_id, role, joined_at')
    .eq('family_id', membership.family_id)

  const family = membership.families as any

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Familie</h2>

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

      {family?.is_demo && (
        <div id="start">
          <h3 className="font-medium mb-2">Demo-Modus</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Du nutzt aktuell die Demo-Cantina mit Beispielweinen. Starte jetzt mit deinen eigenen.
          </p>
          <StartOwnCellar />
        </div>
      )}

      {membership.role === 'owner' && (
        <div>
          <h3 className="font-medium mb-2">Mitglied einladen</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Link teilen. Nach dem Anmelden wird das Mitglied automatisch zur Familie hinzugefügt.
          </p>
          <CopyInviteLink familyId={membership.family_id} />
        </div>
      )}
    </div>
  )
}
