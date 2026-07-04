# Offline Scan Pipeline Design

**Date:** 2026-07-04
**Status:** Approved

## Problem

The basement has no reliable internet. Users want to photograph wine labels offline, then have AI classify them when connectivity returns, and review the results before committing wines to the cellar.

## Scope

Four tightly coupled pieces, built sequentially:

1. **Offline capture** — `ScanLabelButton` detects offline and shows a capture sheet instead of calling Gemini
2. **Storage location cache** — locations written to `localStorage` when the cellar page loads online, read back offline
3. **AI processing pipeline** — `processPendingScans` runs after `processPendingQueue` when connectivity restores
4. **Review inbox** — badge on the cellar tab + `/cellar/inbox` page to confirm, edit, or discard

## Data Model

A new `pending-scans` IndexedDB object store, added in DB version 2. Lives alongside the existing `pending-actions` store. The existing store and its sync logic are unchanged.

```ts
interface PendingScan {
  id: string
  status: 'queued' | 'processing' | 'ready' | 'discarded'
  // Captured offline
  photo: ArrayBuffer
  photoType: string              // MIME type for the photo
  name?: string                  // optional, entered at capture time
  quantity: number               // default 1
  storageLocationId: string
  storageLocationName: string    // denormalised for offline display
  createdAt: number
  // Filled by AI after sync
  scanResult?: ScanResult        // from lib/actions/scan-label
  processedAt?: number
  processingError?: string       // set if Gemini call failed; status still becomes 'ready'
}
```

Lifecycle:
```
queued → processing → ready → [user action] → (removed from store)
                                             ↘ discarded (kept briefly, then removed)
```

If AI fails, the scan still reaches `ready` with `processingError` set so the user can fill fields manually.

## Storage Location Cache

`localStorage` key: `cantina-storage-locations`

Value: `JSON.stringify(StorageLocation[])` where `StorageLocation = { id: string, name: string }`.

Written in the cellar page's server component or a small client effect whenever the page loads with a fresh network response. Read by `ScanLabelButton` during offline capture.

## Offline Capture Flow

### `ScanLabelButton` changes

New prop: `storageLocations: StorageLocation[]` (passed from the parent that already has the list; falls back to reading `localStorage` if not provided).

Existing behaviour when **online**: unchanged — Gemini runs immediately, `onResult` fires.

New behaviour when **offline**:
1. User taps the button → picks a photo from camera
2. A bottom sheet opens ("Wein offline speichern"):
   - Photo thumbnail
   - Optional name field
   - Quantity field (number, default 1)
   - Storage location picker (select from cached list)
   - "Speichern" button
3. On save: compresses photo, writes `PendingScan` with `status: 'queued'` to IndexedDB
4. Toast: *"Wird verarbeitet sobald du wieder online bist."*
5. Bottom sheet closes; `onResult` is NOT called (no pre-fill, the AI review step handles that)

The `ScanLabelButton` component continues to live at `components/cellar/scan-label-button.tsx`. The offline capture sheet is rendered inside the same component (not a separate file) since it shares the captured photo state.

## AI Processing Pipeline

New file: `lib/offline/scan-sync.ts`

```ts
export async function processPendingScans(): Promise<{ processed: number; failed: number }>
```

Steps:
1. Fetch all records with `status === 'queued'`
2. Mark each `processing` (atomic; prevents double-processing from multiple tabs)
3. For each: rebuild `File` from `ArrayBuffer`, call `scanWineLabel` server action
4. On success: set `status: 'ready'`, write `scanResult` and `processedAt`
5. On error: set `status: 'ready'`, write `processingError` (no `scanResult`)

### Hook integration

`lib/hooks/use-offline-sync.ts` is modified to call `processPendingScans()` after `processPendingQueue()` each time connectivity is restored. Badge count is derived from a `pendingScansCount()` helper that counts `ready` records.

No service worker, no push — the pipeline runs whenever the app is open and comes online.

## Review Inbox

### Badge

The cellar tab navigation shows a numeric badge when `readyScansCount > 0`. The badge is driven by a `usePendingScansCount()` hook that reads from IndexedDB on mount and re-evaluates after each sync.

### Route

`app/(app)/cellar/inbox/page.tsx` — a client component (reads IndexedDB directly).

### Card layout (per scan)

- Photo thumbnail (rendered from stored `ArrayBuffer` via `URL.createObjectURL`)
- Editable fields pre-filled from `scanResult`: name, producer, vintage, type, region, grape_variety
- Warning banner if `processingError` is set: *"KI konnte Etikett nicht lesen — bitte manuell ausfüllen"*
- Read-only: storage location name, quantity (chosen at capture time)
- **Hinzufügen** — calls `quickAddWine` server action, removes record from store on success
- **Verwerfen** — confirmation prompt, then removes record from store

### Empty state

*"Keine ausstehenden Etiketten."* with a brief explanation.

## What Does Not Change

- `lib/offline/db.ts` `PendingAction` type and `pending-actions` store (only DB version bumps to 2)
- `lib/offline/sync.ts` `processPendingQueue` logic
- `lib/actions/scan-label.ts` `scanWineLabel` server action
- `lib/actions/quick-add.ts` `quickAddWine` server action
- All existing `QuickAddSheet` offline behaviour (manual form → `pending-actions` queue)

## Error Handling

| Scenario | Behaviour |
|---|---|
| No storage locations cached | Capture sheet shows empty picker with message *"Lagerort nicht verfügbar — bitte zuerst online öffnen"* |
| Gemini fails during sync | Scan reaches `ready` with `processingError`; user fills manually |
| `quickAddWine` fails during confirm | Toast error; record stays `ready` for retry |
| User discards a scan | Confirmation dialog; record removed from store |
