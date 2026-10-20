import { createClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NewLocationForm } from './new-location-form'
import { LocationList } from './location-list'
import type { StorageLocation } from '@/lib/types'

export default async function LocationsPage() {
  const context = await getCellarContext()
  if (!context) redirect('/onboarding')

  const supabase = await createClient()

  const { data: locations } = context.cellarId
    ? await supabase
        .from('storage_locations')
        .select('*')
        .eq('cellar_id', context.cellarId)
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
