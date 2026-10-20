'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { quickAddWine } from '@/lib/actions/quick-add'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { queueAction } from '@/lib/offline/db'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScanLabelButton } from '@/components/cellar/scan-label-button'
import type { ScanResult } from '@/lib/actions/scan-label'
import type { CachedLocation } from '@/lib/offline/location-cache'

const WINE_TYPES = [
  { value: 'red',       label: 'Rot' },
  { value: 'white',     label: 'Weiß' },
  { value: 'rosé',      label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
] as const

type WineTypeValue = typeof WINE_TYPES[number]['value']

export function QuickAddSheet({
  storageLocationId,
  storageLocationName,
  nameHints = [],
  producerHints = [],
  storageLocations = [],
}: {
  storageLocationId: string | null
  storageLocationName: string
  nameHints?: string[]
  producerHints?: string[]
  storageLocations?: CachedLocation[]
}) {
  const [open, setOpen] = useState(false)
  const [wineType, setWineType] = useState<WineTypeValue>('red')
  const [vintage, setVintage] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const { run, isPending, error, offlineSaved } = useServerAction(
    quickAddWine,
    (fd) => queueAction('quickAddWine', fd),
  )

  useEffect(() => {
    if (offlineSaved) setOpen(false)
  }, [offlineSaved])

  function handleScanResult(result: ScanResult) {
    if (result.name)     setName(result.name)
    if (result.producer) setProducer(result.producer)
    if (result.vintage)  setVintage(result.vintage)
    if (result.type && WINE_TYPES.some(t => t.value === result.type)) {
      setWineType(result.type as WineTypeValue)
    }
  }

  const listId         = `names-${storageLocationId ?? 'none'}`
  const producerListId = `producers-${storageLocationId ?? 'none'}`

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button size="sm" variant="outline" style={{ height: 28, padding: '0 8px' }}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Wein hinzufügen
            {storageLocationId && (
              <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)', marginLeft: 8 }}>
                · {storageLocationName}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          {nameHints.length > 0 && (
            <datalist id={listId}>
              {nameHints.map(h => <option key={h} value={h} />)}
            </datalist>
          )}
          {producerHints.length > 0 && (
            <datalist id={producerListId}>
              {producerHints.map(h => <option key={h} value={h} />)}
            </datalist>
          )}

          <ScanLabelButton onResult={handleScanResult} storageLocations={storageLocations} />

          <input type="hidden" name="storage_location_id" value={storageLocationId ?? ''} />
          <input type="hidden" name="type" value={wineType} />

          <div className="space-y-2">
            <Label htmlFor="qs-name">Name *</Label>
            <Input
              id="qs-name" name="name" required
              placeholder="z.B. Barolo"
              value={name}
              onChange={e => setName(e.target.value)}
              list={nameHints.length > 0 ? listId : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-producer">Produzent</Label>
            <Input
              id="qs-producer" name="producer"
              placeholder="z.B. Gaja"
              value={producer}
              onChange={e => setProducer(e.target.value)}
              list={producerHints.length > 0 ? producerListId : undefined}
            />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jahrgang</Label>
              <DatePicker
                mode="year"
                name="vintage"
                value={vintage}
                onChange={v => setVintage(v as number | null)}
                placeholder="Jahr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qs-quantity">Anzahl *</Label>
              <Input
                id="qs-quantity" name="quantity" type="number"
                min="1" max="999" defaultValue={1} required
              />
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Hinzufügen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
