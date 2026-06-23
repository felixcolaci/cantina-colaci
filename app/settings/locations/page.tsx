import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewLocationForm } from './new-location-form'
import { LocationList } from './location-list'
import type { StorageLocation } from '@/lib/types'

export default async function LocationsPage() {
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

  const { data: locations } = cellar
    ? await supabase
        .from('storage_locations')
        .select('*')
        .eq('cellar_id', cellar.id)
        .order('name')
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Lagerorte</h2>
      <LocationList locations={(locations ?? []) as StorageLocation[]} />
      <NewLocationForm />
    </div>
  )
}
