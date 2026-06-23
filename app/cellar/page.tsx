import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineCard } from '@/components/cellar/wine-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WineType } from '@/lib/types'

const wineTypes: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rotwein' },
  { value: 'white', label: 'Weißwein' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaumwein' },
]

export default async function CellarPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/onboarding')

  let query = admin
    .from('wines')
    .select('*, cellar_entries!inner(quantity, photo_url, status)')
    .eq('cellar_id', cellar.id)
    .eq('cellar_entries.status', 'in_stock')
    .gt('cellar_entries.quantity', 0)
    .order('name')

  if (type) query = (query as any).eq('type', type)

  const { data: wines } = await query

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Weinkeller</h2>
        <Button size="sm" render={<Link href="/wine/new" />}>
          <Plus className="h-4 w-4 mr-1" />Hinzufügen
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <Link
          href="/cellar"
          className={cn(
            'shrink-0 px-3 py-1 rounded-full text-sm border transition-colors',
            !type ? 'bg-primary text-primary-foreground' : 'bg-background'
          )}
        >
          Alle
        </Link>
        {wineTypes.map(t => (
          <Link
            key={t.value}
            href={type === t.value ? '/cellar' : `/cellar?type=${t.value}`}
            className={cn(
              'shrink-0 px-3 py-1 rounded-full text-sm border transition-colors',
              type === t.value ? 'bg-primary text-primary-foreground' : 'bg-background'
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {wines && wines.length > 0 ? (
        <div className="space-y-2">
          {wines.map(wine => (
            <WineCard key={wine.id} wine={wine} entries={wine.cellar_entries} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <svg
            width="32" height="64" viewBox="0 0 22 56" fill="none"
            stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round"
            aria-hidden="true" style={{ opacity: 0.5, margin: '0 auto', display: 'block' }}
          >
            <path d="M8 2h6v9c0 1.5 1 2.5 2 3.8 1.8 1.8 3 3.6 3 7.2v28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V22c0-3.6 1.2-5.4 3-7.2 1-1.3 2-2.3 2-3.8V2Z" />
            <line x1="3.5" y1="34" x2="18.5" y2="34" />
          </svg>
          <p className="mt-3">Keine Weine im Keller.</p>
          <Button className="mt-4" render={<Link href="/wine/new" />}>
            Ersten Wein hinzufügen
          </Button>
        </div>
      )}
    </div>
  )
}
