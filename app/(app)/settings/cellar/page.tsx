import { createClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ResetCellarSheet } from './reset-cellar-sheet'

export default async function CellarSettingsPage() {
  const context = await getCellarContext()
  if (!context || !context.cellarId) redirect('/onboarding')

  const supabase = await createClient()

  const [{ data: cellar }, { data: membership }, { data: family }] = await Promise.all([
    supabase.from('cellars').select('name').eq('id', context.cellarId).maybeSingle(),
    supabase
      .from('family_members')
      .select('role')
      .eq('user_id', context.userId)
      .eq('family_id', context.familyId)
      .maybeSingle(),
    supabase.from('families').select('is_demo').eq('id', context.familyId).maybeSingle(),
  ])

  if (!cellar) redirect('/cellar')

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <Link href="/" className="inline-flex items-center gap-0.5 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
        <ChevronLeft className="h-4 w-4 -ml-0.5" />
        Home
      </Link>
      <h2 className="text-xl font-semibold">Keller</h2>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{cellar.name}</p>

      {membership?.role === 'owner' && !family?.is_demo && (
        <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <h3 className="text-base font-medium" style={{ color: 'var(--destructive)' }}>
            Gefahrenzone
          </h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Entfernt alle Weine, Flaschen, Fotos, Verkostungen, Reisen und
            Lagerorte aus diesem Keller. Diese Aktion kann nicht widerrufen
            werden.
          </p>
          <ResetCellarSheet cellarName={cellar.name} />
        </div>
      )}
    </div>
  )
}
