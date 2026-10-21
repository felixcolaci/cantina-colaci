# Entdeckungen (Wine Discoveries) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec Reference:** [`docs/superpowers/specs/2026-10-21-wine-discoveries-design.md`](../specs/2026-10-21-wine-discoveries-design.md) — Approved

**Goal:** Eine eigenständige, familiengeteilte Merkliste für Weine außerhalb des Kellerbestands (Restaurant, Winzerbesuch, Freunde) — Name/Produzent/Jahrgang, Fundort (Freitext oder Trip-Link), Datum, optionale Bewertung, Notiz, Preis, Foto. Getrennt vom Keller-Bestand, kein Übernahme-Button, kein Edit in v1 (nur Anlegen + Löschen).

**Architecture:** Sieben Tasks. DB-Migration zuerst (keine Code-Dateien), dann Typen/Validierung, dann zwei parallele Zweige — (a) PowerSync-Schema + Insert/Delete-Route und (b) die nicht-synchronisierte Foto-Subresource (analog `wine_photos`) —, dann der Query-Hook, dann die UI, und parallel dazu die Reset-Integration. Jeder Task lässt Build + Tests grün zurück.

**Tech Stack:** Next.js (App Router, Route Handlers), React, TypeScript, Supabase/Postgres (admin client, RLS), PowerSync (local-first SQLite + Upload-Connector), TanStack Router/Query, CSS Custom Properties, Vitest.

## Spec Coverage

```
AC1 (Pflichtname → sofortige lokale Zeile + Upload)         → Task 3, 6 ✓
AC2 (anderes Mitglied sieht Eintrag inkl. created_by)        → Task 3, 5, 6 ✓
AC3 (trip_id → Trip-Name sichtbar)                           → Task 5, 6 ✓
AC4 (kein trip_id, location_text → Freitext sichtbar)        → Task 5, 6 ✓
AC5 (rating optional, wird trotzdem gespeichert)              → Task 2, 3, 6 ✓
AC6 (Löschen inkl. Foto entfernt DB-Zeile + Storage-Objekt)   → Task 3, 4, 6 ✓
AC7 (fremde Familie kann nicht lesen/löschen)                 → Task 1, 3 ✓
Edge Case: Name fehlt / rating außerhalb 1–5 → 400            → Task 2, 3 ✓
Edge Case: trip_id gehört zu anderer Cellar → 400             → Task 3 ✓
Edge Case: Foto-Upload schlägt fehl → Eintrag bleibt ohne Foto → Task 4, 6 ✓
Edge Case: offline angelegt → erst bei anderen nach Sync sichtbar → Task 3 (Connector-Verhalten, kein neuer Code) ✓
```

Spec coverage verified: all 7 acceptance criteria and all four edge cases are covered.

## Global Constraints

- Alle visuellen Tokens über `var(--...)` — keine hartkodierten Hex-Werte oder Tailwind-Farbklassen.
- Display-Font: `var(--font-display)`.
- Schreibpfad für `discoveries` geht **ausschließlich** über lokale PowerSync-Inserts/-Deletes (`db.execute`), nie über einen direkten `apiMutate`-Call — der Upload-Connector drained automatisch zu `PUT`/`DELETE /api/v1/discoveries/[id]` (siehe `lib/powersync/connector.ts`).
- Fotos sind bewusst **nicht** PowerSync-synchronisiert (binärlastig) — exakt das gleiche Muster wie `wine_photos`: eigene Tabelle, eigene REST-Route, Lesen/Schreiben direkt über `apiGet`/`apiUpload`/`apiMutate`, react-query statt lokaler SQL-Query. Kein Offline-Foto-Upload (akzeptierte bestehende Einschränkung, siehe `app/app/wine-photo-gallery.tsx`).
- Migration wird über die Supabase-MCP-Tools `apply_migration` + danach `get_advisors` angewendet/verifiziert (Projektkonvention, siehe `supabase/migrations/20261020123319_wine_photos_rls_storage_and_advisories.sql`).
- Tests: `npx vitest run` · Build: `npm run build`
- **Externer, nicht in diesem Repo liegender Schritt — ERLEDIGT (2026-10-21):** Die selbst gehostete PowerSync-Instanz (EC2 `cantina-powersync`, `54.93.173.112`, Config unter `/opt/powersync/powersync/sync-config.yaml`) hat jetzt einen neuen Stream-Query für `discoveries` (gescoped wie `trips`, Backup liegt als `sync-config.yaml.bak-20261021T175635` neben der Datei). Zwei zusätzliche, nicht im ursprünglichen Migrations-SQL enthaltene Schritte waren dafür nötig und sind bereits angewendet:
  1. `alter publication powersync add table public.discoveries;` — die Replikations-Publication listet Tabellen explizit, ohne diesen Eintrag ignoriert PowerSync die Tabelle lautlos (`Skipping public.discoveries - not part of powersync publication`).
  2. `grant select on public.discoveries to powersync_replication;` — die Replikationsrolle ist weder `authenticated` noch `service_role`; ohne diesen Grant schlägt der initiale Snapshot mit `permission denied for table discoveries` fehl.
  `discovery_photos` bewusst in beiden Schritten ausgelassen (wie `wine_photos`, nicht synchronisiert). Verifiziert per Testzeile + Log-Check (`Flushed 1 + 0 + 1 updates`, keine Fehler). Container danach neu gestartet (`docker restart powersync-powersync-1`).
- **Angenommene Design-Entscheidung (Plan-Zeit):** Der Foto-Upload im Anlegen-Sheet (Task 6) läuft direkt nach dem lokalen Insert. Da die `discoveries`-Zeile erst beim nächsten Connector-Durchlauf serverseitig landet, kann dieser erste Upload-Versuch mit "Entdeckung nicht gefunden" fehlschlagen, wenn der Connector noch nicht durchgelaufen ist. Das degradiert genauso wie bei `WinePhotoGallery` zu "kein Foto gesetzt", ohne den Rest des Eintrags zu blockieren — exakt die bestehende, akzeptierte Einschränkung dieses Apps, keine neue.

---

### Task 1: DB-Migration — `discoveries` + `discovery_photos`

**Files:**
- Keine Code-Dateien — SQL via Supabase-MCP

**Interfaces:**
- Produces: Tabellen `discoveries`, `discovery_photos` (RLS aktiv, family-gescopte Policies, Grants, Indexe)

