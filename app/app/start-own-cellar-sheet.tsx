'use client'

import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiMutate, ApiError } from '@/lib/spa/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'

// One-shot destructive command (POST /api/v1/demo/clear), not PowerSync
// CRUD: clears the seeded demo wines and flips the family off demo mode.
// No type-to-confirm here, matching legacy's StartOwnCellar -- it's the
// one reset flow that's meant to be low-friction (clearing a demo cellar
// loses nothing real).
export function StartOwnCellarSheet() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [cellarName, setCellarName] = useState('Meine Cantina')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    try {
      await apiMutate('POST', '/demo/clear', { cellarName: cellarName.trim() || undefined })
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['family'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Starten fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="w-full" />}>
        Eigene Cantina starten
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Eigene Cantina starten</SheetTitle>
          <SheetDescription>
            Die Demo-Weine werden gelöscht. Du startest mit einer leeren Cantina.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="soc-name">Name deiner Cantina</Label>
            <Input
              id="soc-name"
              value={cellarName}
              onChange={e => setCellarName(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Demo löschen und starten</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
