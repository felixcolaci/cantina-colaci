import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { OpenBottleButton } from './open-bottle-button'
import { WineEditSheet } from './wine-edit-sheet'
import { EntryCard } from './entry-card'
import { PhotoGallery } from './photo-gallery'
import type { WineType } from '@/lib/types'

const TYPE_CONFIG: Record<WineType, { label: string; bg: string; fg: string; hero: string }> = {
  red: {
    label: 'Rotwein',
    bg: 'var(--type-red-bg)',
    fg: 'var(--type-red-fg)',
    hero: 'linear-gradient(160deg, #5b1e22 0%, #3d1417 55%, #2d1008 100%)',
  },
  white: {
    label: 'Weißwein',
    bg: 'var(--type-white-bg)',
    fg: 'var(--type-white-fg)',
    hero: 'linear-gradient(160deg, #9a7611 0%, #6b520d 55%, #4a3908 100%)',
  },
  rosé: {
    label: 'Rosé',
    bg: 'var(--type-rose-bg)',
    fg: 'var(--type-rose-fg)',
    hero: 'linear-gradient(160deg, #b06a72 0%, #7a3a40 55%, #3a1417 100%)',
  },
  sparkling: {
    label: 'Schaumwein',
    bg: 'var(--type-sparkling-bg)',
    fg: 'var(--type-sparkling-fg)',
    hero: 'linear-gradient(160deg, #4f7390 0%, #2d4d64 55%, #1a2d3d 100%)',
  },
}

export default async function WineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) redirect('/login')

  const [wineResult, storageLocResult, photosResult] = await Promise.all([
    admin.from('wines').select('*').eq('id', id).eq('cellar_id', cellar.id).maybeSingle(),
    admin.from('storage_locations').select('id, name').eq('cellar_id', cellar.id).order('name'),
    admin.from('wine_photos').select('id, url').eq('wine_id', id).order('sort_order').order('created_at'),
  ])

  const wine = wineResult.data
  if (!wine) notFound()

  const storageLocations = storageLocResult.data ?? []
  const winePhotos = (photosResult.data ?? []) as { id: string; url: string }[]

  const { data: entries } = await admin
    .from('cellar_entries')
    .select('*, storage_locations(name, type)')
    .eq('wine_id', id)
    .order('created_at', { ascending: false })

  const entryIds = (entries ?? []).map(e => e.id)
  const { data: tastings } = entryIds.length
    ? await admin.from('tastings').select('*').in('cellar_entry_id', entryIds).order('date', { ascending: false })
    : { data: [] }

  const inStockEntries = (entries ?? []).filter(e => e.status === 'in_stock')
  const totalBottles = inStockEntries.reduce((sum, e) => sum + e.quantity, 0)
  const legacyEntry = (entries ?? []).find(e => e.photo_url) ?? null
  const legacyPhoto = legacyEntry?.photo_url ?? null
  const legacyEntryId = legacyEntry?.id ?? null

  const typeConf = TYPE_CONFIG[wine.type as WineType] ?? TYPE_CONFIG.red

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero */}
      <PhotoGallery
        photos={winePhotos}
        wineId={wine.id}
        fallbackUrl={legacyPhoto}
        fallbackEntryId={legacyEntryId}
        heroBg={typeConf.hero}
      >
        {/* Back button */}
        <Link
          href="/cellar"
          className="absolute top-3 left-3 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
        >
          <ChevronLeft className="h-4 w-4 -ml-0.5" />
          Keller
        </Link>

        {/* Edit wine button — positions itself absolute top-right */}
        <WineEditSheet wine={wine} />

        {/* Name + producer overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          {wine.producer && (
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}>
              {wine.producer}
            </p>
          )}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 6vw, 2rem)',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.05,
            letterSpacing: 'var(--tracking-tight)',
            margin: 0,
          }}>
            {wine.name}
            {wine.vintage && (
              <span style={{ fontStyle: 'italic', fontWeight: 500, opacity: 0.8, fontSize: '0.8em' }}>
                {' '}{wine.vintage}
              </span>
            )}
          </h1>
        </div>
      </PhotoGallery>

      {/* Content */}
      <div className="px-4 py-5 space-y-6">
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{ background: typeConf.bg, color: typeConf.fg }}
          >
            {typeConf.label}
          </span>
          {wine.country && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--parchment)', color: 'var(--ink-700)' }}>
              {wine.country}
            </span>
          )}
          {wine.region && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--parchment)', color: 'var(--ink-700)' }}>
              {wine.region}
            </span>
          )}
          {wine.grape_variety && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--parchment)', color: 'var(--ink-700)' }}>
              {wine.grape_variety}
            </span>
          )}
        </div>

        {/* Keller section */}
        <div>
          <p className="eyebrow mb-3">Im Keller</p>
          {inStockEntries.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Keine Flaschen mehr vorhanden.
            </p>
          ) : (
            <div className="space-y-3">
              {inStockEntries.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={{
                    id: entry.id,
                    wine_id: entry.wine_id,
                    quantity: entry.quantity,
                    purchase_price: entry.purchase_price,
                    purchase_date: entry.purchase_date,
                    purchase_location: entry.purchase_location,
                    shelf_location: entry.shelf_location,
                    storage_location_id: entry.storage_location_id,
                    storage_locations: entry.storage_locations as { name: string; type: string } | null,
                  }}
                  storageLocations={storageLocations}
                />
              ))}
              {inStockEntries.length > 1 && (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Gesamt:{' '}
                  <span className="nums font-bold" style={{ color: 'var(--foreground)' }}>
                    {totalBottles}
                  </span>{' '}
                  Flaschen
                </p>
              )}
            </div>
          )}
        </div>

        {/* Primary action */}
        {inStockEntries.length > 0 && (
          <OpenBottleButton entryId={inStockEntries[0].id} />
        )}

        {/* Notes */}
        {wine.notes && (
          <div>
            <p className="eyebrow mb-2">Notizen</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-700)' }}>
              {wine.notes}
            </p>
          </div>
        )}

        {/* Tastings */}
        {tastings && tastings.length > 0 && (
          <div>
            <p className="eyebrow mb-3">Verkostungen ({tastings.length})</p>
            <div className="space-y-2">
              {tastings.map(t => (
                <div
                  key={t.id}
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(t.date).toLocaleDateString('de-DE', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                    <span
                      className="nums font-bold"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-xl)',
                        color: 'var(--primary)',
                      }}
                    >
                      {t.rating}
                      <span style={{ fontSize: '0.65em', fontWeight: 400, color: 'var(--muted-foreground)' }}>
                        /10
                      </span>
                    </span>
                  </div>
                  {t.notes && (
                    <p className="mt-1.5 text-sm leading-snug" style={{ color: 'var(--ink-700)' }}>
                      {t.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom breathing room for BottomNav */}
        <div className="h-2" />
      </div>
    </div>
  )
}
