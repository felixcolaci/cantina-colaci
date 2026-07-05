import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NewLocationForm } from './new-location-form'
import { LocationList } from './location-list'
import type { StorageLocation } from '@/lib/types'

export default async function LocationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await getAuthenticatedUser()
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
      <Link href="/" className="inline-flex items-center gap-0.5 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
        <ChevronLeft className="h-4 w-4 -ml-0.5" />
        Home
      </Link>
      <h2 className="text-xl font-semibold">Lagerorte</h2>
      <LocationList locations={(locations ?? []) as StorageLocation[]} />
      <NewLocationForm />
    </div>
  )
}
