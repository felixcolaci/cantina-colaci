import type { User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError } from '@/lib/api/auth'
import type { FamilyRole } from '@/lib/types'

export type FamilyMembership = { familyId: string; role: FamilyRole }

/**
 * Resolves the caller's own family membership. Every /api/v1/family* route
 * needs this first -- there's no cellarId to check ownership through here
 * (family-level actions aren't cellar-scoped), so this is the equivalent
 * boundary requireOwnCellar provides for the synced tables.
 */
export async function requireFamilyMembership(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
): Promise<FamilyMembership> {
  const { data } = await admin
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!data) throw new ApiAuthError('Kein Familienmitglied', 403)
  return { familyId: data.family_id, role: data.role as FamilyRole }
}

export function requireOwnerRole(membership: FamilyMembership): void {
  if (membership.role !== 'owner') {
    throw new ApiAuthError('Nur der Owner kann Mitglieder einladen', 403)
  }
}

/**
 * Validates a PATCH /api/v1/family_members/[id] body. The only field a
 * member can ever patch on their own row is display_name -- role/family_id
 * changes aren't exposed through this route at all.
 */
export function parseFamilyMemberPatch(body: unknown): { display_name: string | null } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!('display_name' in b)) return null
  const value = b.display_name
  if (value !== null && typeof value !== 'string') return null
  return { display_name: typeof value === 'string' ? value.trim().slice(0, 40) || null : null }
}