- [x] **Schritt 1: Migration anwenden**

Supabase-MCP-Tool `apply_migration`, Name `add_discoveries_and_photos`:

```sql
-- Entdeckungen: Weine außerhalb des Kellerbestands, cellar-gescoped wie trips.
create table public.discoveries (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references public.cellars(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  producer text,
  vintage int,
  type text check (type in ('red', 'white', 'rosé', 'sparkling')),
  location_text text,
  trip_id uuid references public.trips(id) on delete set null,
  date date not null default current_date,
  rating int check (rating >= 1 and rating <= 5),
  notes text,
  price numeric(10,2),
  created_at timestamptz not null default now()
);

-- Höchstens ein Foto pro Entdeckung (unique auf discovery_id) -- analog
-- wine_photos, aber singulär statt Galerie.
create table public.discovery_photos (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null unique references public.discoveries(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.discoveries to authenticated, service_role;
grant select, insert, delete on public.discovery_photos to authenticated, service_role;

alter table public.discoveries enable row level security;
alter table public.discovery_photos enable row level security;

-- Kein update-Grant/-Policy: kein Edit in v1 (siehe Spec "Offene Punkte").

create policy "family members can read discoveries" on public.discoveries
  for select using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert discoveries" on public.discoveries
  for insert with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete discoveries" on public.discoveries
  for delete using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can read discovery photos" on public.discovery_photos
  for select using (
    exists (
      select 1 from public.discoveries
      join public.cellars on public.cellars.id = public.discoveries.cellar_id
      where public.discoveries.id = discovery_photos.discovery_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert discovery photos" on public.discovery_photos
  for insert with check (
    exists (
      select 1 from public.discoveries
      join public.cellars on public.cellars.id = public.discoveries.cellar_id
      where public.discoveries.id = discovery_photos.discovery_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete discovery photos" on public.discovery_photos
  for delete using (
    exists (
      select 1 from public.discoveries
      join public.cellars on public.cellars.id = public.discoveries.cellar_id
      where public.discoveries.id = discovery_photos.discovery_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create index if not exists idx_discoveries_cellar_id on public.discoveries(cellar_id);
create index if not exists idx_discoveries_trip_id on public.discoveries(trip_id);
create index if not exists idx_discoveries_created_by on public.discoveries(created_by);
create index if not exists idx_discovery_photos_discovery_id on public.discovery_photos(discovery_id);

-- Ohne diese beiden Zeilen bleibt discoveries für die selbst gehostete
-- PowerSync-Instanz entweder unsichtbar (nicht in der Publication) oder
-- unlesbar (fehlender Grant für die Replikationsrolle) -- siehe Global
-- Constraints oben für die genaue Fehlermeldung je Fall. discovery_photos
-- bewusst ausgelassen, wie wine_photos auch (nicht synchronisiert).
alter publication powersync add table public.discoveries;
grant select on public.discoveries to powersync_replication;
```

Kein neuer Storage-Bucket/keine neue Storage-Policy nötig: `discovery_photos.path` liegt im bestehenden `wine-photos`-Bucket unter `families/<family_id>/discoveries/<discovery_id>/...`, und die bestehenden `storage.objects`-Policies aus `20261020123319_wine_photos_rls_storage_and_advisories.sql` prüfen nur die Segmente `families/<family_id>/...`, nicht den dritten Pfadteil — sie greifen also unverändert.

- [x] **Schritt 2: Verifizieren**

```sql
select table_name, row_security from information_schema.tables
where table_name in ('discoveries', 'discovery_photos');
```
Erwartet: beide Zeilen mit `row_security = YES` (bzw. `relrowsecurity` via `pg_tables`, je nach MCP-Ausgabe).

```sql
select policyname, cmd from pg_policies where tablename in ('discoveries', 'discovery_photos') order by tablename, cmd;
```
Erwartet: 3 Policies auf `discoveries` (select/insert/delete), 3 auf `discovery_photos`.

- [x] **Schritt 3: Supabase-Advisors prüfen**

Supabase-MCP-Tool `get_advisors` (security + performance) aufrufen. Erwartet: keine neuen Findings zu `discoveries`/`discovery_photos` (insbesondere kein `rls_disabled_in_public`, kein `unindexed_foreign_keys` für die vier neuen FKs).

- [x] **Schritt 4: Commit**

```bash
git commit --allow-empty -m "feat: DB migration — add discoveries + discovery_photos tables with RLS"
```

**Nachtrag (erledigt):** PowerSync-`sync-config.yaml` auf dem EC2-Server ergänzt + `discoveries` zur `powersync`-Publication hinzugefügt + `powersync_replication`-Grant gesetzt + Dienst neu gestartet und per Testzeile verifiziert (siehe Global Constraints oben). Eigentlich Teil von Task 3, aber auf Wunsch vorgezogen und direkt nach der Migration erledigt.

---

### Task 2: Typen + Validierung + Tests

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/api/discovery.ts`
- Create: `lib/api/__tests__/discovery.test.ts`

**Interfaces:**
- Consumes: `discoveries`-Tabelle (Task 1)
- Produces: `Discovery`-Typ, `parseDiscoveryInsert(body)`, `resolveDiscoveryFamily(admin, userId, discoveryId)` — von Task 3 und 4 konsumiert

**Tests required before implementation:**
- `it('accepts a full body')`
- `it('accepts just the required fields, defaulting the rest to null')`
- `it('trims name/producer/location_text/notes, treating blank as null')`
- `it('rejects a non-object body')`
- `it('rejects a missing or blank cellar_id/created_by/name/date')`
- `it('rejects a rating outside 1-5 or non-integer')`
- `it('rejects a wrong-typed optional field')`
- `it('rejects an unknown wine type')`

**Acceptance criteria covered:** AC5, Edge Case (Name fehlt / rating außerhalb 1–5)
**Dependencies:** Task 1

- [x] **Schritt 1: `lib/types.ts` ergänzen**

Am Ende der Datei (nach `WineHints`) hinzufügen:

```ts
export interface Discovery {
  id: string
  cellar_id: string
  created_by: string
  name: string
  producer: string | null
  vintage: number | null
  type: WineType | null
  location_text: string | null
  trip_id: string | null
  date: string
  rating: number | null
  notes: string | null
  price: number | null
  created_at: string
}
```

- [x] **Schritt 2: `lib/api/discovery.ts` anlegen**

```ts
import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError } from '@/lib/api/auth'
import type { WineType } from '@/lib/types'

