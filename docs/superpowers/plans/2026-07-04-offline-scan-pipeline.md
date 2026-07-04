# Offline Scan Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users photograph wine labels offline in the basement, then automatically run Gemini classification when back online and present a review inbox before committing wines to the cellar.

**Architecture:** A dedicated `pending-scans` IndexedDB store (separate from the existing `pending-actions` store) holds scans through a `queued → processing → ready` lifecycle. `ScanLabelButton` detects offline at capture time and shows a minimal capture sheet instead of calling Gemini. `processPendingScans` runs after `processPendingQueue` on reconnect, enriches each scan via Gemini, then dispatches a `cantina:scans-updated` DOM event. A badge on the cellar nav tab drives the user to `/cellar/inbox` for review.

**Tech Stack:** `idb` (existing), Next.js App Router server actions, `@google/generative-ai` (existing), React `useTransition`, `localStorage` for location cache.

## Global Constraints

- No test framework — verification is manual (build + browser)
- No Tailwind color classes — CSS custom properties only (`var(--primary)`, `var(--muted-foreground)`, etc.)
- Fonts: `var(--font-body)` / `var(--font-display)` / `var(--font-mono)` — no inline font-family strings
- `localStorage` key for location cache (exact): `cantina-storage-locations`
- Custom DOM event name (exact): `cantina:scans-updated`
- `pending-scans` IndexedDB store name (exact): `'pending-scans'`
- DB_VERSION bumps from `1` to `2`
- Do not add comments to code unless the WHY is non-obvious
- `quickAddWine` only saves: name, producer, type, vintage, quantity, storage_location_id — country/region/grape_variety are NOT supported by that action and are not shown in the review inbox

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/offline/db.ts` | Modify | Add `PendingScan` type, `pending-scans` store, CRUD helpers |
| `lib/offline/location-cache.ts` | Create | `CachedLocation` type, `writeLocationCache`, `readLocationCache` |
| `lib/offline/scan-sync.ts` | Create | `processPendingScans` — runs Gemini on queued scans |
| `components/cellar/location-cache-writer.tsx` | Create | Client component that writes locations to `localStorage` on mount |
| `components/cellar/scan-label-button.tsx` | Rewrite | Add `storageLocations` prop, offline detection, offline capture sheet |
| `lib/hooks/use-pending-scans-count.ts` | Create | Reads `readyScanCount` from IndexedDB, reacts to `cantina:scans-updated` |
| `lib/hooks/use-offline-sync.ts` | Modify | Call `processPendingScans` after `processPendingQueue`, dispatch event |
| `app/(app)/cellar/page.tsx` | Modify | Render `<LocationCacheWriter>`, pass `storageLocations` to `QuickAddSheet` |
| `app/(app)/cellar/quick-add-sheet.tsx` | Modify | Add `storageLocations` prop, pass to `ScanLabelButton` |
| `app/(app)/wine/new/wine-form.tsx` | Modify | Map `storageLocations` to `CachedLocation[]`, pass to `ScanLabelButton` |
| `components/nav/bottom-nav.tsx` | Modify | Import `usePendingScansCount`, show badge on cellar tab |
| `app/(app)/cellar/inbox/page.tsx` | Create | Review inbox — editable cards with Hinzufügen/Verwerfen |

---

## Task 1: Extend IndexedDB with `pending-scans` store

**Files:**
- Modify: `lib/offline/db.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ScanStatus = 'queued' | 'processing' | 'ready'

  export interface PendingScan {
    id: string
    status: ScanStatus
    photo: ArrayBuffer
    photoType: string
    name?: string
    quantity: number
    storageLocationId: string
    storageLocationName: string
    createdAt: number
    scanResult?: import('@/lib/actions/scan-label').ScanResult
    processedAt?: number
    processingError?: string
  }

  export async function queueScan(scan: Omit<PendingScan, 'id' | 'status' | 'createdAt'>): Promise<string>
  export async function getQueuedScans(): Promise<PendingScan[]>
  export async function getReadyScans(): Promise<PendingScan[]>
  export async function updateScan(id: string, updates: Partial<PendingScan>): Promise<void>
  export async function removeScan(id: string): Promise<void>
  export async function readyScanCount(): Promise<number>
  ```

- [ ] **Step 1: Replace `lib/offline/db.ts` with the extended version**

```ts
import { openDB, type IDBPDatabase } from 'idb'
import type { ScanResult } from '@/lib/actions/scan-label'

