'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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
