'use client'

import { useEffect, useState, useTransition } from 'react'
import { getReadyScans, removeScan, type PendingScan } from '@/lib/offline/db'
import { quickAddWine } from '@/lib/actions/quick-add'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'

type WineType = 'red' | 'white' | 'rosé' | 'sparkling'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rot' },
  { value: 'white', label: 'Weiß' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
]

interface EditableFields {
  name: string
  producer: string
  wineType: WineType
  vintage: number | null
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

function PhotoThumbnail({ photo, photoType }: { photo: ArrayBuffer; photoType: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([photo], { type: photoType }))
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [photo, photoType])
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
    />
  )
}

function ScanCard({
  scan,
  onDone,
}: {
  scan: PendingScan
  onDone: (id: string) => void
}) {
  const [fields, setFields] = useState<EditableFields>({
    name: scan.name ?? scan.scanResult?.name ?? '',
    producer: scan.scanResult?.producer ?? '',
    wineType: (scan.scanResult?.type as WineType | undefined) ?? 'red',
    vintage: scan.scanResult?.vintage ?? null,
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!fields.name.trim()) {
      setError('Name ist erforderlich.')
      return
    }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('name', fields.name.trim())
      if (fields.producer.trim()) fd.set('producer', fields.producer.trim())
      fd.set('type', fields.wineType)
      if (fields.vintage) fd.set('vintage', String(fields.vintage))
      fd.set('quantity', String(scan.quantity))
      fd.set('storage_location_id', scan.storageLocationId)
      try {
        await quickAddWine(fd)
      } catch (err) {
        if (!isRedirectError(err)) {
          setError('Fehler beim Speichern – bitte nochmal versuchen.')
          return
        }
      }
      await removeScan(scan.id)
      window.dispatchEvent(new CustomEvent('cantina:scans-updated'))
      onDone(scan.id)
    })
  }

  function handleDiscard() {
    if (!window.confirm('Diesen Wein verwerfen?')) return
    startTransition(async () => {
      await removeScan(scan.id)
      window.dispatchEvent(new CustomEvent('cantina:scans-updated'))
      onDone(scan.id)
    })
  }

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)',
      background: 'var(--card)',
    }}>
      <div className="flex gap-4 mb-4">
        <PhotoThumbnail photo={scan.photo} photoType={scan.photoType} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
            {scan.storageLocationName} · {scan.quantity} Fl.
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
            {new Date(scan.createdAt).toLocaleDateString('de-DE')}
          </p>
        </div>
      </div>

      {scan.processingError && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'flex-start',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: 'color-mix(in oklab, var(--warning) 10%, var(--background))',
          border: '1px solid color-mix(in oklab, var(--warning) 30%, transparent)',
          marginBottom: 'var(--space-3)',
          fontSize: 'var(--text-sm)',
          color: 'var(--warning)',
        }}>
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
          KI konnte Etikett nicht lesen — bitte manuell ausfüllen.
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`name-${scan.id}`}>Name *</Label>
          <Input
            id={`name-${scan.id}`}
            value={fields.name}
            onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
            placeholder="z.B. Barolo"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`producer-${scan.id}`}>Produzent</Label>
          <Input
            id={`producer-${scan.id}`}
            value={fields.producer}
            onChange={e => setFields(f => ({ ...f, producer: e.target.value }))}
            placeholder="z.B. Gaja"
          />
        </div>
        <div className="space-y-1">
          <Label>Typ</Label>
          <div className="flex gap-2">
            {WINE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setFields(f => ({ ...f, wineType: t.value }))}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  border: '1px solid',
                  cursor: 'pointer',
                  background: fields.wineType === t.value ? 'var(--primary)' : 'var(--background)',
                  color: fields.wineType === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                  borderColor: fields.wineType === t.value ? 'var(--primary)' : 'var(--border)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`vintage-${scan.id}`}>Jahrgang</Label>
          <Input
            id={`vintage-${scan.id}`}
            type="number"
            placeholder="z.B. 2019"
            value={fields.vintage ?? ''}
            onChange={e => {
              const v = parseInt(e.target.value)
              setFields(f => ({ ...f, vintage: isNaN(v) ? null : v }))
            }}
          />
        </div>
      </div>

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          type="button"
          className="flex-1"
          disabled={isPending}
          onClick={handleConfirm}
        >
          Hinzufügen
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={isPending}
          onClick={handleDiscard}
          style={{ color: 'var(--destructive)', borderColor: 'var(--destructive)' }}
        >
          Verwerfen
        </Button>
      </div>
    </div>
  )
}

export default function InboxPage() {
  const [scans, setScans] = useState<PendingScan[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getReadyScans().then(s => {
      setScans(s.sort((a, b) => a.createdAt - b.createdAt))
      setLoaded(true)
    })
  }, [])

  if (!loaded) return null

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
        Ausstehende Etiketten
      </h2>
      {scans.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', paddingTop: 'var(--space-12)' }}>
          Keine ausstehenden Etiketten.
        </p>
      ) : (
        <div className="space-y-4">
          {scans.map(scan => (
            <ScanCard
              key={scan.id}
              scan={scan}
              onDone={id => setScans(prev => prev.filter(s => s.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