export type PendingActionType =
  | 'quickAddWine'
  | 'addWine'
  | 'addSku'
  | 'openBottle'
  | 'updateWine'
  | 'updateSku'
  | 'addWinePhoto'

export interface PendingFile {
  field: string
  name: string
  type: string
  data: ArrayBuffer
}

export interface PendingAction {
  id: string
  action: PendingActionType
  fields: Record<string, string>
  files: PendingFile[]
  createdAt: number
  attempts: number
}

export type ScanStatus = 'queued' | 'processing' | 'ready'

export interface PendingScan {
  id: string
  status: ScanStatus
  photo: ArrayBuffer
  photoType: string
  name?: string
  quantity: number
  storageLocationId: string
  storageLocationName: string
  createdAt: number
  scanResult?: ScanResult
  processedAt?: number
  processingError?: string
}

const DB_NAME = 'cantina-offline'
const DB_VERSION = 2
const STORE = 'pending-actions'
const SCAN_STORE = 'pending-scans'

let _db: IDBPDatabase | null = null

export async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(SCAN_STORE)) {
        db.createObjectStore(SCAN_STORE, { keyPath: 'id' })
      }
    },
  })
  return _db
}

export async function queueAction(
  action: PendingActionType,
  formData: FormData,
): Promise<string> {
  const db = await getDb()
  const id = crypto.randomUUID()
  const fields: Record<string, string> = {}
  const files: PendingFile[] = []
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) {
        files.push({ field: key, name: value.name, type: value.type, data: await value.arrayBuffer() })
      }
    } else {
      fields[key] = value
    }
  }
  const pending: PendingAction = { id, action, fields, files, createdAt: Date.now(), attempts: 0 }
  await db.put(STORE, pending)
  return id
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await getDb()
  return db.getAll(STORE)
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

export async function incrementAttempts(id: string): Promise<void> {
  const db = await getDb()
  const item = await db.get(STORE, id)
  if (item) await db.put(STORE, { ...item, attempts: item.attempts + 1 })
}

export async function pendingCount(): Promise<number> {
  const db = await getDb()
  return db.count(STORE)
}

export async function queueScan(
  scan: Omit<PendingScan, 'id' | 'status' | 'createdAt'>,
): Promise<string> {
  const db = await getDb()
  const id = crypto.randomUUID()
  const record: PendingScan = { id, status: 'queued', createdAt: Date.now(), ...scan }
  await db.put(SCAN_STORE, record)
  return id
}

export async function getQueuedScans(): Promise<PendingScan[]> {
  const db = await getDb()
  const all: PendingScan[] = await db.getAll(SCAN_STORE)
  return all.filter(s => s.status === 'queued')
}

export async function getReadyScans(): Promise<PendingScan[]> {
  const db = await getDb()
  const all: PendingScan[] = await db.getAll(SCAN_STORE)
  return all.filter(s => s.status === 'ready')
}

export async function updateScan(id: string, updates: Partial<PendingScan>): Promise<void> {
  const db = await getDb()
  const item = await db.get(SCAN_STORE, id)
  if (item) await db.put(SCAN_STORE, { ...item, ...updates })
}

export async function removeScan(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(SCAN_STORE, id)
}

export async function readyScanCount(): Promise<number> {
  const db = await getDb()
  const all: PendingScan[] = await db.getAll(SCAN_STORE)
  return all.filter(s => s.status === 'ready').length
}
```

- [ ] **Step 2: Verify the build passes**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -10
```

Expected: `✓ Compiled` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add lib/offline/db.ts
git commit -m "feat: extend IndexedDB with pending-scans store"
```

---

## Task 2: Storage location cache + `LocationCacheWriter`

**Files:**
- Create: `lib/offline/location-cache.ts`
- Create: `components/cellar/location-cache-writer.tsx`
- Modify: `app/(app)/cellar/page.tsx`

**Interfaces:**
- Produces:
  ```ts
  // lib/offline/location-cache.ts
  export interface CachedLocation { id: string; name: string }
  export function writeLocationCache(locations: CachedLocation[]): void
  export function readLocationCache(): CachedLocation[]
  ```
  ```ts
  // components/cellar/location-cache-writer.tsx
  export function LocationCacheWriter({ locations }: { locations: CachedLocation[] }): null
  ```

- [ ] **Step 1: Create `lib/offline/location-cache.ts`**

```ts
const KEY = 'cantina-storage-locations'

export interface CachedLocation {
  id: string
  name: string
}

export function writeLocationCache(locations: CachedLocation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(locations))
  } catch {
    // localStorage unavailable
  }
}

