import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/web'
import { UpdateType } from '@powersync/web'
import { createClient } from '@/lib/supabase/client'
import { apiMutate, ApiError } from '@/lib/spa/api-client'

// PowerSync's own replication/bucket-storage/checkpointing stays entirely
// PowerSync's job; this connector only tells it (a) which token proves who
// the user is, and (b) where local writes go. fetchCredentials hands over
// the user's own Supabase access token as-is -- the self-hosted PowerSync
// service is configured with client_auth.supabase: true + jwks_uri, so it
// verifies that token itself against Supabase's JWKS, no separate token-
// minting endpoint needed.
//
// uploadData deliberately does NOT write straight to PostgREST the way
// PowerSync's own Supabase reference connector does: this project's
// Postgres can't verify Supabase's ES256 auth JWTs (see lib/api/auth.ts),
// so auth.uid() is NULL for a PostgREST request carrying the user's own
// token, and RLS can't be the authorization boundary here. Writes instead
// go through /api/v1/<table>, which verifies identity via a real Supabase
// Auth network call and then applies the same admin-client + explicit
// ownership checks every Server Action already uses.
export class ApiBackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    // .trim() guards against a stray trailing space in the env var (e.g. a
    // pasted Vercel value) -- Safari parses the resulting URL as containing
    // credentials instead of just failing the request, which is a much
    // harder error to trace back to its cause.
    const endpoint = process.env.NEXT_PUBLIC_POWERSYNC_URL?.trim()
    if (!endpoint) throw new Error('NEXT_PUBLIC_POWERSYNC_URL is not set')

    return { endpoint, token: session.access_token }
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    try {
      for (const op of transaction.crud) {
        const path = `/${op.table}/${op.id}`
        switch (op.op) {
          case UpdateType.PUT:
            await apiMutate('PUT', path, op.opData)
            break
          case UpdateType.PATCH:
            await apiMutate('PATCH', path, op.opData)
            break
          case UpdateType.DELETE:
            await apiMutate('DELETE', path)
            break
        }
      }
      await transaction.complete()
    } catch (err) {
      // A 4xx means the write itself is invalid (bad ownership, bad shape) --
      // retrying it forever would wedge the upload queue, so discard it.
      // Anything else (network down, 5xx) is retried by PowerSync later.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        await transaction.complete()
        return
      }
      throw err
    }
  }
}
