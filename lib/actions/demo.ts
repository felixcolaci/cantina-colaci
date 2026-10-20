'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function clearDemoCellar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const cellarName = (formData.get('cellarName') as string) || 'Meine Cantina'

  const { data: membership, error: membershipError } = await admin
    .from('family_members')
    .select('family_id, role, families(is_demo)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership) redirect('/')
  if (membership.role !== 'owner') throw new Error('Nur der Owner kann die Demo-Cantina zurücksetzen')
  if (!(membership.families as any)?.is_demo) throw new Error('Diese Cantina ist keine Demo-Cantina')

  const { data: cellar, error: cellarError } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (cellarError) throw cellarError
  if (!cellar) redirect('/')

  const { data: wines, error: winesError } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  if (winesError) throw winesError

  const wineIds = (wines ?? []).map(w => w.id)

  if (wineIds.length > 0) {
    const { data: entries, error: entriesError } = await admin
      .from('skus')
      .select('id')
      .in('wine_id', wineIds)

    if (entriesError) throw entriesError

    const entryIds = (entries ?? []).map(e => e.id)

    if (entryIds.length > 0) {
      const { error: tastingsDeleteError } = await admin
        .from('tastings').delete().in('cellar_entry_id', entryIds)
      if (tastingsDeleteError) throw tastingsDeleteError

      const { error: skusDeleteError } = await admin
        .from('skus').delete().in('id', entryIds)
      if (skusDeleteError) throw skusDeleteError
    }

    const { error: winesDeleteError } = await admin.from('wines').delete().in('id', wineIds)
    if (winesDeleteError) throw winesDeleteError
  }

  const { error: tripsDeleteError } = await admin.from('trips').delete().eq('cellar_id', cellar.id)
  if (tripsDeleteError) throw tripsDeleteError

  const { error: locationsDeleteError } = await admin
    .from('storage_locations').delete().eq('cellar_id', cellar.id)
  if (locationsDeleteError) throw locationsDeleteError

  const { error: cellarUpdateError } = await admin
    .from('cellars').update({ name: cellarName }).eq('id', cellar.id)
  if (cellarUpdateError) throw cellarUpdateError

  const { error: familyUpdateError } = await admin
    .from('families').update({ is_demo: false }).eq('id', membership.family_id)
  if (familyUpdateError) throw familyUpdateError

  redirect('/cellar')
}
