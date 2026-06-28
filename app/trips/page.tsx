import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TripCard } from '@/components/trips/trip-card'
import { NewTripForm } from './new-trip-form'

export default async function TripsPage() {
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

  const { data: trips } = cellar
    ? await admin
        .from('trips')
        .select('id, name, location, date_start, date_end, wines(id)')
        .eq('cellar_id', cellar.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          lineHeight: 'var(--leading-snug)',
          color: 'var(--foreground)',
          margin: 0,
        }}>
          Reisen
        </h1>
        <NewTripForm />
      </div>

      {trips && trips.length > 0 ? (
        <div className="space-y-2">
          {trips.map(trip => (
            <TripCard
              key={trip.id}
              trip={{
                id: trip.id,
                name: trip.name,
                location: trip.location,
                date_start: trip.date_start,
                date_end: trip.date_end,
              }}
              wineCount={(trip.wines as any[])?.length ?? 0}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
          <LocationPinGlyph />
          <p className="mt-3">Noch keine Reisen — Andiamo!</p>
        </div>
      )}
    </div>
  )
}

function LocationPinGlyph() {
  return (
    <svg
      width="32" height="40" viewBox="0 0 24 32" fill="none"
      stroke="var(--clay)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ opacity: 0.5, margin: '0 auto', display: 'block' }}
    >
      <path d="M12 2a7 7 0 0 1 7 7c0 4.5-7 13-7 13S5 13.5 5 9a7 7 0 0 1 7-7Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
