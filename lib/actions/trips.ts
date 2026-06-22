'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createTrip(formData: FormData) {
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
  if (!cellar) redirect('/onboarding')

  await supabase.from('trips').insert({
    cellar_id: cellar.id,
    name: formData.get('name') as string,
    location: (formData.get('location') as string) || null,
    date_start: (formData.get('date_start') as string) || null,
    date_end: (formData.get('date_end') as string) || null,
  })

  redirect('/trips')
}
