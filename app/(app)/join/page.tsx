import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string }>
}) {
  const { family: familyId } = await searchParams
  if (!familyId) redirect('/')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/join?family=${familyId}`)
  }

  const { data: existing } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    const { data: family } = await supabase
      .from('families')
      .select('id')
      .eq('id', familyId)
      .maybeSingle()

    if (family) {
      await supabase.from('family_members').insert({
        family_id: familyId,
        user_id: user.id,
        role: 'member',
      })
    }
  }

  redirect('/')
}