export type DiscoveryInsert = {
  cellar_id: string
  created_by: string
  name: string
  producer: string | null
  vintage: number | null
  type: WineType | null
  location_text: string | null
  trip_id: string | null
  date: string
  rating: number | null
  notes: string | null
  price: number | null
}

const WINE_TYPES: WineType[] = ['red', 'white', 'rosé', 'sparkling']

/**
 * Validates a PUT /api/v1/discoveries/[id] body. created_by is the local
 * writer's own user id, same trust level as tastings.user_id (see
 * lib/api/tasting.ts) -- not re-checked against the authenticated caller
 * here, only used for display attribution; authorization is entirely via
 * requireOwnCellar on cellar_id.
 */
export function parseDiscoveryInsert(body: unknown): DiscoveryInsert | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const cellarId = typeof b.cellar_id === 'string' ? b.cellar_id : null
  const createdBy = typeof b.created_by === 'string' ? b.created_by : null
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const date = typeof b.date === 'string' ? b.date : null
  if (!cellarId || !createdBy || !name || !date) return null

  if ('producer' in b && b.producer != null && typeof b.producer !== 'string') return null
  if ('vintage' in b && b.vintage != null && !Number.isInteger(b.vintage)) return null
  if ('type' in b && b.type != null && !WINE_TYPES.includes(b.type as WineType)) return null
  if ('location_text' in b && b.location_text != null && typeof b.location_text !== 'string') return null
  if ('trip_id' in b && b.trip_id != null && typeof b.trip_id !== 'string') return null
  if ('notes' in b && b.notes != null && typeof b.notes !== 'string') return null
  if ('price' in b && b.price != null && typeof b.price !== 'number') return null

  const rating = b.rating
  if ('rating' in b && rating != null) {
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) return null
  }

  return {
    cellar_id: cellarId,
    created_by: createdBy,
    name,
    producer: typeof b.producer === 'string' ? b.producer.trim() || null : null,
    vintage: typeof b.vintage === 'number' ? b.vintage : null,
    type: b.type != null ? (b.type as WineType) : null,
    location_text: typeof b.location_text === 'string' ? b.location_text.trim() || null : null,
    trip_id: typeof b.trip_id === 'string' ? b.trip_id : null,
    date,
    rating: rating != null ? (rating as number) : null,
    notes: typeof b.notes === 'string' ? b.notes.trim() || null : null,
    price: typeof b.price === 'number' ? b.price : null,
  }
}

/**
 * Resolves the family that owns a discovery, for the photo sub-resource
 * routes (app/api/v1/discoveries/[id]/photo/route.ts) -- mirrors
 * resolveWineFamily in lib/api/wine.ts.
 */
export async function resolveDiscoveryFamily(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  discoveryId: string,
): Promise<{ familyId: string; cellarId: string }> {
  const { data: ctx } = await admin
    .rpc('get_cellar_context', { p_user_id: userId })
    .maybeSingle<{ family_id: string; cellar_id: string | null }>()
  if (!ctx?.cellar_id) throw new ApiAuthError('Kein Keller gefunden', 403)

  const { data: discovery } = await admin
    .from('discoveries').select('cellar_id').eq('id', discoveryId).maybeSingle()
  if (!discovery) throw new ApiAuthError('Entdeckung nicht gefunden', 404)
  if (discovery.cellar_id !== ctx.cellar_id) throw new ApiAuthError('Ungültige Entdeckung', 403)

  return { familyId: ctx.family_id, cellarId: ctx.cellar_id }
}
```

- [x] **Schritt 3: `lib/api/__tests__/discovery.test.ts` anlegen**

```ts
import { describe, it, expect } from 'vitest'
import { parseDiscoveryInsert } from '../discovery'

