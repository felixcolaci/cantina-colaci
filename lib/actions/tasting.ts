'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function openBottle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cellarEntryId = formData.get('cellar_entry_id') as string

  await supabase.from('tastings').insert({
    cellar_entry_id: cellarEntryId,
    user_id: user.id,
    date: formData.get('date') as string,
    rating: parseInt(formData.get('rating') as string),
    notes: (formData.get('notes') as string) || null,
  })

  const { data: entry } = await supabase
    .from('cellar_entries')
    .select('quantity, wine_id')
    .eq('id', cellarEntryId)
    .single()

  if (!entry) throw new Error('Entry not found')

  const newQuantity = entry.quantity - 1
  await supabase
    .from('cellar_entries')
    .update({ quantity: newQuantity, status: newQuantity <= 0 ? 'consumed' : 'in_stock' })
    .eq('id', cellarEntryId)

  redirect(`/wine/${entry.wine_id}`)
}
