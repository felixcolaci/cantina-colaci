# Wine Form Autocomplete — Design Spec

**Datum:** 2026-06-22  
**Status:** Approved

## Ziel

Das Weinerfassungsformular erhält Autocomplete-Funktion für die wichtigsten Felder. Land und Region sind abhängig verknüpft: Wählt man ein Land, werden nur die passenden Regionen vorgeschlagen. Vorschläge kommen aus einer statischen Weinwelt-Datenbank (Länder, Regionen, Rebsorten) kombiniert mit den eigenen Kellereinträgen.

---

## Datenquellen

### Statische Daten (`lib/wine-data.ts`)

- `WINE_COUNTRIES: string[]` — wichtigste Weinländer (Italien, Frankreich, Deutschland, Spanien, Portugal, Österreich, USA, Argentinien, Chile, …)
- `WINE_REGIONS: Record<string, string[]>` — Regionen pro Land, z.B. `{ "Italien": ["Toskana", "Piemont", "Venetien", "Sizilien", …] }`
- `GRAPE_VARIETIES: string[]` — bekannte Rebsorten (Sangiovese, Nebbiolo, Riesling, Cabernet Sauvignon, …)

### Eigene Kellerdaten (Server → Props)

`app/wine/new/page.tsx` lädt beim Render per `SELECT DISTINCT` aus Supabase:

```ts
interface WineHints {
  names: string[]
  producers: string[]
  grapeVarieties: string[]
  purchaseLocations: string[]
  ownRegions: string[]
  ownCountries: string[]
}
```

Kein Client-Side-Fetch — alles wird als Server Component geladen und als Props übergeben.

---

## Neue Komponenten

### `components/ui/combobox.tsx`

Generisches, wiederverwendbares Combobox-Component auf Basis von shadcn `Popover` + `Command`.

```ts
interface ComboboxProps {
  name: string           // für FormData (hidden input)
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}
```

- Filtert options case-insensitiv beim Tippen (cmdk built-in)
- Schreibt Wert in `<input type="hidden" name={name}>` für Server Action
- Erlaubt freie Eingabe (kein Zwang zur Listenauswahl)

**Neue shadcn-Packages nötig:** `popover`, `command` — werden per `npx shadcn add popover command` installiert.

---

## Geänderte Dateien

### `app/wine/new/page.tsx`

Lädt zusätzlich zu `trips` auch `WineHints` aus Supabase und übergibt sie an `WineForm`.

### `app/wine/new/wine-form.tsx`

- Hält `country`-State (steuert Region-Optionen)
- Hält States für alle Combobox-Werte (name, producer, country, region, grape_variety, purchase_location)
- Felder mit Autocomplete:

| Feld | Datenquelle |
|---|---|
| Name | `hints.names` |
| Weingut | `hints.producers` |
| Land | `WINE_COUNTRIES` + `hints.ownCountries` |
| Region | `WINE_REGIONS[country]` + `hints.ownRegions` (gefiltert nach Land) |
| Rebsorte | `GRAPE_VARIETIES` + `hints.grapeVarieties` |
| Kaufort | `hints.purchaseLocations` |

---

## Land → Region Abhängigkeit

```
country State ändert sich
  → regionOptions = dedupe([...WINE_REGIONS[country] ?? [], ...hints.ownRegions])
  → Region-Combobox bekommt neue options
  → Region-Wert wird auf "" zurückgesetzt
```

- Statische Regionen zuerst, eigene Einträge dedupliziert angehängt
- Felder bleiben frei editierbar (kein Zwang zur Listenauswahl)
- Eigene Regionen ohne bekanntes Land werden immer angeboten

---

## Server Action

`lib/actions/wine.ts` — **keine Änderungen nötig.** Die Combobox schreibt Werte in hidden inputs, FormData verhält sich identisch wie bisher.

---

## Was nicht geändert wird

- Typ-Auswahl (bleibt Select)
- Jahrgang, Menge, Preis, Datum, Regalposition (bleiben Input)
- Reise-Auswahl (bleibt Select)
- Notizen (bleibt Textarea)
