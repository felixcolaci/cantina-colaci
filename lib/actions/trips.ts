'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function parseDate(input: FormDataEntryValue | null): string | null {
  if (!input || typeof input !== 'string' || !input.trim()) return null
  const s = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export async function createTrip(formData: FormData) {
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
  if (!cellar) redirect('/login')

  const { error } = await admin.from('trips').insert({
    cellar_id: cellar.id,
    name: formData.get('name') as string,
    location: (formData.get('location') as string) || null,
    date_start: parseDate(formData.get('date_start')),
    date_end: parseDate(formData.get('date_end')),
  })

  if (error) throw new Error(error.message)

  revalidatePath('/trips')
  redirect('/trips')
}
