# Trips Redesign v1 — Spec

**Datum:** 2026-06-28  
**Status:** Approved

## Ziel

Die Trips-Seite wird vom generischen shadcn-Card-Layout auf das App-eigene Designsystem gebracht und bekommt eine Detailseite pro Reise mit verknüpften Weinen und Statistiken.

## Out of Scope (Trips v2)

- Karte mit Weingütern (Geocoding, Map-Library, DB-Koordinaten) — separater Spec

---

## Seite 1: `/trips` — Reiseliste

### Layout

Vertikale Liste, `max-w-lg mx-auto px-4 py-6`:

1. Header-Zeile: Cormorant `var(--text-3xl)` h1 "Reisen" links, `+`-Button rechts (öffnet New-Trip-Sheet)
2. Liste von `TripCard`-Komponenten, sortiert nach `created_at desc`
3. Leerer Zustand: Location-Pin-SVG (gleicher Stil wie Bottom-Nav Trips-Icon) + Text "Noch keine Reisen — Andiamo!" + kein CTA (Trips werden über den `+`-Button erstellt)

### Komponente: `components/trips/trip-card.tsx` (neu)

Link-Wrapper `<Link href="/trips/{id}">` mit folgender Karten-Struktur (identisch zu WineCard-Muster):

```
┌─────────────────────────────────────┐
│  Info-Block (flex-1)   │  Zahl-Block │
│  ort (eyebrow)         │     5       │
│  Reisename (Display)   │   Weine     │
│  12.05. → 18.05.2024   │             │
└─────────────────────────────────────┘
```

**Info-Block (links):**
- Ort: `eyebrow`-Klasse, `truncate` — nur wenn vorhanden
- Reisename: `var(--font-display)`, `var(--text-xl)`, weight 600, `letter-spacing: -0.01em`, `color: var(--foreground)`
- Datum-Range: `var(--font-mono)`, `var(--text-xs)`, `color: var(--muted-foreground)` — formatiert als `dd.mm.yyyy → dd.mm.yyyy`. Nur `start` wenn kein `end`. Weggelassen wenn kein Datum.

**Zahl-Block (rechts):**
- Zahl: `var(--font-display)`, `var(--text-2xl)`, weight 700, `color: var(--foreground)`
- Label: `eyebrow`-Klasse, Text `"Weine"` (unabhängig von Anzahl)
- `color: var(--muted-foreground)` wenn count 0

**Karten-Container:**
- `background: var(--card)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`
- Padding: `var(--space-4)`
- Hover: `wine-card-hover`-Klasse (bestehend)

**Props:**
```ts
type TripCardProps = {
  trip: {
    id: string
    name: string
    location: string | null
    date_start: string | null  // ISO date
    date_end: string | null    // ISO date
  }
  wineCount: number
}
```

### Komponente: `app/trips/new-trip-sheet.tsx` (ersetzt `new-trip-form.tsx`)

Client-Komponente. Button `+` in der Header-Zeile öffnet `SheetContent side="bottom"`.

Felder (identisch zum bestehenden Formular):
- Name (required, `Input`)
- Ort (optional, `Input`)
- Datum Start (optional, `DatePicker mode="full"`)
- Datum Ende (optional, `DatePicker mode="full"`)

Submit via `useServerAction(createTrip)`. Bei Erfolg: Sheet schließt, Seite revalidiert (bereits in `createTrip` via `revalidatePath('/trips')`).

---

## Seite 2: `/trips/[id]` — Trip-Detail

Neue Seite: `app/trips/[id]/page.tsx` (Server Component)

### Datenabruf

Zwei parallele Queries, dann Tastings sequenziell (braucht Entry-IDs aus Schritt 1):

```ts
// Schritt 1: parallel
const [tripResult, winesResult] = await Promise.all([
  admin.from('trips').select('*').eq('id', id).eq('cellar_id', cellar.id).maybeSingle(),
  admin.from('wines')
    .select('*, cellar_entries(id, quantity, photo_url, status, storage_location_id, purchase_price)')
    .eq('trip_id', id)
    .eq('cellar_id', cellar.id)
    .order('name'),
])

// Schritt 2: sequenziell — braucht Entry-IDs
const entryIds = (winesResult.data ?? [])
  .flatMap(w => (w.cellar_entries as any[]).map(e => e.id))

const { data: tastings } = entryIds.length
  ? await admin.from('tastings').select('rating').in('cellar_entry_id', entryIds)
  : { data: [] as { rating: number }[] }
```

### Stats-Berechnung

```ts
const wines = winesResult.data ?? []
const inStockEntries = wines.flatMap(w =>
  (w.cellar_entries as any[]).filter(e => e.status === 'in_stock')
)
const totalBottles = inStockEntries.reduce((s, e) => s + e.quantity, 0)

const ratings = (tastings ?? []).map(t => t.rating).filter(Boolean)
const avgRating = ratings.length
  ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
  : null

const allEntries = wines.flatMap(w => w.cellar_entries as any[])
const prices = allEntries.map(e => e.purchase_price).filter((p): p is number => p != null)
const totalSpend = prices.length ? prices.reduce((s, p) => s + p, 0) : null
```

### Layout

```
← Reisen                          ← Link zurück

[ort eyebrow]                     ← wenn vorhanden
Reisename                         ← Cormorant var(--text-3xl) weight 600
12.05. → 18.05.2024               ← Mono xs muted

┌──────┐ ┌──────┐ ┌──────┐       ← grid-cols-3, StatsCard
│  12  │ │ 8.4  │ │ 340€ │
│Flasch│ │Ø Note│ │Ausgab│
└──────┘ └──────┘ └──────┘

WEINE (5)                         ← eyebrow

[WineCard]
[WineCard]
...

Leerer Zustand: "Noch keine Weine auf dieser Reise."
```

**Stats-Details:**
- Flaschen: immer angezeigt (kann 0 sein)
- Ø Bewertung: zeigt `—` wenn keine Tastings vorhanden
- Ausgaben: **nur angezeigt wenn `totalSpend !== null`** (mind. 1 Preis eingetragen)

**Wein-Liste:**
- Bestehende `WineCard`-Komponente aus `components/cellar/wine-card.tsx`
- Entries werden gefiltert: nur `status === 'in_stock' && quantity > 0` — gleiche Logik wie Kellerseite
- Weine ohne in-stock Entries werden trotzdem angezeigt (Entries-Array leer → WineCard zeigt 0 Flaschen)

### Autorisierung

Trip muss zum Keller der eingeloggten Familie gehören: `.eq('cellar_id', cellar.id)`. Wenn nicht gefunden: `notFound()`.

---

## Was sich nicht ändert

- `lib/actions/trips.ts` — `createTrip` bleibt unverändert
- `WineCard`-Komponente — unverändert, direkt wiederverwendet
- `StatsCard`-Komponente — unverändert, direkt wiederverwendet
- Bottom-Nav Trips-Link bleibt `/trips`
- DB-Schema unverändert
