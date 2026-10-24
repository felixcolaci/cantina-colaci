'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { PowerSyncDatabase } from '@powersync/web'
import { PowerSyncContext } from '@powersync/react'
import { AppSchema } from './schema'
import { ApiBackendConnector } from './connector'
import { createWineAttachmentQueue, createDiscoveryAttachmentQueue } from './attachment-queues'

// Lazy singleton: created once, in the browser only (the SDK no-ops under
// SSR rather than throwing, but there's no reason to construct it there).
// Module-level `let`, not useState/useMemo, so React StrictMode's double-
// invoke in dev doesn't open two SQLite connections against the same file.
let db: PowerSyncDatabase | undefined
let wineAttachmentQueue: ReturnType<typeof createWineAttachmentQueue> | undefined
let discoveryAttachmentQueue: ReturnType<typeof createDiscoveryAttachmentQueue> | undefined

export function getDB() {
  if (!db) {
    db = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: 'cantina-colaci.db',
        worker: '/@powersync/worker.js',
        // Next statically prerenders /app's initial HTML shell with a server
        // pass even though it's a client component; the SDK correctly no-ops
        // there (see the Next.js integration guide's SSR caveat) -- this just
        // silences the expected warning that pass triggers.
        disableSSRWarning: true,
      },
      sync: {
        worker: '/@powersync/worker.js',
      },
    })
    db.connect(new ApiBackendConnector())

    // Offline photo uploads: metadata rows (wine_photos/discovery_photos)
    // sync through the connector above like any other table; the bytes
    // travel separately through these queues (see lib/powersync/attachment-queues.ts).
    //
    // Unlike PowerSyncDatabase itself, AttachmentQueue.startSync() is NOT
    // SSR-safe -- it calls straight into IndexDBFileSystemStorageAdapter's
    // initialize(), which throws ReferenceError: indexedDB is not defined
    // under Node. Since it's fire-and-forget (void, no .catch), that became
    // an unhandled rejection that killed the whole server process on every
    // single /app request (confirmed in production logs) -- so guard it the
    // same way the dbFilename/worker setup above implicitly assumes a
    // browser, just explicitly this time.
    if (typeof indexedDB !== 'undefined') {
      wineAttachmentQueue = createWineAttachmentQueue(db)
      discoveryAttachmentQueue = createDiscoveryAttachmentQueue(db)
      void wineAttachmentQueue.startSync()
      void discoveryAttachmentQueue.startSync()
    }
  }
  return db
}

export function getWineAttachmentQueue() {
  getDB() // ensures the queues exist
  return wineAttachmentQueue!
}

export function getDiscoveryAttachmentQueue() {
  getDB()
  return discoveryAttachmentQueue!
}

export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const [database] = useState(getDB)
  return (
    <Suspense fallback={null}>
      <PowerSyncContext.Provider value={database}>{children}</PowerSyncContext.Provider>
    </Suspense>
  )
}
