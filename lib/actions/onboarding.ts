'use server'

import { getAuthenticatedUser, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createFamilyAndCellar(formData: FormData) {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) redirect('/login')

  const familyName = (formData.get('familyName') as string | null)?.trim().slice(0, 60)
  const cellarName = (formData.get('cellarName') as string | null)?.trim().slice(0, 60)
  if (!familyName || !cellarName) throw new Error('Bitte Familien- und Kellernamen angeben')

  const admin = createAdminClient()
  const { error } = await admin.rpc('create_family_and_cellar', {
    p_user_id: user.id,
    p_family_name: familyName,
    p_cellar_name: cellarName,
  })
  if (error) throw new Error('Anlegen fehlgeschlagen')

  redirect('/')
}