describe('parseDiscoveryInsert', () => {
  it('accepts a full body', () => {
    expect(
      parseDiscoveryInsert({
        cellar_id: 'cellar-1',
        created_by: 'user-1',
        name: 'Barolo Riserva',
        producer: 'Gaja',
        vintage: 2018,
        type: 'red',
        location_text: 'Osteria da Mario',
        trip_id: null,
        date: '2026-10-18',
        rating: 4,
        notes: 'Sehr elegant, viel Tannin',
        price: 14.5,
      }),
    ).toEqual({
      cellar_id: 'cellar-1',
      created_by: 'user-1',
      name: 'Barolo Riserva',
      producer: 'Gaja',
      vintage: 2018,
      type: 'red',
      location_text: 'Osteria da Mario',
      trip_id: null,
      date: '2026-10-18',
      rating: 4,
      notes: 'Sehr elegant, viel Tannin',
      price: 14.5,
    })
  })

  it('accepts just the required fields, defaulting the rest to null', () => {
    expect(
      parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18' }),
    ).toEqual({
      cellar_id: 'c',
      created_by: 'u',
      name: 'Wein',
      producer: null,
      vintage: null,
      type: null,
      location_text: null,
      trip_id: null,
      date: '2026-10-18',
      rating: null,
      notes: null,
      price: null,
    })
  })

  it('trims name/producer/location_text/notes, treating blank as null', () => {
    const result = parseDiscoveryInsert({
      cellar_id: 'c', created_by: 'u', name: '  Wein  ', date: '2026-10-18',
      producer: '   ', location_text: '  ', notes: '   ',
    })
    expect(result?.name).toBe('Wein')
    expect(result?.producer).toBeNull()
    expect(result?.location_text).toBeNull()
    expect(result?.notes).toBeNull()
  })

  it('rejects a non-object body', () => {
    expect(parseDiscoveryInsert(null)).toBeNull()
    expect(parseDiscoveryInsert('nope')).toBeNull()
  })

  it('rejects a missing or blank cellar_id/created_by/name/date', () => {
    expect(parseDiscoveryInsert({ created_by: 'u', name: 'Wein', date: '2026-10-18' })).toBeNull()
    expect(parseDiscoveryInsert({ cellar_id: 'c', name: 'Wein', date: '2026-10-18' })).toBeNull()
    expect(parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: '  ', date: '2026-10-18' })).toBeNull()
    expect(parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: 'Wein' })).toBeNull()
  })

  it('rejects a rating outside 1-5 or non-integer', () => {
    const base = { cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18' }
    expect(parseDiscoveryInsert({ ...base, rating: 0 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, rating: 6 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, rating: 3.5 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, rating: 5 })?.rating).toBe(5)
    expect(parseDiscoveryInsert({ ...base })?.rating).toBeNull()
  })

  it('rejects a wrong-typed optional field', () => {
    const base = { cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18' }
    expect(parseDiscoveryInsert({ ...base, producer: 42 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, price: '12.50' })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, trip_id: 42 })).toBeNull()
  })

  it('rejects an unknown wine type', () => {
    expect(
      parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18', type: 'orange' }),
    ).toBeNull()
  })
})
```

- [x] **Schritt 4: Tests ausführen**

```bash
npx vitest run lib/api/__tests__/discovery.test.ts
```
Erwartet: alle Tests PASS.

- [x] **Schritt 5: Commit**

```bash
git add lib/types.ts lib/api/discovery.ts lib/api/__tests__/discovery.test.ts
git commit -m "feat: add Discovery type, parseDiscoveryInsert validation + tests"
```

---

### Task 3: PowerSync-Schema + Insert/Delete-API-Route

**Files:**
- Modify: `lib/powersync/schema.ts`
- Create: `app/api/v1/discoveries/[id]/route.ts`

**Interfaces:**
- Consumes: `discoveries`-Tabelle (Task 1), `parseDiscoveryInsert` (Task 2)
- Produces: lokal synchronisierte `discoveries`-Tabelle; `PUT`/`DELETE /api/v1/discoveries/[id]`

**Acceptance criteria covered:** AC1, AC2, AC5, AC6 (Zeilen-Löschung + Foto-Cleanup), AC7, Edge Case (trip_id fremde Cellar)
**Dependencies:** Task 1, Task 2

- [x] **Schritt 1: `lib/powersync/schema.ts` ergänzen**

Nach der `tastings`-Table-Definition einfügen:

```ts
const discoveries = new Table(
  {
    cellar_id: column.text,
    created_by: column.text,
    name: column.text,
    producer: column.text,
    vintage: column.integer,
    type: column.text,
    location_text: column.text,
    trip_id: column.text,
    date: column.text,
    rating: column.integer,
    notes: column.text,
    price: column.real,
    created_at: column.text,
  },
  { indexes: { cellar: ['cellar_id'] } }
)
```

Und in `AppSchema` ergänzen:
```ts
export const AppSchema = new Schema({
  families,
  family_members,
  cellars,
  wines,
  skus,
  storage_locations,
  trips,
  tastings,
  discoveries,
})
```

> **Externer Schritt (nicht in diesem Repo) — bereits erledigt**, siehe Global Constraints oben: `sync-config.yaml` auf dem PowerSync-Server hat den `discoveries`-Stream, Publication + Grant sind gesetzt, Dienst läuft neu gestartet und wurde per Testzeile verifiziert.

- [x] **Schritt 2: `app/api/v1/discoveries/[id]/route.ts` anlegen**

```ts
import { requireApiUser, requireOwnCellar, apiAuthErrorResponse } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { parseDiscoveryInsert } from '@/lib/api/discovery'
import { BUCKET } from '@/lib/storage/wine-photos'

// Insert-only PUT, selbes Muster wie app/api/v1/trips/[id]/route.ts: Ziel
// des PowerSync-Upload-Connectors für den ersten (und, da es kein PATCH
// gibt, einzigen) Upload einer lokalen `discoveries`-Zeile.
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

// Kein PATCH -- kein Edit in v1 (siehe Spec). Löschen drained der Connector
// aber als UpdateType.DELETE an dieselbe Route.
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
    // Objekt muss Postgres dafür separat anstoßen.
    const { data: photo } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    if (photo) {
      await admin.storage.from(BUCKET).remove([photo.path])
    }

    const { error } = await admin.from('discoveries').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [x] **Schritt 3: Build**

```bash
npm run build 2>&1 | tail -30
```
Erwartet: keine TypeScript-Fehler.

- [x] **Schritt 4: Commit**

```bash
git add lib/powersync/schema.ts app/api/v1/discoveries/\[id\]/route.ts
git commit -m "feat: sync discoveries via PowerSync, add insert/delete API route"
```

---

### Task 4: Foto-Subresource (nicht synchronisiert)

**Files:**
- Modify: `lib/storage/wine-photos.ts`
- Create: `app/api/v1/discoveries/[id]/photo/route.ts`

**Interfaces:**
- Consumes: `resolveDiscoveryFamily` (Task 2), `discovery_photos`-Tabelle (Task 1)
- Produces: `GET`/`POST`/`DELETE /api/v1/discoveries/[id]/photo` — von Task 6 (`AddDiscoverySheet`, `DiscoveryCard`) konsumiert

**Acceptance criteria covered:** AC6 (eigenständiger Löschpfad für das Foto), Edge Case (Foto-Upload-Fehler blockiert den Eintrag nicht)
**Dependencies:** Task 1, Task 2

- [x] **Schritt 1: `lib/storage/wine-photos.ts` ergänzen**

Nach `buildWinePhotoPath` einfügen:

```ts
/** Storage object path for a discovery's (at most one) photo upload. */
export function buildDiscoveryPhotoPath(familyId: string, discoveryId: string, photoId: string, ext: string): string {
  return `families/${familyId}/discoveries/${discoveryId}/${photoId}.${ext}`
}
```

- [x] **Schritt 2: `app/api/v1/discoveries/[id]/photo/route.ts` anlegen**

