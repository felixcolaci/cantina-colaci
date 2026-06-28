'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function setDisplayName(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawName = formData.get('display_name') as string
  const display_name = rawName?.trim().slice(0, 40) || null

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  await admin
    .from('family_members')
    .update({ display_name })
    .eq('user_id', user.id)
    .eq('family_id', membership.family_id)

  redirect('/family')
}

export async function createFamilyAndCellar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const familyName = formData.get('familyName') as string
  const cellarName = formData.get('cellarName') as string

  const { data: family, error: familyError } = await admin
    .from('families')
    .insert({ name: familyName, created_by: user.id })
    .select()
    .single()

  if (familyError) throw new Error(familyError.message)

  await admin
    .from('family_members')
    .insert({ family_id: family.id, user_id: user.id, role: 'owner' })

  await admin
    .from('cellars')
    .insert({ family_id: family.id, name: cellarName })

  redirect('/')
}
