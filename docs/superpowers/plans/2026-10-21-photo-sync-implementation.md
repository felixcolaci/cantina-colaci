# Foto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-10-21-photo-sync-design.md` — approved

**Goal:** Replace signed, per-request photo URLs with a stable, forever-cacheable app endpoint (Teil A), and move photo uploads onto a PowerSync `AttachmentQueue` so a photo taken offline queues locally and uploads automatically on reconnect (Teil B).

**Architecture:** Two independently-syncing pipelines, by design. (1) A new cookie-authenticated `GET /api/v1/photos/[...path]` streams bytes straight from Storage with an immutable `Cache-Control`; a new `CacheFirst` Service Worker rule makes every previously-viewed photo available offline forever, keyed by the stable storage path (never a token). (2) `wine_photos`/`discovery_photos` become ordinary PowerSync-synced tables (metadata only — `path`, no bytes) draining through the existing `ApiBackendConnector` into two new generic `/api/v1/wine_photos/[id]` / `/api/v1/discovery_photos/[id]` routes; the actual bytes travel separately through a PowerSync `AttachmentQueue` (built into `@powersync/common`, already a dependency) whose `remoteStorage` adapter PUTs/DELETEs against slimmed-down binary-only endpoints. A device offline in the cellar gets an immediate local row + pending badge; both the metadata row and the bytes sync independently once online, in whichever order completes first.

**Tech Stack:** `@powersync/web`/`@powersync/common` (`AttachmentQueue`, `IndexDBFileSystemAdapter`), `@serwist/next` / `serwist` (Service Worker runtime caching), existing `lib/api/*`, `lib/spa/api-client.ts`, `lib/storage/wine-photos.ts` helpers, Supabase Storage (admin client), Vitest.

## Global Constraints

- No Postgres schema/migration changes needed. `wine_photos`/`discovery_photos` already have exactly the columns required (verified live via Supabase MCP: `wine_photos(id, wine_id, path, sort_order, created_at)`, `discovery_photos(id, discovery_id, path, created_at)`, both already `rls_enabled`, `discovery_photos.discovery_id` already unique, `wine_photos.wine_id`/`discovery_photos.discovery_id` already `ON DELETE CASCADE`). Writes to these tables go through the admin client with explicit ownership checks in route handlers, same as every other synced table in this codebase — not through Postgres RLS (see `lib/powersync/connector.ts`'s comment: Postgres cannot verify Supabase's auth JWTs here, so `auth.uid()` is always null for a direct PostgREST call).
- The self-hosted PowerSync `sync-config.yaml` (external repo, not in this checkout) needs two new streams for `wine_photos`/`discovery_photos`, scoped the same way as the existing `trips`/`discoveries` streams (`wine_id → wines.cellar_id → cellars.family_id → family_members`, `discovery_id → discoveries.cellar_id → cellars.family_id → family_members`). This plan cannot execute that change; call it out explicitly as a manual follow-up when Task 6 is done.
- `GET /api/v1/photos/[...path]` is hit by plain `<img>`/`<Image>` loads, which never carry the `Authorization: Bearer` header every other `/api/v1/*` route relies on (`requireApiUser`). It must authenticate from the Supabase session **cookie** instead (`@supabase/ssr`'s browser client already stores the session there). `proxy.ts`'s matcher excludes `/api/**`, so this route cannot rely on `getAuthenticatedUser()`'s cached-session shortcut (per that function's own doc comment) — it must do its own independent `supabase.auth.getUser()` call against the cookie-backed client. This is a deliberate, scoped exception to the Bearer-only convention; comment it as such in the code.
- Match this codebase's existing test boundary: pure logic in `lib/**` gets unit tests (Vitest, admin-client/RPC mocked — see `lib/storage/__tests__/wine-photos.test.ts`, `lib/api/__tests__/discovery.test.ts` for the convention); route handlers under `app/api/**` are not directly unit-tested anywhere in this repo today, so new routes follow the same pattern (no new route-level test files) and are instead covered by manual/E2E verification (`/run`).
- `compressImage`, `ALLOWED_PHOTO_TYPES`, `MAX_PHOTO_BYTES`, `buildWinePhotoPath`, `buildDiscoveryPhotoPath`, `isPhotoPathOwnedByFamily`, `isDemoPhotoPath`, `BUCKET` are all reused unchanged. `buildWinePhotoPath`/`buildDiscoveryPhotoPath`/`isPhotoPathOwnedByFamily`/`isDemoPhotoPath` have zero server-only runtime imports (only an `import type`), so they're safe to import from client components too.

