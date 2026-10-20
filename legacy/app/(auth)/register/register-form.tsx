'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerWithCode } from '@/lib/actions/auth'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)

  const { run: handleRegister, isPending } = useServerAction(async () => {
    setRegisterError(null)
    const result = await registerWithCode(email, password, code)
    if (result.error) {
      setRegisterError(result.error)
      return
    }
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      router.push('/login')
      return
    }
    router.push('/')
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrieren</CardTitle>
        <CardDescription>Einladungscode eingeben und Account erstellen</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={e => { e.preventDefault(); handleRegister() }} className="space-y-4">
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
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Einladungscode</Label>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="WEIN-2026-ABC"
              required
            />
          </div>
          {registerError && <p className="text-sm text-destructive">{registerError}</p>}
          <SubmitButton isPending={isPending} className="w-full">Account erstellen</SubmitButton>
        </form>
        <div className="mt-3 text-sm text-muted-foreground text-center">
          Bereits registriert?{' '}
          <Link href="/login" className="hover:text-foreground underline">Anmelden</Link>
        </div>
      </CardContent>
    </Card>
  )
}
