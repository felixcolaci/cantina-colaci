import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/server'

export class ApiAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

/**
 * Verifies the SPA's bearer token for /api/v1/** routes.
 *
 * Deliberately NOT the RLS-via-user-JWT pattern: this project's Postgres
 * can't verify Supabase's ES256 auth JWTs (see lib/supabase/server.ts's
 * createAdminClient comment), so auth.uid() is NULL for any connection
 * authenticated with a user's own token. Identity is verified here against
 * Supabase Auth itself (a real network call, not local JWT decoding), and
 * callers must then use createAdminClient() + explicit ownership checks --
 * the same pattern every lib/actions/* file already uses for Server Actions.
 */
export async function requireApiUser(request: Request): Promise<User> {
  const header = request.headers.get('authorization')
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new ApiAuthError('Missing bearer token')

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new ApiAuthError('Invalid or expired token')

  return data.user
}

type CellarContextRow = { family_id: string; cellar_id: string | null }

/**
 * Ownership check shared by every /api/v1/<table> write route the PowerSync
 * upload connector drains (lib/powersync/connector.ts): confirms `cellarId`
 * is actually the caller's own cellar before an insert/update touching it is
 * allowed to land. Reuses get_cellar_context, the same RPC /api/v1/me reads
 * from, rather than re-deriving family/cellar membership per route.
 */
export async function requireOwnCellar(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
  cellarId: string,
): Promise<void> {
  const { data } = await admin
    .rpc('get_cellar_context', { p_user_id: user.id })
    .maybeSingle<CellarContextRow>()
  if (!data?.cellar_id || data.cellar_id !== cellarId) {
    throw new ApiAuthError('Ungültiger Keller', 403)
  }
}

export function apiAuthErrorResponse(err: unknown): Response | null {
  if (err instanceof ApiAuthError) {
    return Response.json({ error: err.message }, { status: err.status })
  }
  return null
}
