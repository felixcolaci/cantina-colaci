import { getPendingActions, removePendingAction, incrementAttempts, type PendingAction } from './db'
import { quickAddWine } from '@/lib/actions/quick-add'
import { addSku } from '@/lib/actions/skus'
import { openBottle } from '@/lib/actions/tasting'
import { updateWine } from '@/lib/actions/wine'
import { updateSku } from '@/lib/actions/skus'

const ACTION_MAP = {
  quickAddWine,
  addWine: quickAddWine, // fallback to quick-add for offline-queued full adds
  addSku,
  openBottle,
  updateWine,
  updateSku,
  addWinePhoto: async () => { /* photo uploads require server-side storage, skip */ },
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

export async function processPendingQueue(): Promise<SyncResult> {
  const items = await getPendingActions()
  if (items.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const item of items) {
    const actionFn = ACTION_MAP[item.action]
    if (!actionFn) {
      await removePendingAction(item.id)
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
