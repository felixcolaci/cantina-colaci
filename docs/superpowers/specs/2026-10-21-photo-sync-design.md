# Foto-Sync (Read-Cache + Offline-Upload-Queue) — Spec

**Datum:** 2026-10-21
**Status:** Draft — wartet auf Freigabe

## Kontext

Wein- und Entdeckungs-Fotos laufen heute komplett außerhalb von PowerSync: `wine_photos`/`discovery_photos` sind reine REST-Ressourcen (`lib/storage/wine-photos.ts`, `app/api/v1/wines/[id]/photos/*`, `app/api/v1/discoveries/[id]/photo/*`), gelesen über frisch signierte Supabase-Storage-URLs (`signPhotoPath`/`signPhotoPaths`, 1h TTL) und geschrieben per direktem `POST`. Das bringt zwei Probleme:

1. **Kein brauchbarer Read-Cache.** Jede signierte URL trägt einen frischen `?token=...`. Das bricht jedes URL-basierte Caching (Service Worker, HTTP-Cache, Next-Image-Optimizer) — derselbe Pfad ergibt bei jedem Aufruf eine andere URL, also immer einen Cache-Miss, obwohl sich die Foto-Bytes nie ändern.
2. **Kein Offline-Upload.** Ein Foto-Upload ohne Netz schlägt einfach fehl (siehe Kommentar in `wine-photo-gallery.tsx`). Im Keller ist Empfang aber oft schlecht — ein Foto soll dort aufgenommen und automatisch hochgeladen werden, sobald wieder Netz da ist.

Diese Spec deckt beides ab: einen stabilen, für immer cachebaren Lese-Pfad (Teil A) und eine echte Offline-Upload-Queue auf Basis des in `@powersync/common` eingebauten `AttachmentQueue` (Teil B) — fertig in der bereits installierten PowerSync-Version, kein neues Package nötig.

Bereits entschieden (siehe Brainstorm):
- Beide Foto-Arten (Wein-Galerie **und** Entdeckungs-Einzelfoto) werden gemeinsam umgebaut, nicht nacheinander.
- Ein wartendes Foto zeigt sichtbar einen Pending-Status in der UI.
- Wird der zugehörige Wein/die Entdeckung gelöscht, bevor ein wartendes Foto hochgeladen wurde, wird der Queue-Eintrag verworfen (kein Upload-Versuch für etwas, das eh weg ist).

## User Stories

- Als Familienmitglied möchte ich ein bereits angesehenes Foto auch ohne Netz sofort wiedersehen.
- Als Familienmitglied möchte ich im Keller (oft ohne Empfang) ein Foto zu einem Wein oder einer Entdeckung aufnehmen, ohne dass der Upload scheitert — er soll automatisch nachgeholt werden, sobald wieder Netz da ist.
- Als Familienmitglied möchte ich sehen, ob ein Foto noch "unterwegs" ist, statt im Unklaren zu sein, ob es wirklich gespeichert wurde.
- Als Familienmitglied möchte ich, dass ein gelöschtes Foto zuverlässig verschwindet — aus der Galerie, aus dem Cache und aus einer eventuell noch wartenden Upload-Queue.

## Teil A: Stabiler Read-Cache

### Neuer Endpoint

`GET /api/v1/photos/[...path]` (neue catch-all Route, `path` = die Storage-Objekt-Segmente, z. B. `families/<familyId>/wines/<wineId>/<photoId>.jpg` oder `demo/<file>.jpg`):

- `requireApiUser` → `familyId` via `get_cellar_context`-RPC (gleiches Muster wie `resolveWineFamily`/`resolveDiscoveryFamily`).
- Ownership-Check: `isPhotoPathOwnedByFamily(path, familyId) || isDemoPhotoPath(path)` (beide Helfer bleiben unverändert in `lib/storage/wine-photos.ts`) — sonst 403, kein Storage-Zugriff.
- Lädt die Bytes direkt: `admin.storage.from(BUCKET).download(path)`, streamt sie zurück mit `Content-Type` passend zur Dateiendung (aus `ALLOWED_PHOTO_TYPES`-Mapping rückwärts) und `Cache-Control: private, max-age=31536000, immutable`.
- Kein Signieren, kein Token, keine Ablaufzeit — der Pfad selbst ist der stabile Identifier.