---

## Checkpoint A — Spec Coverage

```
AC1 (Foto offline weiter sichtbar)                → Task 4 (SW CacheFirst) ✓
AC2 (identische URL bei wiederholtem Laden)        → Task 2 (stabiler Endpoint) ✓
AC3 (Löschen räumt Storage + Cache auf)            → Task 5 ✓
AC4 (Foto offline aufnehmen, sofort sichtbar+Pending) → Task 11 ✓
AC5 (automatischer Upload bei Reconnect)           → Task 10 (AttachmentQueue reconnect handling, built-in) + Task 11 ✓
AC6 (zweites Mitglied sieht Metadatenzeile vor Bytes) → Task 6 + Task 7 ✓
AC7 (Orphan: gelöschte Entdeckung verwirft Queue-Eintrag) → Task 12 ✓
AC8 (Logout leert Foto-Cache)                      → Task 5 ✓
AC9 (Single-Slot Ersetzen verwirft alten Queue-Eintrag) → Task 12 ✓
```

Spec coverage verified: all 9 acceptance criteria are covered.

Note on wines: this app has no single-wine delete action today (only full cellar reset / demo clear, which already wipe `wine_photos` server-side via the existing `ON DELETE CASCADE` and `lib/api/reset.ts`'s `wipeCellarData`, independent of this feature). AC7/AC9's orphan/replace handling is therefore scoped to discoveries (the only entity with a delete action today) — see Task 12.

---

### Task 1: Cookie-based auth helper for the stable photo endpoint

**What:** Add `requireApiUserFromCookie(request)` to `lib/api/auth.ts`, resolving the user from the Supabase session cookie (not a Bearer header) via a fresh, independent `supabase.auth.getUser()` call. This is the only auth path a plain `<img src>`/`<Image>` load can satisfy, since it never carries custom headers.

**Files:**
- Modify: `lib/api/auth.ts`
- Modify: `lib/api/__tests__/auth.test.ts` (create if it doesn't exist yet)

**Tests required before implementation:**
- `it('resolves the user from a valid session cookie')`
- `it('throws ApiAuthError when there is no session cookie')`
- `it('throws ApiAuthError when the cookie session is invalid/expired')`

**Acceptance criteria covered:** (enables AC1, AC2 — no route can authenticate without this)
**Dependencies:** none

- [ ] **Step 1:** Add `requireApiUserFromCookie` to `lib/api/auth.ts`, using `createClient` from `lib/supabase/server.ts` (cookie-backed) and `supabase.auth.getUser()` (network-validated, not `getSession()` — this route is outside `proxy.ts`'s matcher, so nothing else has already validated the cookie). Comment why this differs from `requireApiUser`: `/api/v1/photos/[...path]` is loaded by plain `<img>`/`<Image>` tags, which never carry an `Authorization` header.
- [ ] **Step 2:** Write the three tests above, mocking `lib/supabase/server.ts`'s `createClient` the same way existing `lib/api/__tests__/*.test.ts` mock `createAdminClient`.

---

### Task 2: Stable photo endpoint (`GET /api/v1/photos/[...path]`)

**What:** New catch-all route that streams photo bytes straight from Storage by their bare object path — no signing, no token, no expiry — so the same URL always serves the same bytes.

**Files:**
- Create: `app/api/v1/photos/[...path]/route.ts`

**Tests required before implementation:** none (route handler; see Global Constraints on this repo's test boundary) — manually verify via `/run` once Task 3 wires a real `<img>` to it.

**Acceptance criteria covered:** AC1, AC2
**Dependencies:** Task 1

- [ ] **Step 1:** `GET` handler: `requireApiUserFromCookie(request)` → resolve `familyId` via the `get_cellar_context` RPC (same call `resolveWineFamily`/`resolveDiscoveryFamily` already make) → join the `path` segments back into a single string → `isPhotoPathOwnedByFamily(path, familyId) || isDemoPhotoPath(path)` (else 403, no Storage call) → `admin.storage.from(BUCKET).download(path)` → return the Blob with `Content-Type` inferred from the path's extension (reverse-lookup against `ALLOWED_PHOTO_TYPES`) and `Cache-Control: private, max-age=31536000, immutable`. 404 if `download()` errors (object missing).

---

### Task 3: Point existing GET routes at the stable endpoint; retire signing

**What:** `GET /wines/[id]/photos` and `GET /discoveries/[id]/photo` return `/api/v1/photos/<path>` directly instead of calling `signPhotoPath`/`signPhotoPaths`. Remove the now-unused signing functions.

**Files:**
- Modify: `app/api/v1/wines/[id]/photos/route.ts` (GET only — POST is removed in Task 8)
- Modify: `app/api/v1/discoveries/[id]/photo/route.ts` (GET only — POST is removed in Task 8)
- Modify: `lib/storage/wine-photos.ts` (remove `signPhotoPath`, `signPhotoPaths`, `SIGNED_URL_TTL_SECONDS`)
- Modify: `lib/storage/__tests__/wine-photos.test.ts` (remove the now-deleted functions' tests; keep `isPhotoPathOwnedByFamily`/`isDemoPhotoPath`/`buildWinePhotoPath`/`buildDiscoveryPhotoPath` tests as-is)

**Tests required before implementation:**
- Delete `describe('signPhotoPath', ...)` and `describe('signPhotoPaths', ...)` blocks entirely (no replacement needed — the remaining helpers are unchanged, their existing tests keep passing unmodified)

**Acceptance criteria covered:** AC2
**Dependencies:** Task 2

- [ ] **Step 1:** Remove `signPhotoPath`, `signPhotoPaths`, `SIGNED_URL_TTL_SECONDS` from `lib/storage/wine-photos.ts`.
- [ ] **Step 2:** `GET /wines/[id]/photos`: drop the `signPhotoPaths` call; map rows directly to `{ id: row.id, url: '/api/v1/photos/' + row.path }`.
- [ ] **Step 3:** `GET /discoveries/[id]/photo`: drop the `signPhotoPath` call; return `{ url: photo ? '/api/v1/photos/' + photo.path : null }`.
- [ ] **Step 4:** Trim `lib/storage/__tests__/wine-photos.test.ts` as above.

---

### Task 4: Service Worker CacheFirst rule + drop Next.js image remote pattern

**What:** Add an immutable `CacheFirst` runtime-caching rule for `/api/v1/photos/*` to `sw.ts`, and remove the now-unneeded `*.supabase.co` `remotePatterns` entry from `next.config.ts` (photos are same-origin now).

**Files:**
- Modify: `sw.ts`
- Modify: `next.config.ts`

**Tests required before implementation:** none (Service Worker / config; no unit test harness for this in the repo) — manually verify offline behavior via `/run` (DevTools → Application → Service Workers → Offline).

**Acceptance criteria covered:** AC1
**Dependencies:** Task 2

- [ ] **Step 1:** In `sw.ts`, import `CacheFirst`, `ExpirationPlugin`, `CacheableResponsePlugin` from `serwist` and add to `runtimeCaching`:
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
- [ ] **Step 2:** Remove the `images.remotePatterns` entry for `*.supabase.co` from `next.config.ts` (and its explanatory comment, now stale).

---

### Task 5: `unoptimized` photo rendering + delete/logout cache cleanup

**What:** Mark the three `<Image>` usages that render wine/discovery photos as `unoptimized` (keeps the SW cache key 1:1 with the storage path, no `/_next/image?w=...` variants), and clear the matching Cache Storage entry on photo delete and on logout.

**Files:**
- Modify: `app/app/wine-photo-gallery.tsx`
- Modify: `components/cellar/wine-card.tsx`
- Modify: `components/cellar/discovery-card.tsx`
- Modify: wherever the sign-out action lives (grep `auth.signOut` under `app/`)

**Tests required before implementation:** none (DOM/browser-API-dependent; no existing test harness mocks Cache Storage in this repo) — manually verify via `/run`.

**Acceptance criteria covered:** AC3, AC8
**Dependencies:** Task 4

- [ ] **Step 1:** Add `unoptimized` to the three `<Image>` elements rendering a wine/discovery photo.
- [ ] **Step 2:** In `wine-photo-gallery.tsx`'s `handleDelete`, after the successful `apiMutate('DELETE', ...)`, also run `await caches.open('photo-cache').then(c => c.delete(photoUrl))` (best-effort — wrap in try/catch, never block the UI on it).
- [ ] **Step 3:** Same cleanup in `discovery-card.tsx`'s delete flow, once it exists (Task 12 adds discovery photo deletion as part of the discovery delete — add the `caches.delete` call there).
- [ ] **Step 4:** In the sign-out action, add `await caches.delete('photo-cache').catch(() => {})` before/alongside `supabase.auth.signOut()`.

---

### Task 6: PowerSync schema additions (`wine_photos`, `discovery_photos`)

**What:** Add the two metadata-only tables to the local PowerSync schema so they sync like every other table (`wines`, `discoveries`, etc.) — no binary column, ever.

**Files:**
- Modify: `lib/powersync/schema.ts`

**Tests required before implementation:** none (declarative schema; `Database` type is consumed, not independently tested elsewhere in this repo).

**Acceptance criteria covered:** AC6 (enables local sync of the metadata row)
**Dependencies:** none (parallel with Tasks 1–5)

- [ ] **Step 1:** Add to `lib/powersync/schema.ts`:
  ```ts
  const wine_photos = new Table(
    { wine_id: column.text, path: column.text, sort_order: column.integer, created_at: column.text },
    { indexes: { wine: ['wine_id'] } }
  )

  const discovery_photos = new Table(
    { discovery_id: column.text, path: column.text, created_at: column.text },
    { indexes: { discovery: ['discovery_id'] } }
  )
  ```
  Add both to the `AppSchema` constructor call.
- [ ] **Step 2:** Update the file's top comment (currently "Mirrors the 8 streams...") to say 10, and note that `wine_photos`/`discovery_photos` carry no binary data — only `path`, same as `skus.photo_path` already does.
- [ ] **Step 3 (manual, outside this repo):** Add matching streams to the self-hosted PowerSync `sync-config.yaml` — flag this to the user, it cannot be done from this checkout (see Global Constraints).

---

### Task 7: Generic metadata CRUD routes for `wine_photos` / `discovery_photos`

**What:** The two new routes the `ApiBackendConnector` targets (`PUT/DELETE /api/v1/wine_photos/[id]`, `PUT/DELETE /api/v1/discovery_photos/[id]`) when a local insert/delete on these newly-synced tables drains through the upload queue — same insert-only-PUT pattern as `app/api/v1/discoveries/[id]/route.ts`.

**Files:**
- Create: `app/api/v1/wine_photos/[id]/route.ts`
- Create: `app/api/v1/discovery_photos/[id]/route.ts`

**Tests required before implementation:** none (route handler; see Global Constraints) — manually verify via `/run` once Task 11/12 produce a real local insert to drain.

**Acceptance criteria covered:** AC6
**Dependencies:** Task 6

- [ ] **Step 1:** `app/api/v1/wine_photos/[id]/route.ts`:
  - `PUT`: `requireApiUser` → parse `{ wine_id, path, sort_order, created_at }` from body → `resolveWineFamily(admin, user.id, wine_id)` → **validate** `isPhotoPathOwnedByFamily(path, familyId)` (400 if not — a family member could otherwise smuggle an arbitrary `path` into the row, same concern the existing `wine-photos.ts` comment already flags) → `admin.from('wine_photos').insert({ id, wine_id, path, sort_order, created_at })`, 23505 = already synced, not an error → 204.
  - `DELETE`: load the row by `id` to get `wine_id` → `resolveWineFamily` → delete → 204 (idempotent: missing row is also 204, mirrors `discoveries`' DELETE).
- [ ] **Step 2:** `app/api/v1/discovery_photos/[id]/route.ts` — identical shape via `resolveDiscoveryFamily`.

---

### Task 8: Slim the existing photo routes to bytes-only

**What:** The binary upload/delete endpoints stop touching the DB row (that's now Task 7's job) and only move Storage bytes — insert-only `PUT` instead of the old combined `POST`.

**Files:**
- Modify: `app/api/v1/wines/[id]/photos/route.ts` (remove `POST`)
- Modify: `app/api/v1/wines/[id]/photos/[photoId]/route.ts` (add `PUT`; `DELETE` drops its `wine_photos` row-delete, storage-object removal only)
- Modify: `app/api/v1/discoveries/[id]/photo/route.ts` (remove `POST`)
- Create: `app/api/v1/discoveries/[id]/photo/[photoId]/route.ts` (`PUT` bytes, `DELETE` storage-object-only — mirrors the wines shape)

**Tests required before implementation:** none (route handler; see Global Constraints).

**Acceptance criteria covered:** AC4, AC5, AC9
**Dependencies:** Task 7

- [ ] **Step 1:** `PUT /api/v1/wines/[id]/photos/[photoId]`: `requireApiUser` → `resolveWineFamily` → read the raw body (`ArrayBuffer`) + `Content-Type` header → validate against `ALLOWED_PHOTO_TYPES`/`MAX_PHOTO_BYTES` → build the expected path with `buildWinePhotoPath(familyId, wineId, photoId, ext)` → `admin.storage.from(BUCKET).upload(path, body, { contentType, cacheControl: '31536000', upsert: true })` (`upsert: true` — a retried upload after a dropped connection must succeed, not 409) → 204.
- [ ] **Step 2:** `DELETE /api/v1/wines/[id]/photos/[photoId]`: keep the existing ownership-checked `storage.remove()` call, delete the trailing `admin.from('wine_photos').delete()` line (now redundant with Task 7's route and would otherwise race it).
- [ ] **Step 3:** Remove `app/api/v1/wines/[id]/photos/route.ts`'s `POST` handler entirely (keep `GET`, already updated in Task 3).
- [ ] **Step 4:** Mirror Steps 1–3 for discoveries: new `app/api/v1/discoveries/[id]/photo/[photoId]/route.ts` with `PUT` (bytes, via `resolveDiscoveryFamily` + `buildDiscoveryPhotoPath`) and `DELETE` (storage-object-only); remove `POST` from `app/api/v1/discoveries/[id]/photo/route.ts`.

---

### Task 9: Raw-bytes upload helper in the API client

**What:** `apiUpload`/`apiMutate` don't support a PUT carrying raw bytes with a specific `Content-Type` — add one small function the `AttachmentQueue`'s remote adapter (Task 10) will call.

**Files:**
- Modify: `lib/spa/api-client.ts`

**Tests required before implementation:** none (thin fetch wrapper, same as the existing untested `apiGet`/`apiMutate`/`apiUpload` in this file).

**Acceptance criteria covered:** (enables AC4, AC5)
**Dependencies:** none (parallel with Tasks 1–8)

- [ ] **Step 1:** Add `apiPutBytes(path: string, data: ArrayBuffer, contentType: string): Promise<void>` — same `authHeaders()`/`ApiError` handling as `apiMutate`, but `method: 'PUT'`, `headers: { ...authHeaders(), 'Content-Type': contentType }`, `body: data`, no JSON parsing of the (empty, 204) response.

---

### Task 10: `AttachmentQueue` wiring

**What:** Two `AttachmentQueue` instances (wine photos, discovery photos), each with an `IndexDBFileSystemAdapter` for local storage and a small custom `remoteStorage` adapter that calls Task 8/9's endpoints; started alongside the existing PowerSync `db.connect(...)`.

**Files:**
- Create: `lib/powersync/attachment-queues.ts`
- Modify: `lib/powersync/PowerSyncProvider.tsx` (export the `db` getter; start both queues)

**Tests required before implementation:** none (thin glue over an external library's documented interface; no mocking harness for `AttachmentQueue`/`IndexDBFileSystemAdapter` exists in this repo).

**Acceptance criteria covered:** AC4, AC5, AC6
**Dependencies:** Task 6, Task 7, Task 8, Task 9

- [ ] **Step 1:** In `lib/powersync/attachment-queues.ts`, define `createWineAttachmentQueue(db: PowerSyncDatabase)` and `createDiscoveryAttachmentQueue(db: PowerSyncDatabase)`, each returning an `AttachmentQueue` configured with:
  - `localStorage: new IndexDBFileSystemAdapter()`
  - `remoteStorage`: `{ uploadFile: (fileData, attachment) => apiPutBytes(`/wines/${JSON.parse(attachment.metaData!).wineId}/photos/${attachment.id}`, fileData, attachment.mediaType!), deleteFile: (attachment) => apiMutate('DELETE', ...same path...), downloadFile: () => { throw new Error('not used — downloadAttachments is false') } }` (discovery variant uses the discovery photo path shape).
  - `watchAttachments`: wraps a PowerSync watched query (`db.watch('SELECT id, wine_id, path FROM wine_photos', [], { ... })` per this SDK's documented watch API) mapping each row to `{ id, fileExtension: row.path.split('.').pop(), metaData: JSON.stringify({ wineId: row.wine_id }) }`.
  - `downloadAttachments: false`.
- [ ] **Step 2:** In `PowerSyncProvider.tsx`, export `getDB` (currently private), and inside it — right after `db.connect(new ApiBackendConnector())` — construct both queues via Step 1's factories and call `.startSync()` on each; store them on the module (e.g. exported `getWineAttachmentQueue()`/`getDiscoveryAttachmentQueue()` accessors) so Task 11/12's UI code can reach them.

---

### Task 11: Wine photo gallery — offline capture + pending state

**What:** `wine-photo-gallery.tsx`'s camera button switches from an immediate `apiUpload` POST to `AttachmentQueue.saveFile(...)`, with a local `updateHook` inserting the `wine_photos` row; the gallery reads from the local synced table (reactive) instead of `GET /wines/[id]/photos`, showing a pending badge until the attachment is `synced`.

**Files:**
- Modify: `app/app/wine-photo-gallery.tsx`
- Modify: `lib/powersync/queries.ts` (add `useWinePhotos(wineId)`)

**Tests required before implementation:** none (component relies on live PowerSync/AttachmentQueue state; no existing component tests mock PowerSync in this repo) — manually verify via `/run`, including airplane-mode capture + reconnect.

**Acceptance criteria covered:** AC4, AC5
**Dependencies:** Task 10

- [ ] **Step 1:** Add `useWinePhotos(wineId)` to `lib/powersync/queries.ts` — a `useQuery` (from `@powersync/react`) over `SELECT id, path, sort_order FROM wine_photos WHERE wine_id = ? ORDER BY sort_order`, joined (in JS, after the query resolves) with each attachment's current state so the caller can render a pending badge — expose `{ photos: { id, url, pending }[] }`.
- [ ] **Step 2:** Rewrite `handleFileChange` in `wine-photo-gallery.tsx`: `compressImage(file)` → resolve `familyId` locally (small `db.get` joining `wines.cellar_id → cellars.family_id` for this `wineId`) → `id = await wineAttachmentQueue.generateAttachmentId()` → `ext = ALLOWED_PHOTO_TYPES[compressed.type]` → `path = buildWinePhotoPath(familyId, wineId, id, ext)` → `wineAttachmentQueue.saveFile({ id, data: await compressed.arrayBuffer(), fileExtension: ext, mediaType: compressed.type, metaData: JSON.stringify({ wineId }), updateHook: tx => tx.execute('INSERT INTO wine_photos (id, wine_id, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)', [id, wineId, path, nextSortOrder, new Date().toISOString()]) })`.
- [ ] **Step 3:** Swap the gallery's data source from `useQuery`/`apiGet` to `useWinePhotos(wineId)`; render a small spinner/badge overlay (same blurred-circle style as the delete button) on any photo whose `pending` is true.
- [ ] **Step 4:** Rewrite `handleDelete`: `wineAttachmentQueue.deleteFile({ id: photoId, updateHook: tx => tx.execute('DELETE FROM wine_photos WHERE id = ?', [photoId]) })`.

---

### Task 12: Discovery photo — offline capture, pending state, orphan + replace handling

**What:** Same rewrite as Task 11 but for the single-slot discovery photo, in `add-discovery-sheet.tsx` (upload) and `discovery-card.tsx` (display/delete) — plus the one genuinely new piece of app logic this feature needs: deleting a discovery must also delete its local `discovery_photos` row, so an unsynced queued photo for a just-deleted discovery is dropped instead of attempted.

**Files:**
- Modify: `app/app/add-discovery-sheet.tsx`
- Modify: `components/cellar/discovery-card.tsx`
- Modify: `lib/powersync/queries.ts` (add `useDiscoveryPhoto(discoveryId)`)

**Tests required before implementation:** none (same rationale as Task 11) — manually verify via `/run`, including: delete a discovery while its photo is still mid-upload (offline), and replace a discovery's photo twice before the first sync completes.

**Acceptance criteria covered:** AC6, AC7, AC9
**Dependencies:** Task 10

- [ ] **Step 1:** Add `useDiscoveryPhoto(discoveryId)` to `lib/powersync/queries.ts` — `SELECT id, path FROM discovery_photos WHERE discovery_id = ?` (at most one row), joined with attachment state, same shape as Task 11's hook.
- [ ] **Step 2:** In `add-discovery-sheet.tsx`'s photo upload, same `saveFile(...)` pattern as Task 11 Step 2, but the `updateHook` first deletes any existing local row for this discovery, then inserts the new one in the same transaction: `tx.execute('DELETE FROM discovery_photos WHERE discovery_id = ?', [discoveryId]); tx.execute('INSERT INTO discovery_photos (id, discovery_id, path, created_at) VALUES (?, ?, ?, ?)', [id, discoveryId, path, now])` — this is what makes AC9 work: the superseded row disappears locally immediately, so `AttachmentQueue`'s own orphan-detection archives the old, not-yet-synced attachment on its next tick instead of ever uploading it.
- [ ] **Step 3:** In `discovery-card.tsx`, swap the photo's `useQuery`/`apiGet(/discoveries/[id]/photo)` for `useDiscoveryPhoto(discovery.id)`; render the same pending badge as Task 11.
- [ ] **Step 4:** In `discovery-card.tsx`'s `handleDelete` (currently `db.execute('DELETE FROM discoveries WHERE id = ?', [discovery.id])`), add `db.execute('DELETE FROM discovery_photos WHERE discovery_id = ?', [discovery.id])` in the same call — this is what makes AC7 work: the local metadata row for any still-queued photo disappears immediately, even fully offline, without waiting for the server-side `ON DELETE CASCADE` to ever apply.
- [ ] **Step 5:** Add the `caches.open('photo-cache').then(c => c.delete(...))` cleanup from Task 5 Step 3 here, now that the discovery photo's stable URL is known from `useDiscoveryPhoto`.

---

## Parallel Execution

- Tasks 1, 6, and 9 have no dependencies on each other or on anything else — start all three in parallel.
- Task 2 needs Task 1. Task 3 needs Task 2. Task 4 needs Task 2. Task 5 needs Task 4.
- Task 7 needs Task 6. Task 8 needs Task 7.
- Task 10 needs Tasks 6, 7, 8, and 9 all done.
- Tasks 11 and 12 can run in parallel once Task 10 is done (independent files, independent entities).

A reasonable wave order: **Wave 1** — Tasks 1, 6, 9 (parallel). **Wave 2** — Tasks 2, 7 (parallel, each depends only on a Wave 1 task). **Wave 3** — Tasks 3, 4, 8 (parallel). **Wave 4** — Task 5. **Wave 5** — Task 10. **Wave 6** — Tasks 11, 12 (parallel).

## Commit Plan

- `feat(api): add cookie-authenticated photo endpoint` (Tasks 1, 2)
- `refactor(photos): serve stable URLs instead of signed ones` (Task 3)
- `feat(pwa): cache photos forever by stable path` (Tasks 4, 5)
- `feat(powersync): sync wine/discovery photo metadata` (Tasks 6, 7)
- `refactor(api): split photo upload into metadata + bytes` (Task 8)
- `feat(photos): wire up offline upload queue` (Tasks 9, 10)
- `feat(wines): queue photo uploads offline, show pending state` (Task 11)
- `feat(discoveries): queue photo uploads offline, handle replace/orphan` (Task 12)

## Plan Size Check

- [x] Single feature (one deployable unit — ships together, no partial-rollout flag per spec's Out of Scope)
- [x] No task touches more than 5 files (Task 5 is the largest at 4)
- [x] Every task is describable in 2 sentences (see each **What**)
- [x] Manual follow-up outside this repo (sync-config.yaml streams, Task 6 Step 3) called out explicitly, not silently assumed
