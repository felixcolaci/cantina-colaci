import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { FamilyRole } from '@/lib/types'
import { CopyInviteLink } from './copy-invite-link'
import { StartOwnCellar } from './start-own-cellar'
import { SetNamePrompt } from './set-name-prompt'
import { EditNameSheet } from './edit-name-sheet'

type MemberWithName = {
  user_id: string
  role: FamilyRole
  display_name: string | null
  email: string
  resolvedName: string
  initials: string
}

function emailPrefix(email: string): string {
  const prefix = email.split('@')[0] ?? email
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    const s = name.slice(0, 2).toUpperCase()
    return s.length < 2 ? s + s : s
  }
  return words.map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()
}

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

  const [membersResult, authResult] = await Promise.all([
    admin
      .from('family_members')
      .select('user_id, role, display_name')
      .eq('family_id', membership.family_id),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ])

  const emailMap = new Map(
    (authResult.data?.users ?? []).map(u => [u.id, u.email ?? ''])
  )
  const family = membership.families as any

  const members: MemberWithName[] = (membersResult.data ?? []).map(m => {
    const email = emailMap.get(m.user_id) ?? ''
    const display_name = (m as any).display_name as string | null
    const resolvedName = display_name ?? emailPrefix(email)
    return {
      user_id: m.user_id,
      role: m.role as FamilyRole,
      display_name,
      email,
      resolvedName,
      initials: getInitials(resolvedName),
    }
  })

  const currentMember = members.find(m => m.user_id === user.id)
  const showNamePrompt = !currentMember?.display_name
  const currentEmailPrefix = emailPrefix(currentMember?.email ?? '')

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Familie</p>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-display)',
          lineHeight: 'var(--leading-display)',
          marginBottom: 'var(--space-4)',
        }}
      >
        {family?.name}
      </h1>
      <hr className="rule-gold" style={{ marginBottom: 'var(--space-6)' }} />

      {showNamePrompt && <SetNamePrompt emailPrefix={currentEmailPrefix} />}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {members.map(m => (
          <div
            key={m.user_id}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {m.initials}
            </div>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                color: 'var(--foreground)',
                flex: 1,
              }}
            >
              {m.resolvedName}
            </span>
            {m.role === 'owner' && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--primary)',
                }}
              >
                Owner
              </span>
            )}
            {m.user_id === user.id && m.display_name && (
              <EditNameSheet currentName={m.display_name} />
            )}
          </div>
        ))}
      </div>

      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--border)',
          marginBottom: 'var(--space-6)',
        }}
      />

      {family?.is_demo && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              marginBottom: 'var(--space-2)',
            }}
          >
            Demo-Modus
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--muted-foreground)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Du nutzt aktuell die Demo-Cantina mit Beispielweinen. Starte jetzt mit deinen eigenen.
          </p>
          <StartOwnCellar />
        </div>
      )}

      {membership.role === 'owner' && (
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              marginBottom: 'var(--space-2)',
            }}
          >
            Mitglied einladen
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--muted-foreground)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Link teilen. Nach dem Anmelden wird das Mitglied automatisch zur Familie hinzugefügt.
          </p>
          <CopyInviteLink familyId={membership.family_id} />
        </div>
      )}
    </div>
  )
}
