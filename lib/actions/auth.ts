'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function registerWithCode(
  email: string,
  password: string,
  code: string,
): Promise<{ error: string | null }> {
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('invitation_codes')
    .select('code')
    .eq('code', code)
    .is('used_at', null)
    .maybeSingle()

  if (!invite) {
    return { error: 'Ungültiger Einladungscode' }
  }

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message.includes('already registered')) {
      return { error: 'Diese E-Mail-Adresse ist bereits registriert' }
    }
    return { error: 'Registrierung fehlgeschlagen' }
  }

  await admin
    .from('invitation_codes')
    .update({ used_at: new Date().toISOString(), used_by: userData.user.id })
    .eq('code', code)

  return { error: null }
}
