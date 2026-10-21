# Entdeckungen (Wine Discoveries) — Spec

**Datum:** 2026-10-21
**Status:** Draft — wartet auf Freigabe

## Kontext

Aktuell kennt Cantina Colaci nur Weine, die man **besitzt** (`wines` + `skus`, mit Menge und Bestand) und Verkostungen, die an eine eigene, bereits im Bestand befindliche Flasche gebunden sind (`tastings.cellar_entry_id`). Für einen Wein, den man **außerhalb des eigenen Kellers** probiert (im Restaurant, bei einem Winzerbesuch, bei Freunden) und einfach nur merken will, gibt es noch keinen Platz — er gehört nicht in den Bestand, und es gibt nichts, an das sich eine Verkostung hängen könnte.

"Entdeckungen" ist eine eigene, vom Keller-Bestand komplett getrennte Merkliste pro Familie: Name, Fundort, Bewertung, Notizen, Preis, Foto. Keine automatische Übernahme in den Keller — wer die Flasche später kauft, legt sie ganz normal über "Wein hinzufügen" an.

## User Stories

- Als Familienmitglied möchte ich einen Wein, den ich außerhalb des eigenen Kellers probiert habe, schnell mit Name, Produzent und Jahrgang erfassen, damit ich ihn nicht vergesse.
- Als Familienmitglied möchte ich dazu optional eine Bewertung (1–5), eine Notiz, einen Preis und ein Etikettenfoto hinterlegen.
- Als Familienmitglied möchte ich den Fundort entweder frei eintippen (z. B. "Osteria da Mario") oder, falls der Fund während einer erfassten Reise war, mit einem bestehenden Trip verknüpfen.
- Als Familienmitglied möchte ich alle Entdeckungen der Familie in einer Liste sehen, nicht nur meine eigenen.
- Als Familienmitglied möchte ich eine Entdeckung löschen können (z. B. Fehleingabe).

## Terminologie

| Technisch | UI-Text |
|-----------|---------|
| `discoveries` (Tabelle) | — |
| `Discovery` (Typ) | Entdeckung |
| Liste/Screen | Entdeckungen |
| `addDiscovery` | Entdeckung hinzufügen |

## Datenmodell

Eigenständige, cellar-gescopte Tabelle — gleiches Sharing-Modell wie `trips` (eine Zeile pro Eintrag, sichtbar für alle Mitglieder der Familie über `cellar_id` → `cellars.family_id`), kein Bezug zu `wines`/`skus`.

```sql
create table discoveries (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references cellars(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  producer text,
  vintage int,
  type text check (type in ('red', 'white', 'rosé', 'sparkling')),
  location_text text,
  trip_id uuid references trips(id) on delete set null,
  date date not null default current_date,
  rating int check (rating >= 1 and rating <= 5),
  notes text,
  price numeric(10,2),
  photo_path text,
  created_at timestamptz not null default now()
);

alter table discoveries enable row level security;

create policy "family members can read discoveries" on discoveries
  for select using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can insert discoveries" on discoveries
  for insert with check (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

create policy "family members can delete discoveries" on discoveries
  for delete using (
    exists (
      select 1 from public.cellars
      where public.cellars.id = discoveries.cellar_id
      and public.is_family_member(public.cellars.family_id)
    )
  );

grant select, insert, delete on public.discoveries to authenticated, service_role;
```

Kein `update`-Policy/Grant in v1 — Bearbeiten ist out of scope (siehe unten), nur Anlegen + Löschen.

`name`/`producer`/`vintage`/`type` sind bewusst lose (kein Pflicht-Produzent wie bei `wines.producer`) — im Restaurant ist oft nicht klar, wer der Produzent ist, nur der Name auf der Karte.

## TypeScript-Typen (`lib/types.ts`)

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
  photo_path: string | null
  created_at: string
}
```

Analog zu `parseTripInsert`/`parseTastingInsert` kommt `parseDiscoveryInsert` in `lib/api/discovery.ts` — gleiche Validierungstiefe (Pflichtfelder: `cellar_id`, `name`; alles andere optional, `rating` falls gesetzt 1–5 int).

## PowerSync-Schema (`lib/powersync/schema.ts`)

Neuer Stream `discoveries`, neunter Eintrag in `AppSchema` — gleiches Muster wie `trips`:

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
    photo_path: column.text,
    created_at: column.text,
  },
  { indexes: { cellar: ['cellar_id'] } }
)
```

Muss zusätzlich in der self-gehosteten PowerSync `sync-config.yaml` als neuer Stream (`SELECT discoveries.*`, scoped über `cellar_id` → `cellars.family_id` → `family_members`) ergänzt werden, gleiche Stelle wie der bestehende `trips`-Stream.

## API-Route

`app/api/v1/discoveries/[id]/route.ts` — Insert-only `PUT`, 1:1 das gleiche Muster wie `app/api/v1/trips/[id]/route.ts`: `requireApiUser` → `parseDiscoveryInsert` → `requireOwnCellar(admin, user, fields.cellar_id)` → `insert()` (23505 = schon hochgeladen, kein Fehler) → 204.

`DELETE` zusätzlich (gibt es bei Trips noch nicht, aber hier explizit gefordert — "löschen können"): lädt die Zeile, prüft `requireOwnCellar` über ihre `cellar_id`, löscht. Foto (falls `photo_path` gesetzt) wird dabei mitgelöscht, analog zum bestehenden Foto-Cleanup bei Wine/Sku-Löschung.

## Foto-Upload

