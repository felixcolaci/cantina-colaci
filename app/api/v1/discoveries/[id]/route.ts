import { requireApiUser, requireOwnCellar, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { parseDiscoveryInsert, parseDiscoveryPatch } from '@/lib/api/discovery'
import { BUCKET, isPhotoPathOwnedByFamily } from '@/lib/storage/wine-photos'

// Insert-only PUT, selbes Muster wie app/api/v1/trips/[id]/route.ts: Ziel
// des PowerSync-Upload-Connectors für den ersten Upload einer lokalen
// `discoveries`-Zeile. Spätere Edits laufen über PATCH (siehe unten).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const fields = parseDiscoveryInsert(body)
    if (!fields) return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })

    const admin = createAdminClient()
    await requireOwnCellar(admin, user, fields.cellar_id)

    // Ein trip_id-Fremdschlüssel wird nicht allein durch requireOwnCellar
    // auf cellar_id abgedeckt -- ohne diesen Check könnte ein Client die
    // Trip-ID einer völlig anderen Cellar erraten/kennen und verknüpfen.
    if (fields.trip_id) {
      const { data: trip } = await admin
        .from('trips').select('cellar_id').eq('id', fields.trip_id).maybeSingle()
      if (!trip || trip.cellar_id !== fields.cellar_id) {
        return Response.json({ error: 'Trip gehört nicht zu diesem Keller' }, { status: 400 })
      }
    }

    // insert(), nicht upsert() -- siehe die gleiche Begründung in
    // app/api/v1/wines/[id]/route.ts. 23505 heißt, diese id ist schon da.
    const { error } = await admin.from('discoveries').insert({ id, ...fields })
    if (error && error.code !== '23505') return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Edit path for an existing discovery: Ziel des PowerSync-Upload-Connectors
// für die UPDATE einer lokalen `discoveries`-Zeile (UpdateType.PATCH, siehe
// lib/powersync/connector.ts). Jedes Feld optional -- nur die Spalten, die
// das lokale UPDATE tatsächlich angefasst hat, sind gesetzt.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const body = await request.json().catch(() => null)

    const fields = parseDiscoveryPatch(body)
    if (!fields || Object.keys(fields).length === 0) {
      return Response.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: existing } = await admin.from('discoveries').select('cellar_id').eq('id', id).maybeSingle()
    if (!existing) return Response.json({ error: 'Entdeckung nicht gefunden' }, { status: 404 })
    await requireOwnCellar(admin, user, existing.cellar_id)

    if (fields.trip_id) {
      const { data: trip } = await admin
        .from('trips').select('cellar_id').eq('id', fields.trip_id).maybeSingle()
      if (!trip || trip.cellar_id !== existing.cellar_id) {
        return Response.json({ error: 'Trip gehört nicht zu diesem Keller' }, { status: 400 })
      }
    }

    const { error } = await admin.from('discoveries').update(fields).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Löschen drained der Connector als UpdateType.DELETE an dieselbe Route.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin.from('discoveries').select('cellar_id').eq('id', id).maybeSingle()
    if (!existing) return new Response(null, { status: 204 }) // bereits weg -- ok
    await requireOwnCellar(admin, user, existing.cellar_id)

    // Foto-Storage-Objekt explizit entfernen -- discovery_photos selbst
    // cascaded über die FK beim discoveries-Delete unten, aber das Storage-
    // Objekt muss Postgres dafür separat anstoßen. discovery_photos hat
    // keinen update-Grant, aber ein Familienmitglied könnte trotzdem per
    // direktem PostgREST-Insert eine Zeile mit beliebigem path unterschieben
    // (die insert-Policy prüft nur die Cellar-Zugehörigkeit, nicht die Pfad-
    // Form) -- also vor dem remove() wie bei wine_photos validieren.
    const { data: cellar } = await admin.from('cellars').select('family_id').eq('id', existing.cellar_id).maybeSingle()
    const { data: photo } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    if (photo && cellar && isPhotoPathOwnedByFamily(photo.path, cellar.family_id)) {
      await admin.storage.from(BUCKET).remove([photo.path])
    }

    const { error } = await admin.from('discoveries').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
