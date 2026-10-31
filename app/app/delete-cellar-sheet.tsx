'use client'

import { useState } from 'react'
import { apiMutate, ApiError } from '@/lib/spa/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'

// Owner-only, type-to-confirm deletion of one of the family's cellars
// (DELETE /api/v1/cellars/[id]) -- same confirm-by-name UX as
// ResetCellarSheet, but drops the cellar row itself instead of just
// emptying it. The server also refuses to delete the family's last
// remaining cellar; onDeleted lets the caller (CellarSwitcher) decide
// what to do next, e.g. navigate home if this was the active cellar.
export function DeleteCellarSheet({ cellarId, cellarName, onDeleted }: { cellarId: string; cellarName: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSubmit = confirmText === cellarName

  async function handleSubmit() {
    if (!canSubmit) return
    setIsPending(true)
    setError(null)
    try {
      await apiMutate('DELETE', `/cellars/${cellarId}`, { confirm: confirmText })
      setOpen(false)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen')
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
      <SheetTrigger render={<Button variant="destructive" size="sm" />}>
        Löschen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Keller löschen</SheetTitle>
          <SheetDescription>
            &quot;{cellarName}&quot; wird mitsamt allen Weinen, Flaschen, Fotos,
            Verkostungen, Reisen und Lagerorten unwiderruflich gelöscht.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={e => { e.preventDefault(); handleSubmit() }} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="dc-confirm">Gib zur Bestätigung &quot;{cellarName}&quot; ein</Label>
            <Input
              id="dc-confirm"
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
