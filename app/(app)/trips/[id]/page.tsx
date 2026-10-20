import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { WineCard } from '@/components/cellar/wine-card'
import { StatsCard } from '@/components/dashboard/stats-card'
import { signPhotoPaths } from '@/lib/storage/wine-photos'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCellarContext()
  if (!context || !context.cellarId) redirect('/onboarding')
  const { familyId, cellarId } = context

  const admin = createAdminClient()

  const [tripResult, winesResult] = await Promise.all([
    admin
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('cellar_id', cellarId)
      .maybeSingle(),
    admin
      .from('wines')
      .select('*, skus(id, vintage, quantity, photo_path, status, storage_location_id, purchase_price, trip_id)')
      .eq('cellar_id', cellarId)
      .order('name'),
  ])

  const trip = tripResult.data
  if (!trip) notFound()

  const allWines = winesResult.data ?? []
  const wines = allWines.filter(w =>
    (w.skus as any[]).some((s: any) => s.trip_id === id)
  )

  const skuIds = wines.flatMap(w => (w.skus as any[]).map((s: any) => s.id))
  const { data: tastings } = skuIds.length
    ? await admin.from('tastings').select('rating').in('cellar_entry_id', skuIds)
    : { data: [] as { rating: number }[] }

  const allSkus = wines.flatMap(w => w.skus as any[])
  const inStockSkus = allSkus.filter(s => s.status === 'in_stock')
  const totalBottles = inStockSkus.reduce((sum: number, s: any) => sum + s.quantity, 0)

  const ratings = (tastings ?? []).map(t => t.rating)
  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
    : null

  const prices = allSkus
    .map((s: any) => s.purchase_price)
    .filter((p: unknown): p is number => typeof p === 'number')
  const totalSpend = prices.length ? prices.reduce((s, p) => s + p, 0) : null

  const winesWithSkus = wines.map(w => {
    const filteredSkus = (w.skus as any[]).filter(
      s => s.status === 'in_stock' && s.quantity > 0
    )
    const latestVintage = filteredSkus
      .map((s: any) => s.vintage)
      .filter(Boolean)
      .sort((a: number, b: number) => b - a)[0] ?? null
    return { ...w, skus: filteredSkus, vintage: latestVintage }
  })

  // Batch-resolve every distinct photo path across all wines on this page in
  // one signing request, rather than one per wine.
  type SkuPhotoRow = { photo_path: string | null }
  const photoPaths = winesWithSkus.flatMap(w =>
    (w.skus as SkuPhotoRow[]).map(s => s.photo_path).filter((p): p is string => Boolean(p))
  )
  const signedPhotoUrls = await signPhotoPaths(admin, photoPaths, familyId)

  const winesForCard = winesWithSkus.map(w => {
    const photoPath = (w.skus as SkuPhotoRow[]).find(s => s.photo_path)?.photo_path ?? null
    const photoUrl = photoPath ? signedPhotoUrls.get(photoPath) ?? null : null
    return { ...w, photoUrl }
  })

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
              <WineCard key={wine.id} wine={wine} entries={wine.skus} vintage={wine.vintage} photoUrl={wine.photoUrl} />
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
