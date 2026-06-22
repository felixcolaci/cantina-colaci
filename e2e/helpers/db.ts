import { createClient } from '@supabase/supabase-js'
import { TEST_EMAIL } from './constants'
import WebSocket from 'ws'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket as unknown as typeof global.WebSocket },
    }
  )
}

/** Deletes all families (+ cascading data) owned by the test user. */
export async function cleanTestUserData() {
  const admin = adminClient()

  const { data: users } = await admin.auth.admin.listUsers()
  const testUser = users?.users.find(u => u.email === TEST_EMAIL)
  if (!testUser) return

  // Cascade: family_members → families → cellars → wines → cellar_entries → tastings / trips
  const { data: memberships } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', testUser.id)
    .eq('role', 'owner')

  const familyIds = (memberships ?? []).map(m => m.family_id)
  if (familyIds.length === 0) return

  await admin.from('families').delete().in('id', familyIds)
}
