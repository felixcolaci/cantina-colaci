'use client'

import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePowerSync } from '@powersync/react'
import { apiMutate, ApiError } from '@/lib/spa/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'

// Creates an additional cellar for the family (POST /api/v1/cellars, not
// local PowerSync CRUD -- the optional demo-wine seed is a server-side
// bulk write across several tables, same reasoning as onboarding's
// create_family_and_cellar RPC). On success, switches the caller straight
// into the new cellar by writing it into their own current_cellar_id,
// same local-first UPDATE CellarSwitcher's row buttons use -- it'll
// resolve once the new cellar (and, if seeded, its wines) finish syncing
// down, which can lag the switch by a moment, same tradeoff
// CellarSettingsScreen already takes for a just-renamed family member.
export function CreateCellarSheet({ memberId }: { memberId: string | null }) {
  const db = usePowerSync()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [seed, setSeed] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    try {
      const result = await apiMutate<{ cellarId: string }>('POST', '/cellars', { name, seed })
      if (memberId && result?.cellarId) {
        await db.execute(`UPDATE family_members SET current_cellar_id = ? WHERE id = ?`, [result.cellarId, memberId])
      }
      setOpen(false)
      setName('')
      setSeed(false)
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anlegen fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="w-full" />}>
        Neuer Keller
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Neuer Keller</SheetTitle>
          <SheetDescription>
            Leg einen weiteren Keller für deine Familie an.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="cc-name">Name</Label>
            <Input
              id="cc-name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>
          <label className="flex items-start gap-2 text-sm" style={{ color: 'var(--foreground)' }} htmlFor="cc-seed">
            <Checkbox id="cc-seed" checked={seed} onCheckedChange={checked => setSeed(checked === true)} />
            <span>
              Mit Beispielweinen starten
              <br />
              <span style={{ color: 'var(--muted-foreground)' }}>
                Füllt den Keller mit ein paar Beispielweinen, statt ihn leer zu starten.
              </span>
            </span>
          </label>
          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Keller anlegen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
