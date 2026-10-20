'use server'

import { createAdminClient } from '@/lib/supabase/server'

/** Validates that a storage_location_id belongs to the given cellar. Returns null if rawId is falsy. Throws on foreign/invalid ID. */
export async function resolveStorageLocation(
  admin: ReturnType<typeof createAdminClient>,
  rawId: string | null,
  cellarId: string,
): Promise<string | null> {
  if (!rawId) return null
  const { data: loc } = await admin
    .from('storage_locations').select('id')
    .eq('id', rawId).eq('cellar_id', cellarId).maybeSingle()
  if (!loc) throw new Error('Ungültiger Lagerort')
  return loc.id
}
