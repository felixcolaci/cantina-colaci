'use client'

import { usePowerSync } from '@powersync/react'
import { useNavigate } from '@tanstack/react-router'
import { useCellars } from '@/lib/powersync/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateCellarSheet } from '@/app/app/create-cellar-sheet'
import { DeleteCellarSheet } from '@/app/app/delete-cellar-sheet'

// "Meine Keller" section of the settings screen (app/app/cellar-settings-
// screen.tsx): lists every cellar the family has, lets any member switch
// into one, and (owner-only) delete one. Switching is a local-first
// UPDATE of the caller's own family_members.current_cellar_id -- same
// pattern as ThemePreferenceControl -- which ActiveCellarGate
// (lib/spa/router.tsx) picks up immediately, no server round trip needed.
export function CellarSwitcher({
  familyId,
  activeCellarId,
  memberId,
  isOwner,
}: {
  familyId: string
  activeCellarId: string
  memberId: string | null
  isOwner: boolean
}) {
  const db = usePowerSync()
  const navigate = useNavigate()
  const { cellars, isLoading } = useCellars(familyId)

  async function switchTo(cellarId: string) {
    if (!memberId || cellarId === activeCellarId) return
    await db.execute(`UPDATE family_members SET current_cellar_id = ? WHERE id = ?`, [cellarId, memberId])
    navigate({ to: '/' })
  }

  return (
    <div>
      <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Meine Keller</h3>
      {isLoading ? null : (
        <div className="flex flex-col gap-2 mb-3">
          {cellars.map(cellar => {
            const isActive = cellar.id === activeCellarId
            return (
              <div key={cellar.id} className="flex items-center gap-2">
                <span className="flex-1" style={{ fontSize: 'var(--text-base)', color: 'var(--foreground)' }}>
                  {cellar.name}
                </span>
                {isActive ? (
                  <Badge variant="secondary">Aktiv</Badge>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => switchTo(cellar.id)}>
                    Wechseln
                  </Button>
                )}
                {isOwner && cellars.length > 1 && (
                  <DeleteCellarSheet
                    cellarId={cellar.id}
                    cellarName={cellar.name}
                    onDeleted={() => { if (isActive) navigate({ to: '/' }) }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
      <CreateCellarSheet memberId={memberId} />
    </div>
  )
}
