import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

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
            La Cantina Colaci
          </h1>
          <p className="text-muted-foreground mt-2">Eure Weinsammlung</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
