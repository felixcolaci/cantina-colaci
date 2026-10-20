'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { StorageLocationType } from '@/lib/types'

async function getCellarId(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: cellar } = await admin
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

  const admin = createAdminClient()
  const cellarId = await getCellarId(admin, user.id)
  if (!cellarId) redirect('/onboarding')

  const { error } = await admin.from('storage_locations').insert({
    cellar_id: cellarId,
    name: formData.get('name') as string,
    type: formData.get('type') as StorageLocationType,
  })
  if (error) throw error

  redirect('/settings/locations')
}

export async function deleteLocation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const cellarId = await getCellarId(admin, user.id)
  if (!cellarId) redirect('/onboarding')

  const id = formData.get('id') as string

  // Defense-in-depth: scope the delete to the caller's own cellar, not just
  // any id they happen to pass — RLS is the backstop, not the only check.
  const { error } = await admin
    .from('storage_locations')
    .delete()
    .eq('id', id)
    .eq('cellar_id', cellarId)
  if (error) throw error

  redirect('/settings/locations')
}
