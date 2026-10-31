import type { User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError } from '@/lib/api/auth'
import type { FamilyRole } from '@/lib/types'
import { isThemePreference, type ThemePreference } from '@/lib/theme/types'

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

type FamilyMemberPatchFields = {
  display_name?: string | null
  theme_preference?: ThemePreference
  current_cellar_id?: string | null
}

/**
 * Validates a PATCH /api/v1/family_members/[id] body. The only fields a
 * member can ever patch on their own row are display_name,
 * theme_preference and current_cellar_id (which cellar they're currently
 * viewing, app/app/cellar-switcher.tsx) -- role/family_id changes aren't
 * exposed through this route at all. Any subset of these may be present
 * together; a body with none of them (or an invalid value for one that
 * is present) is rejected. Shape only -- the route still has to confirm
 * current_cellar_id actually names a cellar in the caller's own family
 * (lib/api/cellar.ts's requireCellarInFamily), which needs a DB lookup
 * this pure parser can't do.
 */
export function parseFamilyMemberPatch(body: unknown): FamilyMemberPatchFields | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const fields: FamilyMemberPatchFields = {}

  if ('display_name' in b) {
    const value = b.display_name
    if (value !== null && typeof value !== 'string') return null
    fields.display_name = typeof value === 'string' ? value.trim().slice(0, 40) || null : null
  }

  if ('theme_preference' in b) {
    const value = b.theme_preference
    if (!isThemePreference(value)) return null
    fields.theme_preference = value
  }

  if ('current_cellar_id' in b) {
    const value = b.current_cellar_id
    if (value !== null && typeof value !== 'string') return null
    fields.current_cellar_id = value
  }

  if (Object.keys(fields).length === 0) return null
  return fields
}
