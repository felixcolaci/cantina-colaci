import type { AbstractPowerSyncDatabase } from '@powersync/web'
import { createClient } from '@/lib/supabase/client'

// Local SQLite persists per browser profile (IndexedDB), independent of the
// Supabase session. On a shared device, the next person to log in must never
// see this user's rows -- disconnectAndClear() wipes every synced table;
// PowerSync repopulates it from scratch, scoped to whichever user logs in
// next (via a fresh JWT -> auth.user_id() -> fresh sync-config.yaml query).
// The Service Worker's photo-cache (sw.ts) is origin-scoped, not
// user-scoped, so it needs the same treatment -- otherwise the next person
// to log in on this device could still load an old cached photo by hitting
// the same /api/v1/photos/[...path] URL (unlikely to collide across
// families, but cheap to rule out).
export async function logout(db: AbstractPowerSyncDatabase) {
  await db.disconnectAndClear()
  await createClient().auth.signOut()
  await caches.delete('photo-cache').catch(() => {})
}