```ts
import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveDiscoveryFamily } from '@/lib/api/discovery'
import { createAdminClient } from '@/lib/supabase/server'
import {
  signPhotoPath, buildDiscoveryPhotoPath, ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, BUCKET,
} from '@/lib/storage/wine-photos'

// discovery_photos ist, wie wine_photos, bewusst nicht PowerSync-
// synchronisiert (binärlastig) -- die SPA spricht diese REST-Ressource
// direkt an (apiGet/apiUpload/apiMutate), nie über die lokale CRUD-Queue.
// Höchstens ein Foto pro Entdeckung (unique auf discovery_id), daher
// singulär (GET liefert eine url oder null) statt einer Galerie wie bei
// wines.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    const { familyId } = await resolveDiscoveryFamily(admin, user.id, id)

    const { data: photo } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    const url = photo ? await signPhotoPath(admin, photo.path, familyId) : null

    return Response.json({ url })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Ersetzt ein vorhandenes Foto (altes Storage-Objekt + Zeile zuerst
// löschen) -- es gibt nur einen Slot, anders als das anhängende POST der
// Wein-Galerie.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    const { familyId } = await resolveDiscoveryFamily(admin, user.id, id)

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('photo')
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: 'Kein Foto ausgewählt' }, { status: 400 })
    }
    const ext = ALLOWED_PHOTO_TYPES[file.type]
    if (!ext) return Response.json({ error: 'Format nicht unterstützt (JPEG, PNG, WebP, HEIC)' }, { status: 400 })
    if (file.size > MAX_PHOTO_BYTES) return Response.json({ error: 'Foto zu groß (max 5 MB)' }, { status: 400 })

    const { data: existing } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    if (existing) {
      await admin.storage.from(BUCKET).remove([existing.path])
      await admin.from('discovery_photos').delete().eq('discovery_id', id)
    }

    const photoId = crypto.randomUUID()
    const path = buildDiscoveryPhotoPath(familyId, id, photoId, ext)
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (uploadError) return Response.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })

    const { error: insertError } = await admin.from('discovery_photos').insert({ discovery_id: id, path })
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    const url = await signPhotoPath(admin, path, familyId)
    return Response.json({ url }, { status: 201 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(request)
    const { id } = await params
    const admin = createAdminClient()
    await resolveDiscoveryFamily(admin, user.id, id)

    const { data: existing } = await admin
      .from('discovery_photos').select('path').eq('discovery_id', id).maybeSingle()
    if (existing) {
      await admin.storage.from(BUCKET).remove([existing.path])
      await admin.from('discovery_photos').delete().eq('discovery_id', id)
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [x] **Schritt 3: Build**

```bash
npm run build 2>&1 | tail -30
```

- [x] **Schritt 4: Commit**

```bash
git add lib/storage/wine-photos.ts app/api/v1/discoveries/\[id\]/photo/route.ts
git commit -m "feat: add single-photo upload/delete route for discoveries"
```

---

### Task 5: Query-Hook `useDiscoveries`

**Files:**
- Modify: `lib/powersync/queries.ts`

**Interfaces:**
- Consumes: lokale `discoveries`/`trips`/`family_members`-Tabellen (Task 3)
- Produces: `useDiscoveries(cellarId)`, `DiscoverySummary`-Typ — von Task 6 konsumiert

**Acceptance criteria covered:** AC2 (created_by-Anzeige), AC3 (Trip-Name), AC4 (Freitext-Fundort)
**Dependencies:** Task 3

- [x] **Schritt 1: Hook ergänzen**

Am Ende von `lib/powersync/queries.ts` hinzufügen:

```ts
export type DiscoverySummary = {
  id: string
  name: string
  producer: string | null
  vintage: number | null
  type: WineType | null
  locationText: string | null
  tripId: string | null
  tripName: string | null
  date: string
  rating: number | null
  notes: string | null
  price: number | null
  createdByName: string | null
}

type DiscoveryRow = {
  id: string
  name: string
  producer: string | null
  vintage: number | null
  type: string | null
  location_text: string | null
  trip_id: string | null
  trip_name: string | null
  date: string
  rating: number | null
  notes: string | null
  price: number | null
  created_by_name: string | null
}

// LEFT JOIN auf family_members per user_id (nicht family_id) -- exakt das
// gleiche Matching wie useOwnFamilyMember oben, trägt hier aber jedes
// Mitglied, nicht nur den Aufrufer selbst.
const DISCOVERIES_SQL = `
  SELECT
    discoveries.id AS id,
    discoveries.name AS name,
    discoveries.producer AS producer,
    discoveries.vintage AS vintage,
    discoveries.type AS type,
    discoveries.location_text AS location_text,
    discoveries.trip_id AS trip_id,
    trips.name AS trip_name,
    discoveries.date AS date,
    discoveries.rating AS rating,
    discoveries.notes AS notes,
    discoveries.price AS price,
    family_members.display_name AS created_by_name
  FROM discoveries
  LEFT JOIN trips ON trips.id = discoveries.trip_id
  LEFT JOIN family_members ON family_members.user_id = discoveries.created_by
  WHERE discoveries.cellar_id = ?
  ORDER BY discoveries.date DESC, discoveries.created_at DESC
`

export function useDiscoveries(cellarId: string) {
  const { data, isLoading, error } = useQuery<DiscoveryRow>(DISCOVERIES_SQL, [cellarId])
  const discoveries: DiscoverySummary[] = data.map(row => ({
    id: row.id,
    name: row.name,
    producer: row.producer,
    vintage: row.vintage,
    type: row.type as WineType | null,
    locationText: row.location_text,
    tripId: row.trip_id,
    tripName: row.trip_name,
    date: row.date,
    rating: row.rating,
    notes: row.notes,
    price: row.price,
    createdByName: row.created_by_name,
  }))
  return { discoveries, isLoading, error }
}
```

- [x] **Schritt 2: Build**

```bash
npm run build 2>&1 | tail -30
```

- [x] **Schritt 3: Commit**

```bash
git add lib/powersync/queries.ts
git commit -m "feat: add useDiscoveries query hook"
```

---

### Task 6: UI — Card, Anlegen-Sheet, Screen, Route, Nav

**Files:**
- Create: `components/cellar/discovery-card.tsx`
- Create: `app/app/add-discovery-sheet.tsx`
- Create: `app/app/discoveries-screen.tsx`
- Modify: `lib/spa/router.tsx`
- Modify: `app/app/cellar-screen.tsx`

**Interfaces:**
- Consumes: `useDiscoveries` (Task 5), `RatingInput` (`components/ui/rating-input.tsx`), `useTrips` (bestehend), Foto-Route (Task 4)
- Produces: Route `/discoveries`, Icon-Link in der Keller-Startseite

**Acceptance criteria covered:** AC1, AC2, AC3, AC4, AC5, AC6 (Lösch-UI)
**Dependencies:** Task 2, Task 3, Task 5

- [x] **Schritt 1: `components/cellar/discovery-card.tsx` anlegen**

```tsx
'use client'

