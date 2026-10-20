'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [matchError, setMatchError] = useState<string | null>(null)

  const { run, isPending, error } = useServerAction(async () => {
    if (password !== confirm) {
      setMatchError('Passwörter stimmen nicht überein')
      return
    }
    setMatchError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    const after = new URLSearchParams(window.location.search).get('after')
    const dest = after && after.startsWith('/') && !after.startsWith('//') ? after : '/'
    router.push(dest)
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-4xl)',
              fontWeight: 700,
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--primary)',
              lineHeight: 1.1,
              marginBottom: '0.25rem',
            }}
          >
            Vino Mio
          </h1>
          <p className="text-muted-foreground mt-2">Il tuo cellar di famiglia</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Neues Passwort</CardTitle>
            <CardDescription>Mindestens 8 Zeichen</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Neues Passwort</Label>
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
                <Label htmlFor="confirm">Passwort bestätigen</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {matchError && <p className="text-sm text-destructive">{matchError}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <SubmitButton isPending={isPending} className="w-full">Passwort speichern</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