`signPhotoPath`/`signPhotoPaths`/`SIGNED_URL_TTL_SECONDS` werden ersatzlos aus `lib/storage/wine-photos.ts` entfernt (einzige Aufrufer sind die beiden Foto-Routen, die auf den neuen Endpoint umgestellt werden). `GET /wines/[id]/photos` und `GET /discoveries/[id]/photo` geben direkt `{ id, url: '/api/v1/photos/' + path }` zurück — kein Storage-Call mehr beim Auflisten.

### Service Worker (`sw.ts`)

Neue Runtime-Caching-Regel, `CacheFirst` (nicht `StaleWhileRevalidate` wie bei den Pages — Inhalt ist unveränderlich):

```ts
{
  matcher: ({ url }) => url.pathname.startsWith('/api/v1/photos/'),
  handler: new CacheFirst({
    cacheName: 'photo-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 300 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
}
```

### `next.config.ts`

Der `images.remotePatterns`-Eintrag für `*.supabase.co` entfällt (Fotos sind jetzt same-origin). `<Image>`-Verwendungen (`wine-photo-gallery.tsx`, `wine-card.tsx`, `discovery-card.tsx`) bekommen `unoptimized` — die Fotos sind vorab client-seitig komprimiert (`compressImage`), Next's Resize-Pipeline bringt wenig, würde aber pro Breite/Qualität eine eigene `/_next/image?...`-Cache-Variante erzeugen und damit die 1:1-Beziehung zwischen Storage-Pfad und Cache-Eintrag aufweichen.

### Löschen & Logout

- Nach erfolgreichem `DELETE` eines Fotos (egal ob Wein-Galerie oder Entdeckung): Client ruft zusätzlich `caches.open('photo-cache').then(c => c.delete('/api/v1/photos/' + path))` — best-effort Aufräumen, kein Korrektheits-Erfordernis (der Pfad wird ja nie wieder angefragt).
- Beim Logout: `caches.delete('photo-cache')` — verhindert, dass auf einem gemeinsam genutzten Gerät nach Account-Wechsel versehentlich noch alte, im Cache liegende Fotos der vorherigen Familie sichtbar werden.

## Teil B: Offline-Upload-Queue

### Warum `AttachmentQueue` (aus `@powersync/common`)

Bereits Teil der installierten `@powersync/web`-Abhängigkeit (das eigenständige `@powersync/attachments`-Paket wurde dafür deprecated und eingebaut). `@powersync/web` liefert zusätzlich `IndexDBFileSystemAdapter` als lokalen Storage-Adapter. Die Queue übernimmt bereits: lokale Dateiablage, Zustandsmaschine (`QUEUED_UPLOAD` → `SYNCED`, `QUEUED_DELETE` → archiviert), automatischen Retry bei Connectivity-Wechsel (hört auf PowerSyncs eigenes `statusChanged`) plus periodisches Polling als Backstop — kein Background-Sync-API-Bedarf (gut, die wird auf iOS Safari eh nicht unterstützt).

**Wichtige Einschränkung:** Die eigentlichen Foto-Bytes laufen **nicht** über PowerSyncs normale CRUD-Sync-Queue (`lib/powersync/connector.ts`), sondern über die `AttachmentQueue`'s eigenen `remoteStorage`-Transport. Nur die *Metadatenzeile* (`id`, `wine_id`/`discovery_id`, `path`, `sort_order`, `created_at` — keine Bytes) wird ein normaler, gesyncter PowerSync-Table-Eintrag und läuft über den bestehenden `ApiBackendConnector`. Das bedeutet zwei voneinander unabhängige Pipelines mit unterschiedlicher Geschwindigkeit: Die Metadatenzeile kann auf einem anderen Gerät ankommen, *bevor* die Bytes hochgeladen sind — das ist erwartetes Verhalten (eventually consistent), kein Bug. Bis die Bytes da sind, zeigt die Galerie für diese Zeile einen Platzhalter.

### Neue synced Tabellen (`lib/powersync/schema.ts`)

Zehnter/elfter Eintrag in `AppSchema`, gleiches Muster wie die bestehenden 8 Streams:

```ts
const wine_photos = new Table(
  {
    wine_id: column.text,
    path: column.text,
    sort_order: column.integer,
    created_at: column.text,
  },
  { indexes: { wine: ['wine_id'] } }
)

const discovery_photos = new Table(
  {
    discovery_id: column.text,
    path: column.text,
    created_at: column.text,
  },
  { indexes: { discovery: ['discovery_id'] } }
)
```

Spalten entsprechen 1:1 den bestehenden Postgres-Tabellen (per `mcp__Supabase__list_tables` geprüft: `wine_photos(id, wine_id, path, sort_order, created_at)`, `discovery_photos(id, discovery_id, path, created_at)` — `path` trägt die Dateiendung bereits, keine neue Spalte nötig). Muss zusätzlich als neue Streams in der self-gehosteten PowerSync `sync-config.yaml` ergänzt werden (außerhalb dieses Repos, gleiche Stelle wie die bestehenden 8 Streams), gescoped über `wine_id → wines.cellar_id → cellars.family_id → family_members` bzw. `discovery_id → discoveries.cellar_id → cellars.family_id → family_members`.

### Neue API-Routen für die Metadaten-Zeile

Der bestehende `ApiBackendConnector` (`lib/powersync/connector.ts`) baut für jede lokale Änderung `PUT/PATCH/DELETE /api/v1/<table>/<id>` — für `wine_photos`/`discovery_photos` fehlen diese Routen noch:

- `app/api/v1/wine_photos/[id]/route.ts`:
  - `PUT` — `requireApiUser` → `resolveWineFamily(admin, user.id, opData.wine_id)` → **Pfad-Validierung** `isPhotoPathOwnedByFamily(opData.path, familyId)` (sonst 400 — der Client könnte sonst, wie im bestehenden Kommentar in `wine-photos.ts` beschrieben, einen beliebigen `path` unterschieben) → `insert({ id, wine_id, path, sort_order, created_at })` (23505 = schon synced, kein Fehler) → 204.
  - `DELETE` — Zeile per `id` laden, `wine_id` daraus nehmen, `resolveWineFamily` → Zeile löschen → 204. (Löscht nur die Metadatenzeile, **nicht** das Storage-Objekt — das übernimmt die `AttachmentQueue` separat, siehe unten.)
- `app/api/v1/discovery_photos/[id]/route.ts` — gleiche Form, via `resolveDiscoveryFamily`. Single-Slot-Semantik (ein Foto pro Entdeckung) wird clientseitig beim Insert durchgesetzt (altes lokales Row löschen, bevor das neue eingefügt wird — siehe UI-Flow unten), nicht serverseitig.

### Bestehende Binär-Routen — umgebaut auf "nur Bytes"

- `app/api/v1/wines/[id]/photos/[photoId]/route.ts`: neues `PUT` (Bytes hochladen an einen vom Client bereits festgelegten Pfad — gleiche Validierung wie heute: `ALLOWED_PHOTO_TYPES`, `MAX_PHOTO_BYTES`, `isPhotoPathOwnedByFamily`). `DELETE` bleibt, verliert aber den `wine_photos`-Zeilen-Delete (das übernimmt jetzt die generische Route oben) — löscht nur noch das Storage-Objekt.
- `app/api/v1/wines/[id]/photos/route.ts`: `POST` (bisher: Insert + Upload kombiniert, serverseitig generierte `photoId`) entfällt ersatzlos — ersetzt durch generische Metadaten-Route + neues `PUT` oben. `GET` bleibt (Auflisten), vereinfacht auf stabile URLs (siehe Teil A).
- `app/api/v1/discoveries/[id]/photo/route.ts`: analog — `POST` entfällt, neue `app/api/v1/discoveries/[id]/photo/[photoId]/route.ts` mit `PUT` (Bytes) + `DELETE` (nur Storage-Objekt) kommt dazu.

### `AttachmentQueue`-Konfiguration

Neues Modul, z. B. `lib/powersync/attachment-queues.ts`, zwei Instanzen (eine pro Entität — einfacher als eine polymorphe Queue, da `uploadFile`/`deleteFile` je nach Typ einen anderen Endpoint ansprechen):

