'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery as useRQuery, useQueryClient } from '@tanstack/react-query'
import { usePowerSync } from '@powersync/react'
import { apiGet, apiMutate, ApiError } from '@/lib/spa/api-client'
import { useCellar, useOwnFamilyMember } from '@/lib/powersync/queries'
import { useCurrentUserId } from '@/lib/auth/use-current-user-id'
import { logout } from '@/lib/auth/logout'
import { ResetCellarSheet } from '@/app/app/reset-cellar-sheet'
import { ResetFamilySheet } from '@/app/app/reset-family-sheet'
import { StartOwnCellarSheet } from '@/app/app/start-own-cellar-sheet'
import { CellarSwitcher } from '@/app/app/cellar-switcher'
import { EditCellarNameSheet } from '@/app/app/edit-cellar-name-sheet'
import { EditNameSheet } from '@/app/app/edit-name-sheet'
import { ThemePreferenceControl } from '@/app/app/theme-preference-control'
import { BackLink } from '@/app/app/back-link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type FamilyMember = {
  userId: string
  role: string
  displayName: string | null
  email: string
  resolvedName: string
  initials: string
}

type FamilyResponse = {
  familyName: string
  isDemo: boolean
  role: string
  members: FamilyMember[]
}

function InviteSection() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle')
  const [copyError, setCopyError] = useState<string | null>(null)

  async function handleInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const target = email
    setInviteError(null)
    setIsPending(true)
    try {
      await apiMutate<{ token: string }>('POST', '/family/invites', { email: target })
      setSentTo(target)
      setEmail('')
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'Einladung konnte nicht gesendet werden.')
    } finally {
      setIsPending(false)
    }
  }

  async function handleCopyLink() {
    setCopyError(null)
    setCopyState('copying')
    try {
      const { token } = (await apiMutate<{ token: string }>('POST', '/family/invites')) ?? { token: '' }
      await navigator.clipboard.writeText(`${window.location.origin}/join?token=${token}`)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch (err) {
      setCopyError(err instanceof ApiError ? err.message : 'Einladungslink konnte nicht erstellt werden.')
      setCopyState('idle')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Button variant="outline" className="w-full" onClick={handleCopyLink} disabled={copyState === 'copying'}>
          {copyState === 'copied' ? '✓ Link kopiert!' : copyState === 'copying' ? 'Erstelle Link…' : 'Einladungslink kopieren'}
        </Button>
        {copyError && <p className="text-sm mt-2" style={{ color: 'var(--destructive)' }}>{copyError}</p>}
      </div>

      {sentTo ? (
        <div>
          <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Einladung an <strong>{sentTo}</strong> gesendet.
          </p>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-sm underline"
            style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Weiteres Mitglied einladen
          </button>
        </div>
      ) : (
        <form onSubmit={handleInvite} className="space-y-2">
          <Input
            type="email"
            placeholder="email@beispiel.de"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          {inviteError && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{inviteError}</p>}
          <SubmitButton isPending={isPending} className="w-full">Einladung senden</SubmitButton>
        </form>
      )}
    </div>
  )
}

export function CellarSettingsScreen({ cellarId }: { cellarId: string }) {
  const { name: cellarName, isLoading: cellarLoading } = useCellar(cellarId)
  const userId = useCurrentUserId()
  const { id: ownMemberId, familyId, displayName: ownDisplayName } = useOwnFamilyMember(userId ?? '')
  // Single GET /api/v1/family response backs both the cellar's owner/demo
  // flags and the family section below -- one query cache entry instead of
  // the two separate screens that used to each fetch it.
  const { data, isLoading: familyLoading, error } = useRQuery<FamilyResponse>({
    queryKey: ['family'],
    queryFn: () => apiGet<FamilyResponse>('/family'),
  })
  const queryClient = useQueryClient()
  const db = usePowerSync()

  // family_members' display_name syncs down via PowerSync a moment after
  // this route's own PATCH lands -- re-fetch the REST response once that
  // happens so resolvedName (derived server-side) catches up too.
  useEffect(() => {
    if (ownDisplayName) queryClient.invalidateQueries({ queryKey: ['family'] })
  }, [ownDisplayName, queryClient])

  const isLoading = cellarLoading || familyLoading

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <BackLink to="/">Keller</BackLink>

      <div>
        <p className="eyebrow mb-1">Einstellungen</p>
        <div className="flex items-center gap-1">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: 'var(--tracking-tight)', margin: 0 }}>
            {cellarLoading ? '…' : cellarName ?? 'Keller'}
          </h1>
          {!cellarLoading && <EditCellarNameSheet cellarId={cellarId} currentName={cellarName ?? ''} />}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Link to="/settings/locations" className="text-sm underline" style={{ color: 'var(--primary)' }}>
          Lagerorte verwalten →
        </Link>
        <Link to="/settings/api-keys" className="text-sm underline" style={{ color: 'var(--primary)' }}>
          API-Schlüssel / MCP →
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error || !data ? (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          {error instanceof ApiError ? error.message : 'Einstellungen konnten nicht geladen werden.'}
        </p>
      ) : (
        <>
          <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="eyebrow mb-2">Familie</p>
            <h2 className="mb-3" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
              {data.familyName}
            </h2>
            <div className="flex flex-col gap-3">
              {data.members.map(m => (
                <div key={m.userId} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}>
                      {m.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1" style={{ fontSize: 'var(--text-base)', color: 'var(--foreground)' }}>
                    {m.resolvedName}
                  </span>
                  {m.role === 'owner' && (
                    <span className="mono" style={{ fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>
                      Owner
                    </span>
                  )}
                  {m.userId === userId && ownMemberId && (
                    <EditNameSheet memberId={ownMemberId} currentName={m.displayName ?? ''} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {familyId && (
            <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <CellarSwitcher
                familyId={familyId}
                activeCellarId={cellarId}
                memberId={ownMemberId}
                isOwner={data.role === 'owner'}
              />
            </div>
          )}

          <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Darstellung</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Hell, dunkel oder automatisch nach Systemeinstellung.
            </p>
            <ThemePreferenceControl />
          </div>

          {data.isDemo && (
            <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Demo-Modus</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                Du nutzt aktuell die Demo-Cantina mit Beispielweinen. Starte jetzt mit deinen eigenen.
              </p>
              <StartOwnCellarSheet />
            </div>
          )}

          {data.role === 'owner' && (
            <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Mitglied einladen</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                E-Mail-Adresse eingeben — das Mitglied bekommt eine Einladung und wird nach dem Anmelden automatisch hinzugefügt.
              </p>
              <InviteSection />
            </div>
          )}

          {data.role === 'owner' && !data.isDemo && (
            <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--destructive)' }}>
                Gefahrenzone
              </h3>
              {cellarName && (
                <div className="mb-4">
                  <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                    Entfernt alle Weine, Flaschen, Fotos, Verkostungen, Reisen und
                    Lagerorte aus diesem Keller. Diese Aktion kann nicht widerrufen werden.
                  </p>
                  <ResetCellarSheet cellarName={cellarName} />
                </div>
              )}
              <div>
                <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                  Entfernt alle Weine, Flaschen, Fotos, Verkostungen, Reisen und
                  Lagerorte in jedem Keller dieser Familie.
                </p>
                <ResetFamilySheet familyName={data.familyName} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
        <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Konto</h3>
        <Button variant="outline" className="w-full" onClick={() => logout(db)}>
          Abmelden
        </Button>
      </div>
    </div>
  )
}
