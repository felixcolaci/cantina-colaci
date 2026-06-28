import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { WineCard } from '@/components/cellar/wine-card'
import { StatsCard } from '@/components/dashboard/stats-card'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const [tripResult, winesResult] = await Promise.all([
    admin
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('cellar_id', cellar.id)
      .maybeSingle(),
    admin
      .from('wines')
      .select('*, cellar_entries(id, quantity, photo_url, status, storage_location_id, purchase_price)')
      .eq('trip_id', id)
      .eq('cellar_id', cellar.id)
      .order('name'),
  ])

  const trip = tripResult.data
  if (!trip) notFound()

  const wines = winesResult.data ?? []

  const entryIds = wines.flatMap(w => (w.cellar_entries as any[]).map((e: any) => e.id))
  const { data: tastings } = entryIds.length
    ? await admin.from('tastings').select('rating').in('cellar_entry_id', entryIds)
    : { data: [] as { rating: number }[] }

  const allEntries = wines.flatMap(w => w.cellar_entries as any[])
  const inStockEntries = allEntries.filter(e => e.status === 'in_stock')
  const totalBottles = inStockEntries.reduce((s: number, e: any) => s + e.quantity, 0)

  const ratings = (tastings ?? []).map(t => t.rating)
  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
    : null

  const prices = allEntries
    .map((e: any) => e.purchase_price)
    .filter((p: unknown): p is number => typeof p === 'number')
  const totalSpend = prices.length ? prices.reduce((s, p) => s + p, 0) : null

  const winesForCard = wines.map(w => ({
    ...w,
    cellar_entries: (w.cellar_entries as any[]).filter(
      e => e.status === 'in_stock' && e.quantity > 0
    ),
  }))

  const dateLabel = trip.date_start
    ? trip.date_end
      ? `${formatDate(trip.date_start)} → ${formatDate(trip.date_end)}`
      : formatDate(trip.date_start)
    : null

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <Link
        href="/trips"
        className="inline-flex items-center gap-0.5 text-sm font-medium"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ChevronLeft className="h-4 w-4 -ml-0.5" />
        Reisen
      </Link>

      <div>
        {trip.location && (
          <p className="eyebrow mb-1">{trip.location}</p>
        )}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          lineHeight: 'var(--leading-snug)',
          color: 'var(--foreground)',
          margin: 0,
        }}>
          {trip.name}
        </h1>
        {dateLabel && (
          <p className="mono mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' }}>
            {dateLabel}
          </p>
        )}
      </div>

      <div className={`grid gap-3 ${totalSpend !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <StatsCard title="Flaschen" value={totalBottles} />
        <StatsCard title="Ø Bewertung" value={avgRating ?? '—'} />
        {totalSpend !== null && (
          <StatsCard
            title="Ausgaben"
            value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalSpend)}
          />
        )}
      </div>

      <section>
        <p className="eyebrow mb-3">Weine ({wines.length})</p>
        {wines.length > 0 ? (
          <div className="space-y-2">
            {winesForCard.map(wine => (
              <WineCard key={wine.id} wine={wine} entries={wine.cellar_entries} />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted-foreground)', fontSize: 'var(--text-sm)' }}>
            Noch keine Weine auf dieser Reise.
          </p>
        )}
      </section>

      <div className="h-2" />
    </div>
  )
}