import { useState } from 'react'
import { Trash2, Camera } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePowerSync } from '@powersync/react'
import { apiGet } from '@/lib/spa/api-client'
import type { DiscoverySummary } from '@/lib/powersync/queries'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Foto-URL kommt separat über react-query (GET /discoveries/[id]/photo),
// nicht aus dem lokalen PowerSync-Query -- siehe Global Constraints im Plan.
export function DiscoveryCard({ discovery }: { discovery: DiscoverySummary }) {
  const db = usePowerSync()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: photo } = useQuery<{ url: string | null }>({
    queryKey: ['discovery-photo', discovery.id],
    queryFn: () => apiGet<{ url: string | null }>(`/discoveries/${discovery.id}/photo`),
  })

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await db.execute(`DELETE FROM discoveries WHERE id = ?`, [discovery.id])
      queryClient.removeQueries({ queryKey: ['discovery-photo', discovery.id] })
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  const fundort = discovery.tripName ?? discovery.locationText

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {discovery.producer && <p className="eyebrow truncate mb-0.5">{discovery.producer}</p>}
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600,
            lineHeight: 1.12, letterSpacing: '-0.01em', color: 'var(--foreground)',
          }}>
            {discovery.name}
            {discovery.vintage && (
              <span className="nums" style={{ color: 'var(--muted-foreground)', fontWeight: 500, fontStyle: 'italic' }}>
                {' '}{discovery.vintage}
              </span>
            )}
          </p>
          <p className="mono mt-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
            {[fundort, new Date(discovery.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })]
              .filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex-none flex items-start gap-2">
          {discovery.rating != null && (
            <div className="text-right">
              <span className="nums" style={{
                fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700,
                lineHeight: 1, color: 'var(--primary)',
              }}>
                {discovery.rating}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>/5</span>
            </div>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center justify-center w-7 h-7 rounded-full"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            aria-label="Entdeckung löschen"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {photo?.url && (
        // eslint-disable-next-line @next/next/no-img-element -- einmaliges, signiertes URL-Thumbnail, kein next/image-Caching nötig
        <img src={photo.url} alt="" className="mt-3 rounded-md object-cover" style={{ width: '100%', height: 140 }} />
      )}

      {discovery.notes && (
        <>
          <hr className="my-3" style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', color: 'var(--foreground)', fontStyle: 'italic' }}>
            {discovery.notes}
          </p>
        </>
      )}

      {(discovery.price != null || discovery.createdByName) && (
        <p className="mt-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
          {[
            discovery.price != null
              ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(discovery.price)
              : null,
            discovery.createdByName ? `Entdeckt von ${discovery.createdByName}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Entdeckung löschen?</DialogTitle>
            <DialogDescription>„{discovery.name}" wird unwiderruflich entfernt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
            <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { Camera }
```

> Hinweis: `Camera` wird hier nur re-exportiert, falls ein künftiger "Foto nachträglich hinzufügen"-Button gebraucht wird — für v1 nicht verdrahtet (kein Edit, Foto kommt ausschließlich aus dem Anlegen-Sheet). Wird dieser Re-Export nicht verwendet, beim Lint-Check entfernen.

- [x] **Schritt 2: `app/app/add-discovery-sheet.tsx` anlegen**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { RatingInput } from '@/components/ui/rating-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import { apiUpload } from '@/lib/spa/api-client'
import { compressImage } from '@/lib/image-compress'
import { useTrips } from '@/lib/powersync/queries'
import type { WineType } from '@/lib/types'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rot' },
  { value: 'white', label: 'Weiß' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
]

// Lokaler Insert zuerst (wie QuickAddSheet), danach -- falls ein Foto
// gewählt wurde -- ein direkter Upload-Versuch. Dieser kann fehlschlagen,
// solange die Zeile noch nicht beim Server gelandet ist (siehe "Angenommene
// Design-Entscheidung" im Plan); der Fehler wird dann verschluckt, der
// Eintrag bleibt ohne Foto -- gleiches Degradationsverhalten wie
// WinePhotoGallery bei einem Upload ohne Netz.
export function AddDiscoverySheet({ cellarId, userId }: { cellarId: string; userId: string }) {
  const db = usePowerSync()
  const { trips } = useTrips(cellarId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const [wineType, setWineType] = useState<WineType | null>(null)
  const [vintage, setVintage] = useState<number | null>(null)
  const [locationMode, setLocationMode] = useState<'text' | 'trip'>('text')
  const [locationText, setLocationText] = useState('')
  const [tripId, setTripId] = useState('')
  const [date, setDate] = useState<string | null>(new Date().toISOString().split('T')[0])
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [price, setPrice] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName(''); setProducer(''); setWineType(null); setVintage(null)
    setLocationMode('text'); setLocationText(''); setTripId('')
    setDate(new Date().toISOString().split('T')[0])
    setRating(null); setNotes(''); setPrice(''); setPhotoFile(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !date) return

    setIsPending(true)
    setError(null)
    try {
      const id = crypto.randomUUID()
      await db.execute(
        `INSERT INTO discoveries
           (id, cellar_id, created_by, name, producer, vintage, type, location_text, trip_id, date, rating, notes, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, cellarId, userId, trimmedName,
          producer.trim() || null, vintage, wineType,
          locationMode === 'text' ? (locationText.trim() || null) : null,
          locationMode === 'trip' ? (tripId || null) : null,
          date, rating, notes.trim() || null,
          price ? parseFloat(price) : null,
        ],
      )

      if (photoFile) {
        try {
          const compressed = await compressImage(photoFile)
          const formData = new FormData()
          formData.append('photo', compressed)
          await apiUpload(`/discoveries/${id}/photo`, formData)
        } catch {
          // Siehe Kommentar oben am Komponenten-Export -- Eintrag bleibt ohne Foto.
        }
      }

      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Entdeckung</Button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>Entdeckung hinzufügen</SheetTitle></SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="ds-name">Name *</Label>
            <Input id="ds-name" required placeholder="z.B. Barolo" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-producer">Produzent</Label>
            <Input id="ds-producer" placeholder="z.B. Gaja" value={producer} onChange={e => setProducer(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jahrgang</Label>
              <DatePicker mode="year" name="vintage" value={vintage} onChange={v => setVintage(v as number | null)} placeholder="Jahr" />
            </div>
            <div className="space-y-2">
              <Label>Datum</Label>
              <DatePicker mode="full" name="date" value={date} onChange={v => setDate(v as string | null)} placeholder="Datum" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <div className="flex gap-2">
              {WINE_TYPES.map(t => (
                <button
                  key={t.value} type="button" onClick={() => setWineType(wineType === t.value ? null : t.value)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)', fontWeight: 500, border: '1px solid', cursor: 'pointer',
                    background: wineType === t.value ? 'var(--primary)' : 'var(--background)',
                    color: wineType === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                    borderColor: wineType === t.value ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fundort</Label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setLocationMode('text')}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', border: '1px solid',
                  background: locationMode === 'text' ? 'var(--primary)' : 'var(--background)',
                  color: locationMode === 'text' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  borderColor: locationMode === 'text' ? 'var(--primary)' : 'var(--border)',
                }}
              >
                Freitext
              </button>
              <button type="button" onClick={() => setLocationMode('trip')} disabled={trips.length === 0}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', border: '1px solid',
                  background: locationMode === 'trip' ? 'var(--primary)' : 'var(--background)',
                  color: locationMode === 'trip' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  borderColor: locationMode === 'trip' ? 'var(--primary)' : 'var(--border)',
                  opacity: trips.length === 0 ? 0.5 : 1,
                }}
              >
                Reise
              </button>
            </div>
            {locationMode === 'text' ? (
              <Input placeholder="z.B. Osteria da Mario" value={locationText} onChange={e => setLocationText(e.target.value)} />
            ) : (
              <Select
                value={tripId}
                onValueChange={v => setTripId(v ?? '')}
                items={trips.map(t => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger><SelectValue placeholder="Reise wählen" /></SelectTrigger>
                <SelectContent>
                  {trips.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Bewertung</Label>
            <RatingInput name="rating" value={rating} onChange={setRating} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-notes">Notizen</Label>
            <Textarea id="ds-notes" placeholder="Eindruck, Essen-Pairing…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-price">Preis (€)</Label>
            <Input id="ds-price" type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-photo">Foto (Etikett)</Label>
            <Input id="ds-photo" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Entdeckung speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [x] **Schritt 3: `app/app/discoveries-screen.tsx` anlegen**

```tsx
'use client'

import { useDiscoveries } from '@/lib/powersync/queries'
import { DiscoveryCard } from '@/components/cellar/discovery-card'
import { AddDiscoverySheet } from '@/app/app/add-discovery-sheet'
import { BackLink } from '@/app/app/back-link'
import { Skeleton } from '@/components/ui/skeleton'

export function DiscoveriesScreen({ cellarId, userId }: { cellarId: string; userId: string }) {
  const { discoveries, isLoading } = useDiscoveries(cellarId)

  return (
    <div className="px-4 pb-6 max-w-lg mx-auto space-y-4">
      <BackLink to="/" className="pt-6">Keller</BackLink>

      <div className="flex items-center justify-between">
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)', color: 'var(--foreground)', margin: 0,
        }}>
          Entdeckungen
        </h1>
        <AddDiscoverySheet cellarId={cellarId} userId={userId} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : discoveries.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
          <p>Noch keine Entdeckungen — der nächste Restaurant-Wein wartet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {discoveries.map(d => <DiscoveryCard key={d.id} discovery={d} />)}
        </div>
      )}
    </div>
  )
}
```

- [x] **Schritt 4: `lib/spa/router.tsx` — Route ergänzen**

Import ergänzen (bei den anderen Screen-Imports):
```tsx
import { DiscoveriesScreen } from '@/app/app/discoveries-screen'
```

Nach `function TripDetailRoute() { ... }` eine Wrapper-Komponente ergänzen (braucht sowohl `cellarId` als auch die eigene `userId` — letztere kommt aus `useMe()`-artigem State; am einfachsten über den bereits vorhandenen `session`/`me`-Kontext in `MeShell`, analog zu wie `cellarId` injiziert wird. Falls `MeShell` die `userId` nicht schon irgendwo exponiert, zusätzlich einen `UserIdContext` nach dem Vorbild von `CellarIdContext` ergänzen und in `MeShell` befüllen):

```tsx
function DiscoveriesRoute() {
  const cellarId = useCellarId()
  const userId = useUserId()
  return <DiscoveriesScreen cellarId={cellarId} userId={userId} />
}
```

Route-Definition nach `tripDetailRoute`:
```tsx
const discoveriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/discoveries',
  component: DiscoveriesRoute,
})
```

Und in `routeTree`-Array (`rootRoute.addChildren([...])`) ergänzen:
```tsx
const routeTree = rootRoute.addChildren([
  indexRoute,
  wineDetailRoute,
  storageLocationsRoute,
  tripsRoute,
  tripDetailRoute,
  discoveriesRoute,
  historyRoute,
  familyRoute,
  cellarSettingsRoute,
  apiKeysRoute,
])
```

> Vor dem Schreiben dieses Schritts kurz verifizieren, wie `userId` aktuell durch den Router fließt (`grep -n "userId" lib/spa/router.tsx`) — falls bereits ein Context/Hook dafür existiert (z. B. aus `/api/v1/me`), den wiederverwenden statt einen neuen `UserIdContext` einzuführen.

- [x] **Schritt 5: `app/app/cellar-screen.tsx` — Nav-Icon ergänzen**

Import ergänzen:
```tsx
import { Plane, History, Users, Settings, Compass } from 'lucide-react'
```

Direkt nach dem `Plane`/Trips-Link-Block (vor `Settings`) ergänzen:
```tsx
<Link to="/discoveries">
  <Button size="icon-sm" variant="outline">
    <Compass className="h-3.5 w-3.5" />
  </Button>
</Link>
```
(Exakte Button-Verschachtelung wie bei den bestehenden `Link`-Blöcken übernehmen — siehe Zeilen 66–84 der Datei.)

- [x] **Schritt 6: Build + Tests**

```bash
npx vitest run
npm run build 2>&1 | tail -30
```
Erwartet: alle Tests PASS, Build ohne TypeScript-Fehler.

- [ ] **Schritt 7: Manuell im Browser prüfen — NICHT durchgeführt**

Diese Session hatte kein Browser-Werkzeug zur Verfügung. Nur verifiziert: `curl localhost:3000/app` und `.../app/discoveries` liefern beide 200, keine Server-Fehler im Dev-Log. Die eigentliche Client-Interaktion (Formular ausfüllen, PowerSync-Insert, Foto-Upload, Löschen) ist **ungetestet** — das muss der nächste tatsächliche Browser-Durchlauf übernehmen:

- `/` → Compass-Icon sichtbar und verlinkt auf `/discoveries`
- `/discoveries` → leerer Zustand, "Entdeckung hinzufügen" öffnet Sheet
- Eintrag mit nur Name anlegen → erscheint sofort in der Liste
- Eintrag mit Reise-Verknüpfung anlegen → Trip-Name erscheint statt Freitext
- Löschen-Dialog → Eintrag verschwindet

- [x] **Schritt 8: Commit**

```bash
git add components/cellar/discovery-card.tsx app/app/add-discovery-sheet.tsx app/app/discoveries-screen.tsx lib/spa/router.tsx app/app/cellar-screen.tsx
git commit -m "feat: add Entdeckungen screen, add/delete sheet, nav entry"
```

---

### Task 7: Reset-Integration

**Files:**
- Modify: `lib/api/reset.ts`

**Interfaces:**
- Consumes: `discoveries`/`discovery_photos`-Tabellen (Task 1)
- Produces: `wipeCellarData` räumt auch Entdeckungen + deren Fotos mit auf

**Acceptance criteria covered:** (kein direktes AC, aber Voraussetzung dafür, dass "Keller zurücksetzen" keine verwaisten Entdeckungen/Storage-Objekte hinterlässt — Konsistenz-Lücke, die sonst durch dieses Feature entstünde)
**Dependencies:** Task 1, Task 2

- [x] **Schritt 1: Photo-Path-Regex ergänzen**

Nach `WINE_PHOTO_PATH` ergänzen:
```ts
const DISCOVERY_PHOTO_PATH = /^families\/([^/]+)\/discoveries\/([^/]+)\/[A-Za-z0-9._-]+$/
```

`isExpectedPhotoPath` erweitern um einen dritten Zweig (Signatur ändert sich: statt `wineId` allgemein `ownerId`):
```ts
function isExpectedPhotoPath(path: string, familyId: string, ownerId: string): boolean {
  const sku = path.match(SKU_PHOTO_PATH)
  if (sku) return sku[1] === familyId && sku[2] === ownerId
  const photo = path.match(WINE_PHOTO_PATH)
  if (photo) return photo[1] === familyId && photo[2] === ownerId
  const discoveryPhoto = path.match(DISCOVERY_PHOTO_PATH)
  if (discoveryPhoto) return discoveryPhoto[1] === familyId && discoveryPhoto[2] === ownerId
  return false
}
```

- [x] **Schritt 2: `wipeCellarData` ergänzen**

Nach dem bestehenden `storage_locations`-Delete (vor dem `return`) ergänzen:

```ts
const { data: discoveries, error: discoveriesError } = await admin
  .from('discoveries').select('id').eq('cellar_id', cellarId)
if (discoveriesError) throw discoveriesError

const discoveryIds = (discoveries ?? []).map(d => d.id)
if (discoveryIds.length > 0) {
  const { data: discoveryPhotos, error: discoveryPhotosError } = await admin
    .from('discovery_photos').select('discovery_id, path').in('discovery_id', discoveryIds)
  if (discoveryPhotosError) throw discoveryPhotosError

  const discoveryPhotoPaths = (discoveryPhotos ?? [])
    .filter(p => isExpectedPhotoPath(p.path as string, familyId, p.discovery_id as string))
    .map(p => p.path as string)

  if (discoveryPhotoPaths.length > 0) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(discoveryPhotoPaths)
    if (removeError) throw removeError
  }

  // discovery_photos-Zeilen cascaden über die FK beim discoveries-Delete.
  const { error: discoveriesDeleteError } = await admin.from('discoveries').delete().in('id', discoveryIds)
  if (discoveriesDeleteError) throw discoveriesDeleteError
}
```

- [x] **Schritt 3: Tests + Build**

```bash
npx vitest run
npm run build 2>&1 | tail -30
```

- [x] **Schritt 4: Commit**

```bash
git add lib/api/reset.ts
git commit -m "fix: clean up discoveries + their photos on cellar reset"
```

---

## Parallel Execution

- **Task 1** muss zuerst laufen (jeder andere Task braucht die Tabellen).
- **Task 2** direkt danach (Typen/Validierung, von fast allem konsumiert).
- **Tasks 3 und 4** können parallel laufen — beide hängen nur von 1+2 ab, berühren disjunkte Dateien (Sync-Schema+Insert-Route vs. Foto-Route).
- **Task 7** kann parallel zu 3/4/5/6 laufen — hängt nur von 1+2 ab, berührt ausschließlich `lib/api/reset.ts`.
- **Task 5** muss auf Task 3 warten (braucht die lokal synchronisierte Tabelle, um sie zu lesen).
- **Task 6** muss auf Task 2, 3 und 5 warten (UI importiert Typen, schreibt lokal in die Tabelle aus Task 3, liest über den Hook aus Task 5, lädt Fotos über die Route aus Task 4).

## Nachträge über den Plan hinaus (beim Implementieren gefunden)

- **Demo-Clear-Route** (`app/api/v1/demo/clear/route.ts`) dupliziert dieselbe Aufräumlogik wie `wipeCellarData`, aber inline statt über den gemeinsamen Helper — hätte Entdeckungen aus der Demo-Phase beim Umstieg auf eine eigene Cantina übersehen. Mit derselben `isExpectedPhotoPath`-Validierung nachgezogen.
- **Pfad-Validierung vor Storage-Löschung:** Die Einzel-Foto-Löschpfade in `app/api/v1/discoveries/[id]/route.ts` (DELETE) und `.../photo/route.ts` (POST/DELETE) riefen `storage.remove()` ohne vorherige `isPhotoPathOwnedByFamily()`-Prüfung auf — anders als das etablierte `wine_photos`-Vorbild. `discovery_photos` hat keinen `update`-Grant, aber ein Familienmitglied könnte per direktem PostgREST-Insert trotzdem eine Zeile mit beliebigem `path` unterschieben (die Insert-Policy prüft nur Cellar-Zugehörigkeit, nicht die Pfad-Form). Gefixt, bevor es committet wurde.

## Commit Plan

- `feat: DB migration — add discoveries + discovery_photos tables with RLS` (Task 1)
- `feat: add Discovery type, parseDiscoveryInsert validation + tests` (Task 2)
- `feat: sync discoveries via PowerSync, add insert/delete API route` (Task 3)
- `feat: add single-photo upload/delete route for discoveries` (Task 4)
- `feat: add useDiscoveries query hook` (Task 5)
- `feat: add Entdeckungen screen, add/delete sheet, nav entry` (Task 6)
- `fix: clean up discoveries + their photos on cellar reset` (Task 7)
