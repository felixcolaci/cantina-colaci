import { getDb, getQueuedScans, updateScan, SCAN_STORE } from '@/lib/offline/db'
import type { PendingScan } from '@/lib/offline/db'
import { scanWineLabel } from '@/lib/actions/scan-label'

export interface ScanSyncResult {
  processed: number
  failed: number
}

export async function processPendingScans(): Promise<ScanSyncResult> {
  // Reset scans stuck in processing from a previous interrupted sync
  const db = await getDb()
  const allScans: PendingScan[] = await db.getAll(SCAN_STORE)
  for (const s of allScans.filter(s => s.status === 'processing')) {
    await updateScan(s.id, { status: 'queued' })
  }

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
        const { error: _ignored, ...scanResult } = result
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
