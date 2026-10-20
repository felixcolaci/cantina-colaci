import { cache } from 'react'
import { createAdminClient, getAuthenticatedUser } from '@/lib/supabase/server'

export type CellarContext = {
  userId: string
  email: string | null
  familyId: string
  cellarId: string | null
}

// No generated Database types exist yet for this RPC (Task 4 added it directly
// via migration), so the shape must be declared explicitly for maybeSingle<T>().
type CellarContextRow = {
  family_id: string
  cellar_id: string | null
}

export const getCellarContext = cache(async (): Promise<CellarContext | null> => {
  const { data: { user } } = await getAuthenticatedUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .rpc('get_cellar_context', { p_user_id: user.id })
    .maybeSingle<CellarContextRow>()

  if (!data) return null

  return {
    userId: user.id,
    email: user.email ?? null,
    familyId: data.family_id,
    cellarId: data.cellar_id,
  }
})
