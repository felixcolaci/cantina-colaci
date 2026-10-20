import { getPendingActions, removePendingAction, incrementAttempts, type PendingAction, type PendingActionType } from './db'
import { quickAddWine } from '@/lib/actions/quick-add'
import { addSku } from '@/lib/actions/skus'
import { openBottle } from '@/lib/actions/tasting'
import { updateWine } from '@/lib/actions/wine'
import { updateSku } from '@/lib/actions/skus'

// 'addWine' and 'addWinePhoto' are intentionally NOT mapped here (finding
// 4.2, MAJOR): no queueAction() call site in the codebase queues either key
// today (confirmed by grep), and the previous fallback mappings
// ('addWine' -> quickAddWine, which silently drops region/country/
// grape_variety/notes/trip_id/photo; 'addWinePhoto' -> a no-op that drops
// the photo) would misreport success while silently losing data the moment
// offline support is wired up for the full add-wine form or photo uploads.
// An unmapped action key below is treated as a failure, not a silent
// success, specifically so that regression is caught loudly instead of
// quietly shipping.
const ACTION_MAP = {
  quickAddWine,
  addSku,
  openBottle,
  updateWine,
  updateSku,
} as const

function rebuildFormData(pending: PendingAction): FormData {
  const fd = new FormData()
  for (const [key, val] of Object.entries(pending.fields)) {
    fd.append(key, val)
  }
  for (const f of pending.files) {
    const file = new File([f.data], f.name, { type: f.type })
    fd.append(f.field, file)
  }
  return fd
}

export interface SyncResult {
  synced: number
  failed: number
}

// Module-level in-flight guard (finding 4.1, MAJOR): useOfflineSync calls
// sync() -> processPendingQueue() from two independent, unsynchronized
// triggers (the 'online' event handler and an on-mount effect), and this
// function only removes an item from IndexedDB *after* it resolves -- so two
// overlapping passes would both read and both execute the same still-present
// item. Living here (not just in the React hook) makes the guard robust
// regardless of caller. This is defense-in-depth layered under the
// idempotency-key dedup guard (finding 2.1) on the individual actions, not a
// replacement for it -- keep both.
let inFlight: Promise<SyncResult> | null = null

export async function processPendingQueue(): Promise<SyncResult> {
  if (inFlight) return inFlight
  inFlight = runPendingQueue()
  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

async function runPendingQueue(): Promise<SyncResult> {
  const items = await getPendingActions()
  if (items.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  const actionMap: Partial<Record<PendingActionType, (fd: FormData) => Promise<void>>> = ACTION_MAP

  for (const item of items) {
    const actionFn = actionMap[item.action]
    if (!actionFn) {
      // Unrecognized/unmapped action key: leave it in the queue and count it
      // as a failure (same as a real failure below) rather than silently
      // discarding it, so a future regression like finding 4.2 fails
      // visibly instead of quietly "succeeding" with dropped data.
      await incrementAttempts(item.id)
      failed++
      continue
    }

    try {
      const fd = rebuildFormData(item)
      await (actionFn as (fd: FormData) => Promise<void>)(fd)
      await removePendingAction(item.id)
      synced++
    } catch (err) {
      // NEXT_REDIRECT means success (server action redirected)
      if (
        typeof err === 'object' && err !== null &&
        typeof (err as any).digest === 'string' &&
        (err as any).digest.startsWith('NEXT_REDIRECT')
      ) {
        await removePendingAction(item.id)
        synced++
      } else {
        await incrementAttempts(item.id)
        failed++
      }
    }
  }

  return { synced, failed }
}
