import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'

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

export function apiAuthErrorResponse(err: unknown): Response | null {
  if (err instanceof ApiAuthError) {
    return Response.json({ error: err.message }, { status: err.status })
  }
  return null
}
