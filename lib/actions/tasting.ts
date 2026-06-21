'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function openBottle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cellarEntryId = formData.get('cellar_entry_id') as string

  // Verify the entry belongs to the current user's family
  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  // Fetch entry and verify family ownership through join
  const { data: entry } = await supabase
    .from('cellar_entries')
    .select('id, quantity, wine_id, wines(cellar_id, cellars(family_id))')
    .eq('id', cellarEntryId)
    .maybeSingle()

  if (!entry) throw new Error('Entry not found')

  const entryFamilyId = (entry.wines as any)?.cellars?.family_id
  if (entryFamilyId !== membership.family_id) throw new Error('Unauthorized')

  const { error: tastingError } = await supabase.from('tastings').insert({
    cellar_entry_id: cellarEntryId,
    user_id: user.id,
    date: formData.get('date') as string,
    rating: parseInt(formData.get('rating') as string),
    notes: (formData.get('notes') as string) || null,
  })

  if (tastingError) throw new Error(tastingError.message)

  const newQuantity = entry.quantity - 1
  await supabase
    .from('cellar_entries')
    .update({ quantity: newQuantity, status: newQuantity <= 0 ? 'consumed' : 'in_stock' })
    .eq('id', cellarEntryId)

  redirect(`/wine/${entry.wine_id}`)
}
