import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore: called from Server Component
          }
        },
      },
    }
  )
}

// Deduplicates auth.getUser() within a single request — layout, top-bar,
// and page Server Components all call this; React.cache() collapses
// them into one network round trip instead of three.
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})

// Service-role client for database operations.
// Supabase Auth v3 issues ES256 JWTs that PostgREST cannot verify with its HS256
// secret, so auth.uid() returns NULL and all RLS policies fail. As a workaround,
// server-side code uses this client (which authenticates via the service-role HS256
// JWT) after verifying the user identity through createClient().auth.getUser().
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}
