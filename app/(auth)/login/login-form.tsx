'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const { run, isPending, error } = useServerAction(async () => {
    const supabase = createClient()
    const next = new URLSearchParams(window.location.search).get('next') ?? ''
    if (next) {
      document.cookie = `auth_next=${encodeURIComponent(next)}; path=/; max-age=600; SameSite=Lax`
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (otpError) throw new Error(otpError.message)
    setSent(true)
  })

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schau in deine E-Mails</CardTitle>
          <CardDescription>Ciao! Wir haben dir einen Anmeldelink an {email} geschickt.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>E-Mail eingeben — wir schicken dir einen magischen Link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Link senden</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
