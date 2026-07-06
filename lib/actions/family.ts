'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
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
  if (!membership) redirect('/onboarding')

  await admin
    .from('family_members')
    .update({ display_name })
    .eq('user_id', user.id)
    .eq('family_id', membership.family_id)

  redirect('/family')
}

export async function inviteFamilyMember(email: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht eingeloggt')

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) throw new Error('Kein Familienmitglied')
  if ((membership as any).role !== 'owner') throw new Error('Nur der Owner kann Mitglieder einladen')

  const h = await headers()
  const host = h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/join?family=${membership.family_id}`)}`,
  })

  if (error) {
    if (error.status === 422 || error.message.toLowerCase().includes('already been registered') || error.message.toLowerCase().includes('already exists')) {
      throw new Error(`${email} hat bereits einen Account — einfach einloggen und dann dem Einladungslink folgen.`)
    }
    throw new Error('Einladung konnte nicht gesendet werden.')
  }
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
