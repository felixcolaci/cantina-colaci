import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireFamilyMembership } from '@/lib/api/family'
import { createAdminClient } from '@/lib/supabase/server'

type MemberRow = { user_id: string; role: string; display_name: string | null }

function emailPrefix(email: string): string {
  const prefix = email.split('@')[0] ?? email
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    const s = name.slice(0, 2).toUpperCase()
    return s.length < 2 ? s + s : s
  }
  return words.map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()
}

// Plain REST, not PowerSync: resolving every member's email requires
// admin.auth.admin.getUserById, a privileged call that has no business
// running on-device even if it could -- same reasoning as wine_photos
// staying unsynced. Mirrors legacy/app/(app)/family/page.tsx's member list.
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireFamilyMembership(admin, user)

    const [{ data: family }, { data: memberRows }] = await Promise.all([
      admin.from('families').select('name, is_demo').eq('id', membership.familyId).maybeSingle(),
      admin.from('family_members').select('user_id, role, display_name').eq('family_id', membership.familyId),
    ])

    const rows = (memberRows ?? []) as MemberRow[]
    const emailResults = await Promise.all(rows.map(m => admin.auth.admin.getUserById(m.user_id)))
    const emailMap = new Map(rows.map((m, i) => [m.user_id, emailResults[i].data?.user?.email ?? '']))

    const members = rows.map(m => {
      const email = emailMap.get(m.user_id) ?? ''
      const resolvedName = m.display_name ?? emailPrefix(email)
      return {
        userId: m.user_id,
        role: m.role,
        displayName: m.display_name,
        email,
        resolvedName,
        initials: getInitials(resolvedName),
      }
    })

    return Response.json({
      familyName: family?.name ?? '',
      isDemo: Boolean(family?.is_demo),
      role: membership.role,
      members,
    })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