export function readLocationCache(): CachedLocation[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as CachedLocation[]
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Create `components/cellar/location-cache-writer.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { writeLocationCache } from '@/lib/offline/location-cache'
import type { CachedLocation } from '@/lib/offline/location-cache'

export function LocationCacheWriter({ locations }: { locations: CachedLocation[] }) {
  useEffect(() => {
    writeLocationCache(locations)
  }, [locations])
  return null
}
```

- [ ] **Step 3: Modify `app/(app)/cellar/page.tsx`**

Add import at the top:

```ts
import { LocationCacheWriter } from '@/components/cellar/location-cache-writer'
```

Add `<LocationCacheWriter locations={locations} />` as the **first child** inside the outer `<div className="px-4 py-6 max-w-lg mx-auto">`:

```tsx
return (
  <div className="px-4 py-6 max-w-lg mx-auto">
    <LocationCacheWriter locations={locations} />
    {isDemo && <DemoBanner />}
    {/* ... rest unchanged ... */}
  </div>
)
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -10
```

Expected: `✓ Compiled`, no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/offline/location-cache.ts components/cellar/location-cache-writer.tsx app/\(app\)/cellar/page.tsx
git commit -m "feat: add storage location cache for offline use"
```

---

## Task 3: Offline capture in `ScanLabelButton` + wire callers

**Files:**
- Rewrite: `components/cellar/scan-label-button.tsx`
- Modify: `app/(app)/cellar/quick-add-sheet.tsx`
- Modify: `app/(app)/cellar/page.tsx`
- Modify: `app/(app)/wine/new/wine-form.tsx`

**Interfaces:**
- Consumes:
  - `CachedLocation` from `lib/offline/location-cache` (Task 2)
  - `queueScan` from `lib/offline/db` (Task 1)
  - `ScanResult` from `lib/actions/scan-label` (existing)
- Produces (modified):
  ```ts
  // components/cellar/scan-label-button.tsx
  export function ScanLabelButton(props: {
    onResult: (r: ScanResult) => void
    storageLocations?: CachedLocation[]
  }): JSX.Element
  ```

- [ ] **Step 1: Rewrite `components/cellar/scan-label-button.tsx`**

Replace the entire file:

```tsx
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
```

- [ ] **Step 2: Modify `app/(app)/cellar/quick-add-sheet.tsx`**

Add import at the top:

```ts
import type { CachedLocation } from '@/lib/offline/location-cache'
```

Add `storageLocations` to the props interface:

```ts
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
})
```

Pass it to `ScanLabelButton` (the existing `<ScanLabelButton onResult={handleScanResult} />` line):

```tsx
<ScanLabelButton onResult={handleScanResult} storageLocations={storageLocations} />
```

- [ ] **Step 3: Modify `app/(app)/cellar/page.tsx`**

Pass `storageLocations={locations}` to every `QuickAddSheet` render. There are two: the one inside the grouped view and the ungrouped view fallback. Find both `<QuickAddSheet` usages in the file and add the prop:

```tsx
<QuickAddSheet
  storageLocationId={group.id}
  storageLocationName={group.name}
  nameHints={nameHints}
  producerHints={producerHints}
  storageLocations={locations}
/>
```

Note: `locations` has type `{ id: string; name: string }[]` from Supabase — this is structurally compatible with `CachedLocation[]`.

- [ ] **Step 4: Modify `app/(app)/wine/new/wine-form.tsx`**

`WineForm` already receives `storageLocations: Pick<StorageLocation, 'id' | 'name' | 'type'>[]`. Pass a mapped version to `ScanLabelButton`.

Add import:

```ts
import type { CachedLocation } from '@/lib/offline/location-cache'
```

Find the existing `<ScanLabelButton onResult={handleScanResult} />` line and replace with:

```tsx
<ScanLabelButton
  onResult={handleScanResult}
  storageLocations={storageLocations.map((l): CachedLocation => ({ id: l.id, name: l.name }))}
