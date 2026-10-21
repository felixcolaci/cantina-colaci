'use client'

import { useState, type FormEvent } from 'react'
import { usePowerSync } from '@powersync/react'
import { useStorageLocationsSettings } from '@/lib/powersync/queries'
import { BackLink } from '@/app/app/back-link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import type { StorageLocationType } from '@/lib/types'

const TYPE_OPTIONS: { value: StorageLocationType; label: string }[] = [
  { value: 'fridge', label: 'Kühlschrank' },
  { value: 'cellar', label: 'Keller' },
  { value: 'climate_cabinet', label: 'Klimaschrank' },
  { value: 'other', label: 'Sonstiges' },
]

const TYPE_LABELS: Record<StorageLocationType, string> = {
  fridge: 'Kühlschrank',
  cellar: 'Keller',
  climate_cabinet: 'Klimaschrank',
  other: 'Sonstiges',
}

// Create-only, mirroring legacy/app/(app)/settings/locations: the legacy
// page also supported delete, but that needs a DELETE /api/v1 write path
// that doesn't exist yet for any table in the new architecture -- deferred
// rather than adding the first one as a side effect of this migration.
export function StorageLocationsScreen({ cellarId }: { cellarId: string }) {
  const db = usePowerSync()
  const { storageLocations, isLoading } = useStorageLocationsSettings(cellarId)
  const [name, setName] = useState('')
  const [type, setType] = useState<StorageLocationType>('cellar')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    setIsPending(true)
    setError(null)
    try {
      await db.execute(
        `INSERT INTO storage_locations (id, cellar_id, name, type) VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), cellarId, trimmedName, type],
      )
      setName('')
      setType('cellar')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <BackLink to="/">Keller</BackLink>

      <h2 style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)' }}>Lagerorte</h2>

      {isLoading ? null : storageLocations.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
          Noch keine Lagerorte
        </p>
      ) : (
        <div className="space-y-2">
          {storageLocations.map(loc => (
            <div
              key={loc.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ border: '1px solid var(--border)' }}
            >
              <p className="font-medium">{loc.name}</p>
              <Badge variant="secondary" className="text-xs">{TYPE_LABELS[loc.type]}</Badge>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg" style={{ border: '1px solid var(--border)' }}>
        <h3 className="font-medium">Neuer Lagerort</h3>
        <div className="space-y-2">
          <Label htmlFor="loc-name">Name</Label>
          <Input
            id="loc-name"
            placeholder="z. B. Klimaschrank Treppe"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Typ</Label>
          <Select value={type} onValueChange={v => setType(v as StorageLocationType)} items={TYPE_OPTIONS}>
            <SelectTrigger><SelectValue placeholder="Typ auswählen" /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
        <SubmitButton isPending={isPending} size="sm">Hinzufügen</SubmitButton>
      </form>
    </div>
  )
}
