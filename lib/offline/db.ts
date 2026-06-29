import { openDB, type IDBPDatabase } from 'idb'

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

const DB_NAME = 'cantina-offline'
const DB_VERSION = 1
const STORE = 'pending-actions'

let _db: IDBPDatabase | null = null

export async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
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
        files.push({
          field: key,
          name: value.name,
          type: value.type,
          data: await value.arrayBuffer(),
        })
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