/>
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -10
```

Expected: `✓ Compiled`, no TypeScript errors.

- [ ] **Step 6: Manual smoke test (offline capture)**

1. `npm run dev`
2. Open `/cellar` while online — open DevTools → Network → set to Offline
3. Tap `+` on any storage group → tap "Etikett scannen"
4. Pick a photo
5. Confirm the offline capture sheet appears with name/quantity/location picker
6. Fill in a name, tap "Speichern"
7. Confirm the sheet closes and *"Wird verarbeitet sobald du wieder online bist."* appears
8. Check DevTools → Application → IndexedDB → `cantina-offline` → `pending-scans` — confirm a row with `status: 'queued'`

- [ ] **Step 7: Commit**

```bash
git add components/cellar/scan-label-button.tsx app/\(app\)/cellar/quick-add-sheet.tsx app/\(app\)/cellar/page.tsx "app/(app)/wine/new/wine-form.tsx"
git commit -m "feat: add offline capture sheet to ScanLabelButton"
```

---

## Task 4: AI processing pipeline

**Files:**
- Create: `lib/offline/scan-sync.ts`
- Modify: `lib/hooks/use-offline-sync.ts`

**Interfaces:**
- Consumes:
  - `getQueuedScans`, `updateScan` from `lib/offline/db` (Task 1)
  - `scanWineLabel` from `lib/actions/scan-label` (existing)
- Produces:
  ```ts
  // lib/offline/scan-sync.ts
  export interface ScanSyncResult { processed: number; failed: number }
  export async function processPendingScans(): Promise<ScanSyncResult>
  ```

- [ ] **Step 1: Create `lib/offline/scan-sync.ts`**

```ts
import { getQueuedScans, updateScan } from '@/lib/offline/db'
import { scanWineLabel } from '@/lib/actions/scan-label'

export interface ScanSyncResult {
  processed: number
  failed: number
}

export async function processPendingScans(): Promise<ScanSyncResult> {
  const scans = await getQueuedScans()
  if (scans.length === 0) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0

  for (const scan of scans) {
    await updateScan(scan.id, { status: 'processing' })

    try {
      const file = new File([scan.photo], 'label.jpg', { type: scan.photoType })
      const fd = new FormData()
      fd.set('image', file)
      const result = await scanWineLabel(fd)

      if (result.error) {
        await updateScan(scan.id, {
          status: 'ready',
          processingError: result.error,
          processedAt: Date.now(),
        })
        failed++
      } else {
        const { error: _e, ...scanResult } = result
        await updateScan(scan.id, {
          status: 'ready',
          scanResult,
          processedAt: Date.now(),
        })
        processed++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
      await updateScan(scan.id, {
        status: 'ready',
        processingError: message,
        processedAt: Date.now(),
      })
      failed++
    }
  }

  return { processed, failed }
}
```

- [ ] **Step 2: Modify `lib/hooks/use-offline-sync.ts`**

Replace the `sync` callback to call `processPendingScans` after `processPendingQueue` and dispatch the DOM event when scans are processed:

```ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  lastSyncResult: { synced: number; failed: number } | null
}

