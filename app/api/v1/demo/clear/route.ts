import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireDemoOwner } from '@/lib/api/reset'
import { createAdminClient } from '@/lib/supabase/server'

type CellarContextRow = { family_id: string; cellar_id: string | null }

// Clears the seeded demo cellar's data and flips the family off demo mode,
// so the owner can start populating their own cellar under the same
// family/cellar row. Owner-only, only for an actual demo family (the
// opposite gate from /api/v1/cellar/reset). Deliberately does NOT touch
// wine-photos storage the way the real reset routes do -- every demo
// wine's photo lives under the shared demo/ prefix (lib/storage/
// wine-photos.ts's isDemoPhotoPath), never under this family's own prefix,
// so there is nothing safe to delete here. Ported 1:1 from legacy's
// clearDemoCellar (lib/actions/demo.ts).
export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireDemoOwner(admin, user)

    const body = await request.json().catch(() => null)
    const cellarName = typeof body?.cellarName === 'string' && body.cellarName.trim() ? body.cellarName.trim() : 'Meine Cantina'

    const { data: ctx } = await admin
      .rpc('get_cellar_context', { p_user_id: user.id })
      .maybeSingle<CellarContextRow>()
    if (!ctx?.cellar_id) return Response.json({ error: 'Kein Keller gefunden' }, { status: 404 })

    const { data: wines, error: winesError } = await admin.from('wines').select('id').eq('cellar_id', ctx.cellar_id)
    if (winesError) return Response.json({ error: winesError.message }, { status: 500 })

    const wineIds = (wines ?? []).map(w => w.id)

    if (wineIds.length > 0) {
      const { data: entries, error: entriesError } = await admin.from('skus').select('id').in('wine_id', wineIds)
      if (entriesError) return Response.json({ error: entriesError.message }, { status: 500 })

      const entryIds = (entries ?? []).map(e => e.id)
      if (entryIds.length > 0) {
        const { error: tastingsDeleteError } = await admin.from('tastings').delete().in('cellar_entry_id', entryIds)
        if (tastingsDeleteError) return Response.json({ error: tastingsDeleteError.message }, { status: 500 })

        const { error: skusDeleteError } = await admin.from('skus').delete().in('id', entryIds)
        if (skusDeleteError) return Response.json({ error: skusDeleteError.message }, { status: 500 })
      }

      const { error: winesDeleteError } = await admin.from('wines').delete().in('id', wineIds)
      if (winesDeleteError) return Response.json({ error: winesDeleteError.message }, { status: 500 })
    }

    const { error: tripsDeleteError } = await admin.from('trips').delete().eq('cellar_id', ctx.cellar_id)
    if (tripsDeleteError) return Response.json({ error: tripsDeleteError.message }, { status: 500 })

    const { error: locationsDeleteError } = await admin.from('storage_locations').delete().eq('cellar_id', ctx.cellar_id)
    if (locationsDeleteError) return Response.json({ error: locationsDeleteError.message }, { status: 500 })

    const { error: cellarUpdateError } = await admin.from('cellars').update({ name: cellarName }).eq('id', ctx.cellar_id)
    if (cellarUpdateError) return Response.json({ error: cellarUpdateError.message }, { status: 500 })

    const { error: familyUpdateError } = await admin.from('families').update({ is_demo: false }).eq('id', membership.familyId)
    if (familyUpdateError) return Response.json({ error: familyUpdateError.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
