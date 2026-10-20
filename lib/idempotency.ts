import type { createAdminClient } from '@/lib/supabase/server'

/** Postgres unique-violation error code. */
const UNIQUE_VIOLATION = '23505'

/**
 * Claims a client-generated idempotency key for a mutating server action,
 * guarding against lib/hooks/use-server-action.ts's automatic retry
 * double-applying a non-idempotent mutation (review-results.md finding 2.1).
 *
 * - Returns `true` if `key` is null/undefined: a no-op passthrough so any
 *   caller not yet passing a key behaves exactly as before.
 * - Returns `true` if this is the first claim of `key` (the insert
 *   succeeded) -- the caller should proceed with its mutation.
 * - Returns `false` if `key` was already claimed (insert hit a unique
 *   violation) -- the caller should skip its mutation and take the same
 *   success path it would have taken on a genuine first success, since this
 *   call is a retry of an attempt that already committed.
 *
 * Any other database error is rethrown rather than treated as "already
 * claimed" -- only a confirmed unique violation means "duplicate attempt."
 */
export async function claimIdempotencyKey(
  admin: ReturnType<typeof createAdminClient>,
  key: string | null | undefined,
): Promise<boolean> {
  if (!key) return true

  const { error } = await admin.from('idempotency_keys').insert({ key })
  if (!error) return true
  if (error.code === UNIQUE_VIOLATION) return false
  throw new Error(error.message)
}
