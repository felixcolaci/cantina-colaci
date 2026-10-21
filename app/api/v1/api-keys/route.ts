import { randomUUID } from 'crypto'
import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { requireFamilyMembership, requireOwnerRole } from '@/lib/api/family'
import { parseApiKeyInsert } from '@/lib/api/api-key'
import { hashKey } from '@/lib/mcp/auth'
import { createAdminClient } from '@/lib/supabase/server'

// api_keys is plain REST, not PowerSync -- same reasoning as wine_photos
// and the family member-email lookup: the raw key only ever exists once
// (at generation, in this route's own response) and key_hash must never
// reach the client at all, so there is nothing here that belongs on-device
// as a synced row.
//
// GET is NOT owner-gated (legacy's page shows the key list -- names and
// dates, never hashes -- to every family member; only generating/revoking
// is owner-only). POST/DELETE enforce that below.
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireFamilyMembership(admin, user)

    const { data, error } = await admin
      .from('api_keys')
      .select('id, name, created_at')
      .eq('family_id', membership.familyId)
      .order('created_at', { ascending: false })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const keys = (data ?? []).map(k => ({ id: k.id, name: k.name, createdAt: k.created_at }))
    return Response.json({ keys })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const membership = await requireFamilyMembership(admin, user)
    requireOwnerRole(membership)

    const body = await request.json().catch(() => null)
    const fields = parseApiKeyInsert(body)
    if (!fields) return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })

    const key = randomUUID()
    const { data, error } = await admin
      .from('api_keys')
      .insert({ family_id: membership.familyId, name: fields.name, key_hash: hashKey(key) })
      .select('id, name, created_at')
      .single()
    if (error || !data) return Response.json({ error: error?.message ?? 'Anlegen fehlgeschlagen' }, { status: 500 })

    // The raw key is returned exactly once, here -- it is never stored or
    // retrievable again (only its hash is), same as legacy.
    return Response.json({ id: data.id, name: data.name, createdAt: data.created_at, key })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
