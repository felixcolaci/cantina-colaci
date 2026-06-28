# Nachkaufen / SKU — Spec

**Datum:** 2026-06-28  
**Status:** Approved

## Ziel

Flaschen eines bestehenden Weins nachkaufen und sauber als eigenen Posten (SKU) mit Jahrgang + Kaufdetails protokollieren. Gleichzeitig: Tabelle `cellar_entries` → `skus` umbenennen und `vintage` von `wines` auf `skus` verschieben, damit ein Wein mehrere Jahrgänge abbilden kann.

## Terminologie

| Technisch | UI-Text |
|-----------|---------|
| `sku` / `Sku` | Posten |
| `skus` (Tabelle) | — |
| `addSku` | Posten hinzufügen |
| `updateSku` | Posten bearbeiten |

---

## DB-Migration

Eine Migration, vier Schritte:

```sql
-- 1. Tabelle umbenennen
ALTER TABLE cellar_entries RENAME TO skus;

-- 2. vintage-Spalte hinzufügen
ALTER TABLE skus ADD COLUMN vintage INTEGER;

-- 3. Bestehende Daten migrieren
UPDATE skus
SET vintage = wines.vintage
FROM wines
WHERE skus.wine_id = wines.id;

-- 4. vintage aus wines entfernen
ALTER TABLE wines DROP COLUMN vintage;
```

---

## TypeScript-Typen (`lib/types.ts`)

- `CellarEntry` → umbenennen zu `Sku`
- `Sku` bekommt: `vintage: number | null`
- `Wine.vintage` entfernen (fällt durch Migration weg)

---

## Code-Rename

| Alt | Neu |
|-----|-----|
| `lib/actions/entries.ts` | `lib/actions/skus.ts` |
| `updateEntry` | `updateSku` |
| `clearEntryPhoto` | `clearSkuPhoto` |
| `app/wine/[id]/entry-card.tsx` | `app/wine/[id]/sku-card.tsx` |
| `EntryCard` | `SkuCard` |
| `EntryWithLocation` | `SkuWithLocation` |

Alle Importpfade und Variablennamen (`entries`, `entryIds`, etc.) werden entsprechend aktualisiert.

---

## SkuCard (bisher EntryCard)

Neues Feld: `vintage` wird als Eyebrow über der Anzahl angezeigt.

```
┌────────────────────────────────┐
│  2019                     ✏   │
│  5 Flaschen                    │
│  Keller A · Reihe 3            │
│  Mai 2024 · 18,50 € · Vinothek │
└────────────────────────────────┘
```

**Jahrgang-Zeile:** `var(--font-display)`, `var(--text-lg)`, weight 600, `color: var(--muted-foreground)`. Nur angezeigt wenn `sku.vintage !== null`.

**`SkuWithLocation`-Typ** (erweitert um `vintage`):
```ts
type SkuWithLocation = {
  id: string
  wine_id: string
  vintage: number | null
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  storage_location_id: string | null
  storage_locations: { name: string; type: string } | null
}
```

Das Edit-Sheet innerhalb `SkuCard` bekommt ebenfalls ein `Jahrgang`-Feld (`DatePicker mode="year"`, optional).

---

## Neue Komponente: `app/wine/[id]/add-sku-sheet.tsx`

Client-Komponente. `+ Posten`-Button auf der Wein-Detailseite öffnet Sheet von unten.

**Felder:**
| Feld | Komponente | Pflicht |
|------|-----------|---------|
| Jahrgang | `DatePicker mode="year"` | nein |
| Anzahl Flaschen | `Input type="number" min="1"` | ja |
| Preis (€) | `Input type="number" step="0.01"` | nein |
| Kaufdatum | `DatePicker mode="full"` | nein |
| Kaufort | `Input` | nein |
| Lagerort | `Select` (aus `storageLocations`) | nein |

**Props:**
```ts
type AddSkuSheetProps = {
  wineId: string
  storageLocations: { id: string; name: string }[]
}
```

Submit via `useServerAction(addSku)`. Nach Erfolg: `redirect(`/wine/${wineId}`)` (in der Action).

---

## Neue Action: `addSku` in `lib/actions/skus.ts`

```ts
// Fügt nach Autorisierungscheck ein:
await admin.from('skus').insert({
  wine_id: wineId,
  cellar_id: cellar.id,
  vintage: vintage ? parseInt(vintage) : null,
  quantity: parseInt(quantity),
  status: 'in_stock',
  purchase_price: purchase_price ? parseFloat(purchase_price) : null,
  purchase_date: purchase_date || null,
  purchase_location: purchase_location || null,
  storage_location_id: storage_location_id || null,
})
```

Redirect: `redirect(`/wine/${wineId}`)`

---

## Wein-Detailseite (`app/wine/[id]/page.tsx`)

- Query: `cellar_entries` → `skus`
- Variablen: `entries` → `skus`, `entryIds` → `skuIds`
- `<EntryCard>` → `<SkuCard>`
- `<AddSkuSheet wineId={wine.id} storageLocations={storageLocations} />` + `+ Posten`-Button neben "Flasche öffnen"

---

## Kellerseite (`app/cellar/page.tsx`) + WineCard

**Query-Erweiterung:**
```ts
.select('*, skus(id, vintage, quantity, photo_url, status, storage_location_id)')
```

**`latestVintage`-Berechnung** (in der Page, vor WineCard-Render):
```ts
const latestVintage = (wine.skus as any[])
  .filter(s => s.status === 'in_stock' && s.vintage != null)
  .sort((a, b) => (b.vintage ?? 0) - (a.vintage ?? 0))[0]?.vintage ?? null
```

**WineCard-Props** (erweitert):
```ts
interface WineCardProps {
  wine: Wine                                                    // ohne vintage
  skus: Pick<Sku, 'quantity' | 'photo_url' | 'status'>[]
  vintage: number | null                                        // berechnet von Page
}
```

WineCard zeigt `vintage`-Prop wie bisher — nur die Herkunft ändert sich.

---

## Was sich nicht ändert

- `openBottle`-Action: referenziert `cellar_entry_id` als Formularfeld-Name — bleibt identisch (nur DB-Tabellenname ändert sich in der Query)
- Alle anderen Server Actions: werden lediglich umgestellt auf `skus` statt `cellar_entries` in den Supabase-Queries
- `WineCard`-Layout: unverändert, nur Props-Herkunft ändert sich
- `demo.ts`: wird ebenfalls auf `skus` umgestellt
