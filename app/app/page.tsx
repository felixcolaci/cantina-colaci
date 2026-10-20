'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { apiGet } from '@/lib/spa/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'

type Me = {
  userId: string
  email: string | null
  familyId: string | null
  cellarId: string | null
}

export default function SpaRoot() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!sessionLoaded) return null

  return session ? <MeCard /> : <LoginCard />
}

function LoginCard() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) setError('E-Mail oder Passwort falsch')
  }

  return (
    <Card className="max-w-sm mx-auto mt-16">
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>Vino Mio — neue App-Oberfläche (Vorschau)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={pending} className="w-full">Anmelden</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}

function MeCard() {
  const { data, isLoading, error } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => apiGet<Me>('/me'),
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <Card className="max-w-sm mx-auto mt-16">
      <CardHeader>
        <CardTitle>Verbunden ✓</CardTitle>
        <CardDescription>SPA → /api/v1/me → Supabase</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading && <p>Lade…</p>}
        {error && <p className="text-destructive">{(error as Error).message}</p>}
        {data && (
          <>
            <p><span className="text-muted-foreground">User:</span> {data.email}</p>
            <p><span className="text-muted-foreground">Family:</span> {data.familyId ?? '—'}</p>
            <p><span className="text-muted-foreground">Cellar:</span> {data.cellarId ?? '—'}</p>
          </>
        )}
        <button
          onClick={handleLogout}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
        >
          Abmelden
        </button>
      </CardContent>
    </Card>
  )
}
