import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

// Known, deliberately deferred decision: resolveFamilyId() below is all-or-nothing — a valid key
// grants access to every MCP tool for the entire family, with no per-key scope/permission. That's
// fine today because the only tool (get_cellar_wines, lib/mcp/server.ts) is read-only. Decide on a
// scoping model (e.g. per-key permissions in the api_keys schema) before adding the first
// write-capable MCP tool, rather than retrofitting it after multiple keys are already in use.

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
