import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { seedDemoCellar } from '@/lib/actions/demo'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  // Only allow relative redirects — strip any external URL to prevent open redirect
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  // token_hash flow: email links sent without PKCE (works cross-browser / cross-device)
  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]['type'],
      token_hash,
    })
    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth', origin))
    }
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/login/reset-password', origin))
    }
    return NextResponse.redirect(new URL(safeNext, origin))
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth', origin))
    }

    const type = searchParams.get('type')
    if (type === 'recovery') {
      const dest = safeNext.startsWith('/login/reset-password') ? safeNext : '/login/reset-password'
      return NextResponse.redirect(new URL(dest, origin))
    }
    if (type === 'invite') {
      const after = safeNext !== '/' ? `?after=${encodeURIComponent(safeNext)}` : ''
      return NextResponse.redirect(new URL(`/login/reset-password${after}`, origin))
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: membership } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .maybeSingle()

      // New user not joining via invite — auto-seed demo cellar
      if (!membership && !safeNext.startsWith('/join') && !safeNext.startsWith('/login/reset-password')) {
        await seedDemoCellar(user.id)
      }
    }
  }

  return NextResponse.redirect(new URL(safeNext, origin))
}
