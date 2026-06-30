import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { seedDemoCellar } from '@/lib/actions/demo'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Only allow relative redirects — strip any external URL to prevent open redirect
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth', origin))
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
