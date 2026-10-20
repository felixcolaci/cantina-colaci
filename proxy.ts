import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  // '/app' is the new SPA shell and the only page left in the active app/
  // tree (everything else moved to legacy/) -- it owns its own auth state
  // client-side via onAuthStateChange, independently of this cookie-gate
  // redirect. Not "public" in the no-auth-required sense: unauthenticated
  // visitors still see a login form, just the SPA's own.
  const unguardedPaths = ['/app']
  const isPublic = unguardedPaths.some(p => path === p || path.startsWith(p + '/'))

  // Everything else -- including bare '/', and any stale link to a since-
  // moved-to-legacy page like '/login' -- redirects to the SPA entry point.
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  return supabaseResponse
}

export const config = {
  // `api` MUST stay excluded here: MCP clients (and any other API route) authenticate via
  // `Authorization: Bearer <api-key>` headers, never a Supabase session cookie, so running this
  // proxy's cookie-based `getUser()` check in front of them 307-redirects every API request to
  // /login instead of ever reaching the route handler (see app/api/mcp/route.ts).
  //
  // `lib/supabase/server.ts#getAuthenticatedUser()` trusts that every request this matcher
  // *does* cover has already been network-validated here, and skips re-validating with its own
  // network call. Any route this matcher excludes (like everything under /api) must not call
  // `getAuthenticatedUser()` without its own independent auth check — see
  // lib/supabase/server.ts#getAuthenticatedUser.
  matcher: ['/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