- `localStorage: new IndexDBFileSystemAdapter()` (aus `@powersync/web`).
- `remoteStorage`: eigener Adapter —
  - `uploadFile(fileData, attachment)`: liest `wineId` aus `attachment.metaData` (JSON-String, gesetzt bei `saveFile()`), `PUT /api/v1/wines/<wineId>/photos/<attachment.id>` mit den rohen Bytes + `Content-Type: attachment.mediaType`.
  - `deleteFile(attachment)`: `DELETE` an denselben Pfad.
  - `downloadFile`: nie aufgerufen (`downloadAttachments: false` — der Lese-Pfad läuft komplett über Teil A, kein Bedarf, Bytes aufs Gerät vorzuhalten).
- `watchAttachments`: PowerSync-Watched-Query über `wine_photos` (bzw. `discovery_photos`), jede Zeile → `{ id, fileExtension: path.split('.').pop(), metaData: JSON.stringify({ wineId: row.wine_id }) }`.
- `startSync()` beim App-Bootstrap neben dem bestehenden `db.connect(...)`, `stopSync()` beim Logout.

### UI-Flow: Foto aufnehmen (`wine-photo-gallery.tsx`, analog für Entdeckungen)

1. `compressImage(file)` (unverändert).
2. `familyId` lokal auflösen (kleine PowerSync-Query über die bereits gesyncten Tabellen: `wines.cellar_id → cellars.family_id` — keine Netzwerkanfrage, funktioniert offline).
3. `id = await wineAttachmentQueue.generateAttachmentId()`, `ext = ALLOWED_PHOTO_TYPES[compressed.type]`, `path = buildWinePhotoPath(familyId, wineId, id, ext)` — `buildWinePhotoPath`/`buildDiscoveryPhotoPath` sind reine Funktionen ohne Server-Only-Abhängigkeit und bereits clientseitig importierbar.
4. `wineAttachmentQueue.saveFile({ id, data: await compressed.arrayBuffer(), fileExtension: ext, mediaType: compressed.type, metaData: JSON.stringify({ wineId }), updateHook: (tx) => tx.execute('INSERT INTO wine_photos (id, wine_id, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)', [id, wineId, path, nextSortOrder, nowIso]) })` — Datei liegt sofort lokal, Metadatenzeile entsteht atomar in derselben Transaktion.
5. Galerie liest nicht mehr per `useQuery`/`apiGet`, sondern reaktiv aus der lokalen `wine_photos`-Tabelle (`@powersync/react`), gejoint mit dem Attachment-Zustand für den Pending-Badge.
6. Stabile Bild-URL für eine Zeile: `/api/v1/photos/${path}` (Teil A) — sobald `state === 'synced'`; davor ein Platzhalter mit Pending-Badge (kleiner Spinner, gleicher Blur-Kreis-Stil wie der bestehende Lösch-Button).

### Löschen

`wineAttachmentQueue.deleteFile({ id: photoId, updateHook: (tx) => tx.execute('DELETE FROM wine_photos WHERE id = ?', [photoId]) })` — Zeile verschwindet lokal+remote über normales CRUD-Delete, das Storage-Objekt wird von der Queue mit denselben Retry-Garantien entfernt.

### Orphan-Handling (verworfener Queue-Eintrag bei gelöschtem Wein/Entdeckung)

`AttachmentQueue.startSync()` vergleicht bei jedem Tick die aktuell referenzierten Zeilen mit der Queue — eine Zeile, die verschwindet, bevor ihr Attachment synced ist, wird automatisch archiviert (kein Upload-Versuch mehr). Das deckt den Fall "Zeile gelöscht" automatisch ab, **solange** das Löschen eines Weins/einer Entdeckung auch lokal (nicht erst nach Server-Rückmeldung) die zugehörigen `wine_photos`/`discovery_photos`-Zeilen mitlöscht — PowerSync erzwingt FK-Kaskaden auf dem lokalen SQLite-Spiegel nicht automatisch. Die bestehenden Wein-/Entdeckungs-Lösch-Aktionen müssen daher in derselben lokalen Transaktion zusätzlich `DELETE FROM wine_photos WHERE wine_id = ?` (bzw. `discovery_photos`) ausführen — unabhängig davon, ob die Foto-Zeile schon synced ist oder noch lokal-only.

## Acceptance Criteria