export function useOfflineSync(): SyncState {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null)
  const router = useRouter()

  useEffect(() => {
    setIsOnline(navigator.onLine)
  }, [])

  const sync = useCallback(async () => {
    setIsSyncing(true)
    try {
      const { processPendingQueue } = await import('@/lib/offline/sync')
      const { processPendingScans } = await import('@/lib/offline/scan-sync')
      const result = await processPendingQueue()
      if (result.synced > 0 || result.failed > 0) {
        setLastSyncResult(result)
        if (result.synced > 0) {
          router.refresh()
          setTimeout(() => setLastSyncResult(null), 5000)
        }
      }
      const scanResult = await processPendingScans()
      if (scanResult.processed > 0 || scanResult.failed > 0) {
        window.dispatchEvent(new CustomEvent('cantina:scans-updated'))
      }
    } finally {
      setIsSyncing(false)
    }
  }, [router])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      sync()
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  useEffect(() => {
    if (navigator.onLine) sync()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { isOnline, isSyncing, lastSyncResult }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -10
```

Expected: `✓ Compiled`, no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/offline/scan-sync.ts lib/hooks/use-offline-sync.ts
git commit -m "feat: add AI processing pipeline for offline scans"
```

---

## Task 5: Badge + review inbox

**Files:**
- Create: `lib/hooks/use-pending-scans-count.ts`
- Modify: `components/nav/bottom-nav.tsx`
- Create: `app/(app)/cellar/inbox/page.tsx`

**Interfaces:**
- Consumes:
  - `readyScanCount` from `lib/offline/db` (Task 1)
  - `getReadyScans`, `removeScan`, `PendingScan` from `lib/offline/db` (Task 1)
  - `quickAddWine` from `lib/actions/quick-add` (existing)
  - `cantina:scans-updated` DOM event (Task 4)

- [ ] **Step 1: Create `lib/hooks/use-pending-scans-count.ts`**

```ts
'use client'

import { useEffect, useState } from 'react'

export function usePendingScansCount(): number {
  const [count, setCount] = useState(0)

  async function refresh() {
    const { readyScanCount } = await import('@/lib/offline/db')
    setCount(await readyScanCount())
  }

  useEffect(() => {
    refresh()
    window.addEventListener('cantina:scans-updated', refresh as EventListener)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('cantina:scans-updated', refresh as EventListener)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return count
}
```

- [ ] **Step 2: Rewrite `components/nav/bottom-nav.tsx`**

Replace the entire file. The only changes are: import `usePendingScansCount`, compute `badge` and `resolvedHref` for the cellar tab, add badge rendering, update `isActive` to cover `/cellar/*`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePendingScansCount } from '@/lib/hooks/use-pending-scans-count'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    href: '/cellar',
    label: 'Keller',
    icon: (
      <>
        <path d="M8 22h8" />
        <path d="M7 10h10" />
        <path d="M12 15v7" />
        <path d="M7 2h10l-1.2 8.5a4 4 0 0 1-7.6 0L7 2Z" />
      </>
    ),
  },
  {
    href: '/trips',
    label: 'Reisen',
    icon: (
      <>
        <path d="M12 2a7 7 0 0 1 7 7c0 4.5-7 13-7 13S5 13.5 5 9a7 7 0 0 1 7-7Z" />
        <circle cx="12" cy="9" r="2.5" />
      </>
    ),
  },
  {
    href: '/history',
    label: 'Chronik',
    icon: (
      <>
        <path d="M12 8v13" />
        <path d="M8 21h8" />
        <path d="M5 3h14l-1 4.5a6 6 0 0 1-12 0L5 3Z" />
      </>
    ),
  },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const pendingScans = usePendingScansCount()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
      style={{
        background: 'color-mix(in oklab, var(--card) 88%, transparent)',
        backdropFilter: 'saturate(140%) blur(12px)',
        borderTop: '1px solid var(--border)',
        boxShadow: 'var(--shadow-nav-top)',
        padding: '8px 10px',
        paddingBottom: 'calc(8px + var(--safe-bottom))',
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isCellar = href === '/cellar'
        const badge = isCellar ? pendingScans : 0
        const resolvedHref = isCellar && pendingScans > 0 ? '/cellar/inbox' : href
        const isActive = isCellar
          ? pathname === '/cellar' || pathname.startsWith('/cellar/')
          : pathname === href
        return (
          <Link
            key={href}
            href={resolvedHref}
            aria-label={label}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-1"
            style={{
              color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
              transition: `color var(--duration-fast) var(--ease-standard)`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <svg
                width="22" height="22" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                strokeWidth={isActive ? 2.3 : 1.9}
                strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                {icon}
              </svg>
              {badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.5625rem',
                  fontWeight: 800,
                  minWidth: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  lineHeight: 1,
                }}>
                  {badge}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.6875rem',
                fontWeight: isActive ? 800 : 600,
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Create `app/(app)/cellar/inbox/page.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error|✓ Compiled" | head -10
```

Expected: `✓ Compiled`, no TypeScript errors.

- [ ] **Step 5: Full end-to-end smoke test**

**Offline capture:**
1. `npm run dev` and open `/cellar` while online — locations are written to `localStorage`
2. DevTools → Network → Offline
3. Tap `+` → "Etikett scannen" → pick a photo → fill capture sheet → save
4. Verify `pending-scans` store has `status: 'queued'`

**AI processing:**
5. DevTools → Network → Online
6. Wait ~5 seconds for sync to run (or refresh the page)
7. Verify `pending-scans` record now has `status: 'ready'` with a `scanResult` field

**Review inbox:**
8. Verify the "Keller" nav tab shows a badge with count `1`
9. Tap the badge → lands on `/cellar/inbox`
10. Card shows photo thumbnail, AI-detected name/producer/type/vintage (editable)
11. Tap "Hinzufügen" → wine appears in the cellar at `/cellar`
12. Badge disappears

**Error path:**
13. Repeat steps 1-4 with airplane mode fully on (no sync possible)
14. Re-enable network — sync runs, Gemini is called
15. If Gemini returns an error, card shows the warning banner — user fills manually and confirms

- [ ] **Step 6: Commit**

```bash
git add lib/hooks/use-pending-scans-count.ts components/nav/bottom-nav.tsx "app/(app)/cellar/inbox/page.tsx"
git commit -m "feat: add review inbox with badge for offline scans"
```
