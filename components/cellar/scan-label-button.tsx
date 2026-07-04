'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { scanWineLabel } from '@/lib/actions/scan-label'
import type { ScanResult } from '@/lib/actions/scan-label'
import { compressImage } from '@/lib/image-compress'
import { queueScan } from '@/lib/offline/db'
import type { CachedLocation } from '@/lib/offline/location-cache'

interface Props {
  onResult: (r: ScanResult) => void
  storageLocations?: CachedLocation[]
}

export function ScanLabelButton({ onResult, storageLocations = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedOffline, setSavedOffline] = useState(false)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [offlineName, setOfflineName] = useState('')
  const [offlineQuantity, setOfflineQuantity] = useState(1)
  const [offlineLocationId, setOfflineLocationId] = useState('')
  const [isSavingOffline, setIsSavingOffline] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSavedOffline(false)

    if (!navigator.onLine) {
      setOfflineLocationId(storageLocations[0]?.id ?? '')
      setCapturedFile(file)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    startTransition(async () => {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.set('image', compressed)
      const result = await scanWineLabel(fd)
      if (result.error) {
        setError(result.error)
      } else {
        onResult(result)
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  async function handleOfflineSave() {
    if (!capturedFile || !offlineLocationId) return
    setIsSavingOffline(true)
    try {
      const compressed = await compressImage(capturedFile)
      const photo = await compressed.arrayBuffer()
      const location = storageLocations.find(l => l.id === offlineLocationId)
      await queueScan({
        photo,
        photoType: compressed.type,
        name: offlineName.trim() || undefined,
        quantity: Math.max(1, offlineQuantity),
        storageLocationId: offlineLocationId,
        storageLocationName: location?.name ?? '',
      })
      setCapturedFile(null)
      setOfflineName('')
      setOfflineQuantity(1)
      setSavedOffline(true)
    } catch {
      setError('Speichern fehlgeschlagen – bitte erneut versuchen.')
    } finally {
      setIsSavingOffline(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        style={{ width: '100%', gap: 6, borderStyle: 'dashed', color: 'var(--muted-foreground)' }}
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Etikett wird gelesen…</>
          : <><Camera className="h-4 w-4" /> Etikett scannen</>}
      </Button>
      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          {error}
        </p>
      )}
      {savedOffline && (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          Wird verarbeitet sobald du wieder online bist.
        </p>
      )}

      <Sheet open={capturedFile !== null} onOpenChange={open => { if (!open) setCapturedFile(null) }}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>Wein offline speichern</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            {storageLocations.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)' }}>
                Lagerort nicht verfügbar — bitte zuerst online öffnen.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ol-name">Name (optional)</Label>
                  <Input
                    id="ol-name"
                    value={offlineName}
                    onChange={e => setOfflineName(e.target.value)}
                    placeholder="z.B. Barolo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ol-qty">Anzahl</Label>
                  <Input
                    id="ol-qty"
                    type="number"
                    min={1}
                    max={999}
                    value={offlineQuantity}
                    onChange={e => setOfflineQuantity(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ol-loc">Lagerort</Label>
                  <select
                    id="ol-loc"
                    value={offlineLocationId}
                    onChange={e => setOfflineLocationId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {storageLocations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={isSavingOffline || !offlineLocationId}
                    onClick={handleOfflineSave}
                  >
                    {isSavingOffline
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : 'Speichern'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCapturedFile(null)}
                  >
                    Abbrechen
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
