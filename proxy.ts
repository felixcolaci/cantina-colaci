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
  const publicPaths = ['/login', '/register', '/auth/callback', '/join']
  const isPublic = publicPaths.some(p => path === p || path.startsWith(p + '/'))

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
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