Wiederverwendung von `lib/storage/wine-photos.ts` (Bucket `wine-photos`): neuer Pfad-Namespace `families/<family_id>/discoveries/<discovery_id>/<photoId>.<ext>`, `isPhotoPathOwnedByFamily()` greift unverändert (Prefix-Check), kein Code in `wine-photos.ts` ändert sich.

## UI

- Neuer Screen `app/app/discoveries-screen.tsx` — Liste als Karten (neue `DiscoveryCard`, Look & Feel an `TastingCard` angelehnt: Name/Produzent/Jahrgang, Bewertung rechts, Fundort + Datum, aufklappbare Notiz, Foto-Thumbnail falls vorhanden).
- Neuer `app/app/add-discovery-sheet.tsx` (Bottom-Sheet wie `QuickAddSheet`): Name* , Produzent, Jahrgang, Typ-Chips, Bewertung (1–5, gleiche Komponente wie im Tasting-Sheet), Notiz, Preis, Fundort — als Segmented Control "Freitext" / "Trip wählen" (Select über bestehende Trips der Cellar), Foto-Upload.
- Route `/discoveries` in `lib/spa/router.tsx`, gleiches Muster wie `tripsRoute`.
- Neuer Icon-Link in der Quick-Links-Zeile in `cellar-screen.tsx` (neben `Users`/`History`/`Plane`/`Settings`) — Vorschlag: `Compass` aus `lucide-react`, Link zu `/discoveries`.

## Acceptance Criteria

- [ ] Given ein Familienmitglied öffnet "Entdeckung hinzufügen", when nur der Pflichtname eingegeben und gespeichert wird, then entsteht lokal sofort eine `discoveries`-Zeile und wird über PowerSync hochgeladen (ohne Netz: Zeile existiert lokal, Upload folgt beim nächsten Online-Moment).
- [ ] Given ein zweites Familienmitglied derselben Cellar, when es die Entdeckungen-Liste öffnet, then sieht es die vom ersten Mitglied angelegte Entdeckung inkl. `created_by`-Zuordnung.
- [ ] Given eine Entdeckung mit `trip_id`, when die Trip-Detailseite oder die Entdeckungen-Liste gerendert wird, then ist der verknüpfte Trip-Name sichtbar (keine doppelte Ortseingabe nötig).
- [ ] Given eine Entdeckung ohne `trip_id`, when `location_text` gesetzt ist, then wird dieser Freitext angezeigt.
- [ ] Given `rating` wird beim Anlegen nicht gesetzt, then wird die Entdeckung trotzdem gespeichert (Bewertung ist optional, keine Pflichtangabe wie bei `tastings.rating`).
- [ ] Given ein Mitglied löscht eine Entdeckung mit Foto, then wird sowohl die DB-Zeile als auch das Storage-Objekt entfernt.
- [ ] Given ein Mitglied einer *anderen* Familie, when es versucht per API eine Entdeckung dieser Cellar zu lesen/löschen, then schlägt das über RLS/`requireOwnCellar` fehl (403/leeres Ergebnis).

## Edge Cases und Fehlerzustände

- Name fehlt → Submit-Button bleibt deaktiviert / 400 von der API (wie bei `parseTripInsert`).
- `rating` außerhalb 1–5 oder kein Integer → 400 (DB-Check wäre ohnehin ein Fallback, aber die API validiert vorher wie bei `parseTastingInsert`).
- `trip_id` verweist auf einen Trip einer anderen Cellar → `requireOwnCellar`-Check auf `cellar_id` der Discovery reicht nicht aus, die API muss zusätzlich prüfen, dass der referenzierte Trip zur selben `cellar_id` gehört (sonst könnte man fremde Trip-IDs "erraten" und verknüpfen — kein Datenleck, aber eine falsche Verknüpfung). Bei Mismatch: 400.
- Foto-Upload schlägt fehl (Netz/Storage) → Entdeckung wird trotzdem ohne Foto gespeichert, nicht blockierend (gleiches Verhalten wie bestehender Wine-Foto-Upload).
- Offline angelegt, nie wieder online → Zeile bleibt lokal sichtbar für den Ersteller, taucht bei anderen Familienmitgliedern erst nach Sync auf (Standard-PowerSync-Verhalten, nichts Neues).

## Out of Scope

- Übernahme einer Entdeckung in den Keller-Bestand (kein "Wein kaufen"-Button) — bewusst entschieden, getrennte Liste.
- Bearbeiten einer bestehenden Entdeckung nach dem Anlegen (nur Anlegen + Löschen in v1).
- Privatsphäre pro Nutzer (alle Entdeckungen sind familienweit sichtbar, kein "nur für mich").
- Preis-Einheit (Glas vs. Flasche) als eigenes Feld — `price` ist ein einzelnes Zahlenfeld, Einheit ggf. in `notes` festhalten.
- Sortierung/Filterung der Entdeckungen-Liste (Typ-Filter wie im Keller, Sortierung nach Datum/Bewertung) — v1 zeigt chronologisch neueste zuerst, nichts weiter.
- Verknüpfung mit externen Shops/Preisvergleich.

## Offene Punkte zur Freigabe

1. **Bearbeiten in v1 weglassen** — nur Anlegen/Löschen, kein Edit-Sheet. Passt das, oder soll Edit direkt mit?
2. **Icon für die Navigation**: Vorschlag `Compass`. Alternative gewünscht?
3. **Rating optional statt Pflichtfeld** (anders als bei `tastings.rating`, das `not null` ist) — damit eine schnelle Erfassung im Restaurant nicht an einer fehlenden Bewertung scheitert. Einverstanden?
