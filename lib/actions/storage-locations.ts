'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { StorageLocationType } from '@/lib/types'

async function getCellarId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return cellar?.id ?? null
}

export async function createLocation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cellarId = await getCellarId(supabase, user.id)
  if (!cellarId) redirect('/onboarding')

  await supabase.from('storage_locations').insert({
    cellar_id: cellarId,
    name: formData.get('name') as string,
    type: formData.get('type') as StorageLocationType,
  })

  redirect('/settings/locations')
}

export async function deleteLocation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string

  // RLS ensures only family members can delete
  await supabase.from('storage_locations').delete().eq('id', id)

  redirect('/settings/locations')
}
