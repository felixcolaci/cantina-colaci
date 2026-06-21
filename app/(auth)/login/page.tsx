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
          <p className="text-5xl mb-3">🍷</p>
          <h1 className="text-3xl font-bold">La Cantina Colaci</h1>
          <p className="text-muted-foreground mt-2">La vostra collezione di vini</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
