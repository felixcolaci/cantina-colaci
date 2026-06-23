'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { hashKey } from '@/lib/mcp/auth'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'

export async function generateApiKey(formData: FormData): Promise<{ key: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    throw new Error('Nur der Familienbesitzer kann API-Schlüssel generieren.')
  }

  const key = randomUUID()
  const serviceClient = createAdminClient()

  await serviceClient.from('api_keys').insert({
    family_id: membership.family_id,
    name: formData.get('name') as string,
    key_hash: hashKey(key),
  })

  return { key }
}

export async function revokeApiKey(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string
  const serviceClient = createAdminClient()
  await serviceClient.from('api_keys').delete().eq('id', id)

  redirect('/settings/api-keys')
}
