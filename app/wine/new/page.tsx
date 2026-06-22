import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineForm } from './wine-form'

export default async function NewWinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: trips } = cellar
    ? await supabase
        .from('trips')
        .select('id, name')
        .eq('cellar_id', cellar.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-6">Wein hinzufügen</h2>
      <WineForm trips={trips ?? []} />
    </div>
  )
}
