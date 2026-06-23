import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
        .select('*')
        .eq('cellar_id', cellar.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Reisen</h2>
      <NewTripForm />

      {trips && trips.length > 0 ? (
        <div className="space-y-3">
          {trips.map(trip => (
            <Card key={trip.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{trip.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2 flex-wrap">
                {trip.location && <Badge variant="outline">{trip.location}</Badge>}
                {trip.date_start && (
                  <span className="text-sm text-muted-foreground">
                    {trip.date_start}{trip.date_end ? ` → ${trip.date_end}` : ''}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center py-8 text-muted-foreground">Noch keine Reisen — Andiamo!</p>
      )}
    </div>
  )
}
