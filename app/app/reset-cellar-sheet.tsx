'use client'

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { apiMutate, ApiError } from '@/lib/spa/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'

// One-shot destructive command, not PowerSync CRUD -- calls
// POST /api/v1/cellar/reset directly via apiMutate rather than a local
// writeTransaction, since there's no sensible local-first version of "wipe
// everything on the server". The local PowerSync cache still holds the
// wiped rows until the next sync checkpoint pulls the deletions down; this
// doesn't force that, same as legacy's redirect-and-hope-the-page-refetches
// behavior had no equivalent concern (it always read straight from Postgres).
export function ResetCellarSheet({ cellarName }: { cellarName: string }) {
  const navigate = useNavigate()
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
      await apiMutate('POST', '/cellar/reset', { confirm: confirmText })
      setOpen(false)
      navigate({ to: '/' })
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
        Keller zurücksetzen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Keller zurücksetzen</SheetTitle>
          <SheetDescription>
            Alle Weine, Flaschen, Fotos, Verkostungen, Reisen und Lagerorte in
            &quot;{cellarName}&quot; werden unwiderruflich gelöscht. Der Keller
            selbst bleibt bestehen und ist danach leer.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={e => { e.preventDefault(); handleSubmit() }} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="rc-confirm">Gib zur Bestätigung &quot;{cellarName}&quot; ein</Label>
            <Input
              id="rc-confirm"
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
