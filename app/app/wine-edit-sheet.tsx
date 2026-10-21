'use client'

import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import type { WineDetail } from '@/lib/powersync/queries'
import type { WineType } from '@/lib/types'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rot' },
  { value: 'white', label: 'Weiß' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
]

// Edits an existing wine's row in place via PowerSync's local writeTransaction --
// same local-first pattern as QuickAddSheet's inserts (app/app/quick-add-sheet.tsx).
// The connector drains the resulting UPDATE as UpdateType.PATCH to the PATCH
// handler on /api/v1/wines/[id] (lib/powersync/connector.ts), online or not.
export function WineEditSheet({ wine }: { wine: WineDetail }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(wine.name)
  const [producer, setProducer] = useState(wine.producer)
  const [wineType, setWineType] = useState<WineType>(wine.type)
  const [country, setCountry] = useState(wine.country ?? '')
  const [region, setRegion] = useState(wine.region ?? '')
  const [grapeVariety, setGrapeVariety] = useState(wine.grapeVariety ?? '')
  const [notes, setNotes] = useState(wine.notes ?? '')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedProducer = producer.trim()
    if (!trimmedName || !trimmedProducer) return

    setIsPending(true)
    setError(null)
    try {
      await db.execute(
        `UPDATE wines
         SET name = ?, producer = ?, type = ?, country = ?, region = ?, grape_variety = ?, notes = ?
         WHERE id = ?`,
        [
          trimmedName,
          trimmedProducer,
          wineType,
          country.trim() || null,
          region.trim() || null,
          grapeVariety.trim() || null,
          notes.trim() || null,
          wine.id,
        ],
      )
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <button
          className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
          aria-label="Wein bearbeiten"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Wein bearbeiten</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="we-name">Name *</Label>
            <Input id="we-name" required value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="we-producer">Weingut *</Label>
            <Input id="we-producer" required value={producer} onChange={e => setProducer(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <div className="flex gap-2">
              {WINE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setWineType(t.value)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    border: '1px solid',
                    cursor: 'pointer',
                    transition: 'background var(--duration-fast), color var(--duration-fast)',
                    background: wineType === t.value ? 'var(--primary)' : 'var(--background)',
                    color: wineType === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                    borderColor: wineType === t.value ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="we-country">Land</Label>
            <Input id="we-country" value={country} onChange={e => setCountry(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="we-region">Region</Label>
            <Input id="we-region" value={region} onChange={e => setRegion(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="we-grape">Rebsorte</Label>
            <Input id="we-grape" value={grapeVariety} onChange={e => setGrapeVariety(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="we-notes">Notizen</Label>
            <Textarea
              id="we-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Allgemeine Notizen zum Wein…"
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