- [ ] Given ein bereits angesehenes Foto, when das Gerät offline ist und die Galerie erneut geöffnet wird, then wird das Foto weiterhin angezeigt (aus dem Service-Worker-Cache, kein Netzwerkfehler).
- [ ] Given ein Foto wird zweimal geladen (auch nach >1h), then ist die angefragte URL beide Male identisch (kein neues Signieren, kein Token).
- [ ] Given ein Foto wird gelöscht, then verschwinden sowohl das Storage-Objekt als auch der zugehörige Service-Worker-Cache-Eintrag.
- [ ] Given ein Familienmitglied im Keller ohne Netz, when es ein Foto zu einem Wein aufnimmt, then erscheint das Foto sofort lokal mit sichtbarem Pending-Status, ohne Fehlermeldung.
- [ ] Given das Gerät bekommt wieder Netz, then wird ein wartendes Foto automatisch hochgeladen und der Pending-Status verschwindet, ohne erneute Nutzerinteraktion.
- [ ] Given ein zweites Familienmitglied ist online, then sieht es die neue Foto-Zeile, sobald sie synced ist — auch wenn die Bytes selbst erst etwas später nachkommen.
- [ ] Given ein Wein wird gelöscht, während eines seiner Fotos noch unsynced in der Queue hängt, then wird der Queue-Eintrag verworfen und es erfolgt kein Upload-Versuch mehr.
- [ ] Given ein Familienmitglied meldet sich auf einem gemeinsam genutzten Gerät ab, then wird der Foto-Cache (Service Worker) geleert.
- [ ] Given eine Entdeckung bekommt offline ein zweites Foto, bevor das erste synced ist, then wird nur das zweite tatsächlich hochgeladen; das erste wird verworfen (Single-Slot-Semantik bleibt erhalten).

## Edge Cases und Fehlerzustände

- Pfad an `GET /api/v1/photos/[...path]`, der weder zur eigenen Familie noch zu `demo/` gehört → 403, kein Storage-Zugriff (gleiche Prüfung wie heute bei `signPhotoPath`).
- `PUT /api/v1/wine_photos/[id]` mit einem `path`, der nicht unter der eigenen Familie liegt → 400, vom bestehenden `ApiBackendConnector` als permanenter Fehler behandelt (4xx wird nicht endlos retried, Transaction wird verworfen) — kein Sonderfall nötig.
- Foto zu groß/falsches Format beim Binär-Upload → gleiche Validierung wie heute (`ALLOWED_PHOTO_TYPES`, `MAX_PHOTO_BYTES`); muss in der `AttachmentQueue`'s eigenem Fehlerpfad (`AttachmentErrorHandler`) ebenfalls als permanenter (nicht endlos wiederholter) Fehler behandelt werden — sonst hängt ein kaputtes Foto für immer in der Queue.
- Zwei Geräte derselben Familie ersetzen/löschen gleichzeitig dasselbe Entdeckungsfoto offline → letzter Sync gewinnt (Standard-PowerSync-Semantik), keine explizite Konfliktauflösung in v1.
- Sehr viele offline aufgenommene Fotos → Speicherplatz des Geräts (IndexedDB) ist die einzige Grenze, keine App-seitige Obergrenze in v1.
- Service-Worker-Cache wird vom Browser unter Speicherdruck geleert → Foto lädt beim nächsten Zugriff einfach erneut über `/api/v1/photos/...` nach, kein Datenverlust.

## Out of Scope

- Echtes Offline-Vorhalten von Fotos, die auf diesem Gerät noch nie angesehen wurden (kein `downloadAttachments: true`, kein Pre-Fetch) — reiner "was ich schon gesehen habe"-Cache.
- SKU-Fotos (`skus.photo_path`) — Spalte existiert, es gibt aber noch keinen Upload-Flow dafür; bleibt unangetastet.
- Video oder andere Medientypen.
- Explizite Konfliktauflösung bei gleichzeitigem Bearbeiten desselben Foto-Slots durch zwei Geräte.
- Nutzer-seitige Warnung/Obergrenze bei zu vielen wartenden Uploads.
- Migration bestehender, bereits hochgeladener Fotos — sie funktionieren nach dem Umbau unverändert weiter (gleicher Storage-Pfad), nur der Lese-Pfad (URL) ändert sich.
