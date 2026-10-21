'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { PowerSyncDatabase } from '@powersync/web'
import { PowerSyncContext } from '@powersync/react'
import { AppSchema } from './schema'
import { ApiBackendConnector } from './connector'

// Lazy singleton: created once, in the browser only (the SDK no-ops under
// SSR rather than throwing, but there's no reason to construct it there).
// Module-level `let`, not useState/useMemo, so React StrictMode's double-
// invoke in dev doesn't open two SQLite connections against the same file.
let db: PowerSyncDatabase | undefined

function getDB() {
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
  }
  return db
}

export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const [database] = useState(getDB)
  return (
    <Suspense fallback={null}>
      <PowerSyncContext.Provider value={database}>{children}</PowerSyncContext.Provider>
    </Suspense>
  )
}
