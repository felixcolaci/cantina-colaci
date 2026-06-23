import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function resolveFamilyId(bearerToken: string): Promise<string | null> {
  const supabase = createAdminClient()
  const keyHash = hashKey(bearerToken)

  const { data } = await supabase
    .from('api_keys')
    .select('family_id')
    .eq('key_hash', keyHash)
    .maybeSingle()

  return data?.family_id ?? null
}
