import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineCard } from '@/components/cellar/wine-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { WineType } from '@/lib/types'
import { getFeatureFlags } from '@/lib/flags'
import { DemoBanner } from './demo-banner'

const wineTypes: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rotwein' },
  { value: 'white', label: 'Weißwein' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaumwein' },
]

export default async function CellarPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; location?: string }>
}) {
  const { type, location } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/login')

  const [flags, locationsResult, familyResult, winesResult] = await Promise.all([
    getFeatureFlags(membership.family_id),
    admin
      .from('storage_locations')
      .select('id, name')
      .eq('cellar_id', cellar.id)
      .order('name'),
    admin
      .from('families')
      .select('is_demo')
      .eq('id', membership.family_id)
      .maybeSingle(),
    (async () => {
      let query = admin
        .from('wines')
        .select('*, cellar_entries(quantity, photo_url, status, storage_location_id)')
        .eq('cellar_id', cellar.id)
        .order('name')

      if (type) query = (query as any).eq('type', type)
      return query
    })(),
  ])

  const locations = locationsResult.data
  const isDemo = familyResult.data?.is_demo ?? false
  const { data: rawWines } = await winesResult
  const wines = rawWines
    ?.map(w => ({
      ...w,
      cellar_entries: (w.cellar_entries as any[]).filter(
        e => e.status === 'in_stock' && e.quantity > 0 &&
             (!location || e.storage_location_id === location)
      ),
    }))
    .filter(w => w.cellar_entries.length > 0) ?? []
  const atLimit = !flags.unlimited_cellar && wines.length >= 50

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {isDemo && <DemoBanner />}

      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 'var(--text-xl)' }}>Weinkeller</h2>
        <Button size="sm" render={<Link href="/wine/new" />}>
          <Plus className="h-4 w-4 mr-1" />Hinzufügen
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <Link
          href="/cellar"
          style={{
            flexShrink: 0,
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            border: !type ? 'none' : '1px solid var(--border)',
            background: !type ? 'var(--primary)' : 'var(--background)',
            color: !type ? 'var(--primary-foreground)' : 'var(--foreground)',
            transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
            whiteSpace: 'nowrap',
          }}
        >
          Alle
        </Link>
        {wineTypes.map(t => {
          const active = type === t.value
          return (
            <Link
              key={t.value}
              href={active ? '/cellar' : `/cellar?type=${t.value}`}
              style={{
                flexShrink: 0,
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                border: active ? 'none' : '1px solid var(--border)',
                background: active ? 'var(--primary)' : 'var(--background)',
                color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
                transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {locations && locations.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <Link
            href={type ? `/cellar?type=${type}` : '/cellar'}
            style={{
              flexShrink: 0,
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              border: !location ? 'none' : '1px solid var(--border)',
              background: !location ? 'var(--primary)' : 'var(--background)',
              color: !location ? 'var(--primary-foreground)' : 'var(--foreground)',
              transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
              whiteSpace: 'nowrap',
            }}
          >
            Alle Orte
          </Link>
          {locations.map(loc => {
            const active = location === loc.id
            const params = new URLSearchParams()
            if (type) params.set('type', type)
            if (!active) params.set('location', loc.id)
            return (
              <Link
                key={loc.id}
                href={`/cellar?${params.toString()}`}
                style={{
                  flexShrink: 0,
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  border: active ? 'none' : '1px solid var(--border)',
                  background: active ? 'var(--primary)' : 'var(--background)',
                  color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
                  transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
                  whiteSpace: 'nowrap',
                }}
              >
                {loc.name}
              </Link>
            )
          })}
        </div>
      )}

      {atLimit && (
        <div
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'color-mix(in oklab, var(--warning) 10%, var(--background))',
            border: '1px solid color-mix(in oklab, var(--warning) 30%, transparent)',
            color: 'var(--warning)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Limite von 50 Weinen im kostenlosen Plan erreicht.
          <span style={{ fontWeight: 'var(--weight-semibold)' as any, marginLeft: 'var(--space-1)' }}>
            Wechsle zu Pro für unbegrenzten Keller.
          </span>
        </div>
      )}

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
