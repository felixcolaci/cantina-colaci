'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type View = 'login' | 'forgot' | 'forgot-sent'

export function LoginForm() {
  const router = useRouter()
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const { run: handleLogin, isPending: loginPending, error: loginNetworkError } = useServerAction(async () => {
    setLoginError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError('E-Mail oder Passwort falsch')
      return
    }
    const next = new URLSearchParams(window.location.search).get('next')
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    router.push(safeNext)
  })

  const { run: handleForgot, isPending: forgotPending, error: forgotError } = useServerAction(async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/reset-password`,
    })
    if (error) throw new Error(error.message)
    setView('forgot-sent')
  })

  if (view === 'forgot-sent') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schau in deine Mails</CardTitle>
          <CardDescription>
            Wir haben dir einen Reset-Link an {email} geschickt.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (view === 'forgot') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Passwort vergessen</CardTitle>
          <CardDescription>Gib deine E-Mail ein — wir schicken dir einen Reset-Link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => { e.preventDefault(); handleForgot() }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
                required
              />
            </div>
            {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
            <SubmitButton isPending={forgotPending} className="w-full">Link senden</SubmitButton>
          </form>
          <button
            type="button"
            onClick={() => setView('login')}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground w-full text-center"
          >
            Zurück zum Login
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>Mit E-Mail und Passwort anmelden</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={e => { e.preventDefault(); handleLogin() }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="deine@email.de"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {loginError && <p className="text-sm text-destructive">{loginError}</p>}
          {loginNetworkError && <p className="text-sm text-destructive">{loginNetworkError}</p>}
          <SubmitButton isPending={loginPending} className="w-full">Anmelden</SubmitButton>
        </form>
        <button
          type="button"
          onClick={() => setView('forgot')}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          Passwort vergessen?
        </button>
      </CardContent>
    </Card>
  )
}
