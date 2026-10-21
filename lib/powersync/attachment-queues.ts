import {
  AttachmentQueue,
  IndexDBFileSystemStorageAdapter,
  type AttachmentRecord,
  type PowerSyncDatabase,
  type RemoteStorageAdapter,
  type WatchedAttachmentItem,
} from '@powersync/web'
import { apiMutate, apiPutBytes } from '@/lib/spa/api-client'

// Builds the RemoteStorageAdapter an AttachmentQueue uses to move bytes --
// upload/delete hit the bytes-only endpoints (app/api/v1/wines/[id]/photos/[photoId],
// app/api/v1/discoveries/[id]/photo/[photoId]); download is never called
// (downloadAttachments: false below -- the read path is the stable
// /api/v1/photos/[...path] cache, not a local copy of every photo).
function remoteStorage(buildPath: (attachment: AttachmentRecord) => string): RemoteStorageAdapter {
  return {
    async uploadFile(fileData, attachment) {
      await apiPutBytes(buildPath(attachment), fileData, attachment.mediaType ?? 'application/octet-stream')
    },
    async deleteFile(attachment) {
      await apiMutate('DELETE', buildPath(attachment))
    },
    async downloadFile() {
      throw new Error('downloadFile is never called: downloadAttachments is false')
    },
  }
}

// Drives the queue from a synced metadata table (wine_photos/discovery_photos)
// instead of PowerSync's CRUD queue -- a row appearing/disappearing there
// (locally, even fully offline, or once synced from another device) is what
// queues an upload or archives/orphans a pending one. See
// AttachmentQueue.startSync()'s diffing in @powersync/common for the exact
// mechanics this relies on.
function watchRows(
  db: PowerSyncDatabase,
  sql: string,
  toItem: (row: Record<string, unknown>) => WatchedAttachmentItem,
) {
  return (onUpdate: (items: WatchedAttachmentItem[]) => Promise<void>, signal: AbortSignal) => {
    void (async () => {
      for await (const result of db.watch(sql, [], { signal })) {
        await onUpdate((result.rows?._array ?? []).map(toItem))
      }
    })()
  }
}

export function createWineAttachmentQueue(db: PowerSyncDatabase) {
  return new AttachmentQueue({
    db,
    tableName: 'wine_photo_attachments', // matches lib/powersync/schema.ts's AttachmentTable
    localStorage: new IndexDBFileSystemStorageAdapter('wine-photo-attachments'),
    remoteStorage: remoteStorage(
      attachment => `/wines/${JSON.parse(attachment.metaData!).wineId}/photos/${attachment.id}`,
    ),
    downloadAttachments: false,
    watchAttachments: watchRows(db, 'SELECT id, wine_id, path FROM wine_photos', row => ({
      id: row.id as string,
      fileExtension: (row.path as string).split('.').pop()!,
      metaData: JSON.stringify({ wineId: row.wine_id }),
    })),
  })
}

export function createDiscoveryAttachmentQueue(db: PowerSyncDatabase) {
  return new AttachmentQueue({
    db,
    tableName: 'discovery_photo_attachments', // matches lib/powersync/schema.ts's AttachmentTable
    localStorage: new IndexDBFileSystemStorageAdapter('discovery-photo-attachments'),
    remoteStorage: remoteStorage(
      attachment => `/discoveries/${JSON.parse(attachment.metaData!).discoveryId}/photo/${attachment.id}`,
    ),
    downloadAttachments: false,
    watchAttachments: watchRows(db, 'SELECT id, discovery_id, path FROM discovery_photos', row => ({
      id: row.id as string,
      fileExtension: (row.path as string).split('.').pop()!,
      metaData: JSON.stringify({ discoveryId: row.discovery_id }),
    })),
  })
}
