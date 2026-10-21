'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiMutate, ApiError } from '@/lib/spa/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'

// One-shot destructive command (POST /api/v1/family/reset), not PowerSync
// CRUD -- same reasoning as ResetCellarSheet, but wipes every cellar the
// family has, not just the caller's own one.
export function ResetFamilySheet({ familyName }: { familyName: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSubmit = confirmText === familyName

  async function handleSubmit() {
    if (!canSubmit) return
    setIsPending(true)
    setError(null)
    try {
      await apiMutate('POST', '/family/reset', { confirm: confirmText })
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['family'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Zurücksetzen fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setConfirmText('')
      }}
    >
      <SheetTrigger render={<Button variant="destructive" className="w-full" />}>
        Familie zurücksetzen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Familie zurücksetzen</SheetTitle>
          <SheetDescription>
            Alle Weine, Flaschen, Fotos, Verkostungen, Reisen und Lagerorte in
            jedem Keller von &quot;{familyName}&quot; werden unwiderruflich
            gelöscht. Familie und Mitglieder bleiben bestehen.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={e => { e.preventDefault(); handleSubmit() }} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="rf-confirm">Gib zur Bestätigung &quot;{familyName}&quot; ein</Label>
            <Input
              id="rf-confirm"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <Button type="submit" variant="destructive" className="w-full" disabled={!canSubmit || isPending}>
            {isPending ? 'Wird gelöscht…' : 'Endgültig löschen'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
