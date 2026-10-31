import { requireApiUser, requireOwnCellar, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireFamilyMembership, requireOwnerRole } from '@/lib/api/family'
import { requireCellarInFamily, parseCellarRename } from '@/lib/api/cellar'
import { wipeCellarData, confirmMatches } from '@/lib/api/reset'
import { createAdminClient } from '@/lib/supabase/server'

// The PowerSync upload connector's target for a local `cellars` row's
// UPDATE (EditCellarNameSheet's rename, app/app/edit-cellar-name-sheet.tsx)
// -- same local-first pattern as EditNameSheet's family_members PATCH.
// requireOwnCellar, not requireCellarInFamily: renaming is scoped to
// whichever cellar the caller is currently viewing, not any cellar their
// family happens to have (CellarSwitcher's list only ever shows other
// cellars' names read-only).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id: cellarId } = await params
    const body = await request.json().catch(() => null)

    const fields = parseCellarRename(body)
    if (!fields) return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })

    const admin = createAdminClient()
    await requireOwnCellar(admin, user, cellarId)

    const { error } = await admin.from('cellars').update(fields).eq('id', cellarId)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Owner-only, mirrors the reset routes' confirm-by-name gate (the caller
// must type the cellar's exact name back). Wipes the cellar's data first
// -- the same wipeCellarData /api/v1/cellar/reset and /api/v1/family/reset
// already use, so its wine-photos storage cleanup applies here too -- and
// then drops the now-empty cellar row itself, unlike those two routes,
// which leave the row behind on purpose. A family must always keep at
// least one cellar, so the last one can't be deleted.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id: cellarId } = await params
    const admin = createAdminClient()
    const membership = await requireFamilyMembership(admin, user)
    requireOwnerRole(membership)
    await requireCellarInFamily(admin, cellarId, membership.familyId)

    const { count, error: countError } = await admin
      .from('cellars')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', membership.familyId)
    if (countError) return Response.json({ error: countError.message }, { status: 500 })
    if ((count ?? 0) <= 1) {
      return Response.json({ error: 'Der letzte Keller einer Familie kann nicht gelöscht werden' }, { status: 400 })
    }

    const { data: cellar } = await admin.from('cellars').select('name').eq('id', cellarId).maybeSingle()
    if (!cellar) return Response.json({ error: 'Keller nicht gefunden' }, { status: 404 })

    const body = await request.json().catch(() => null)
    if (!confirmMatches(body, cellar.name)) {
      return Response.json({ error: 'Bestätigungstext stimmt nicht mit dem Namen des Kellers überein' }, { status: 400 })
    }

    await wipeCellarData(admin, cellarId, membership.familyId)

    const { error: deleteError } = await admin.from('cellars').delete().eq('id', cellarId)
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
