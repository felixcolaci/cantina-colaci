# CSV/Excel-Import für Weine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec Reference:** [`docs/superpowers/specs/2026-10-24-csv-excel-import-design.md`](../specs/2026-10-24-csv-excel-import-design.md) — Approved

**Goal:** Ein Wizard (Datei hochladen → Spalten zuordnen → Vorschau mit Zeilen-Validierung → Bestätigen), mit dem mehrere Weine auf einmal aus einer CSV- oder Excel-Datei importiert werden. Jede bestätigte Zeile erzeugt lokal einen `wines`- und einen `skus`-Datensatz — oder, falls Name+Produzent zu einem bereits im Keller vorhandenen Wein passen, nur einen neuen `skus`-Datensatz an diesem Wein. Komplett clientseitig, kein neuer Server-Endpunkt — der bestehende lokale PowerSync-Schreibpfad (`db.writeTransaction`, wie in `QuickAddSheet`) wird einfach pro Zeile wiederverwendet.

**Architecture:** Vier Tasks, strikt sequenziell aufeinander aufbauend: (1) Datei-Parsing (neue Abhängigkeit `xlsx`) + Spalten-Heuristik, (2) Zeilen-Validierung (Typ-Synonyme, Datumsformate, Zahlenchecks), (3) Matching + lokaler Schreibpfad, (4) UI-Wizard + Einstiegspunkt. Jeder Task lässt Build + Tests grün zurück. Die reine Logik (Tasks 1–3) ist vollständig unit-getestet, bevor die UI (Task 4) sie verdrahtet.

**Tech Stack:** Next.js (App Router), React, TypeScript, `exceljs` (neu, für `.xlsx`) + ein selbst geschriebener CSV-Parser (kein Paket), PowerSync (local-first SQLite, kein neuer Server-Code), Base UI (`@base-ui/react` via `components/ui/*`), Vitest.

**Abweichung von der ursprünglichen Spec-Entscheidung (während Task 1 entschieden):** Die Spec sah ursprünglich `xlsx` (SheetJS) als einzige Abhängigkeit für beide Formate vor. `npm install xlsx` installiert aber nur die npm-Registry-Version 0.18.5, die zwei ungepatchte High-Severity-CVEs hat (Prototype Pollution, ReDoS — `npm audit` meldet `fixAvailable: false`, da SheetJS gepatchte Versionen seit einem Streit mit npm nur noch über ein eigenes CDN verteilt). Für eine Funktion, die gezielt Dateien parst, die Nutzer selbst hochladen, war das nicht vertretbar. Ersetzt durch `exceljs` (aktiv gepflegt, nur ein moderates, praktisch unerreichbares transitives Advisory über `uuid`) für `.xlsx`, plus einen ~40-zeiligen eigenen RFC4180-CSV-Parser für `.csv`. Dadurch entfällt Unterstützung für Legacy-`.xls` (exceljs kann das Binärformat nicht lesen) — akzeptiert, da modernes Excel immer `.xlsx` exportiert. Spec und Task 1 unten sind bereits auf diesen Stand aktualisiert.

## Spec Coverage

```
AC1 (Mapping-Schritt zeigt alle erkannten Spalten)                    → Task 1, 4 ✓
AC2 ("Winzer"/"Produzent" → automatisch auf producer vorbelegt)       → Task 1, 4 ✓
AC3 (Pflichtfelder zugeordnet → Vorschau erscheint)                    → Task 4 ✓
AC4 (leerer name → Zeile fehlerhaft, Checkbox aus, nicht gezählt)      → Task 2, 4 ✓
AC5 (Inline-Korrektur → Fehlermarkierung verschwindet)                 → Task 2, 4 ✓
AC6 (Name+Produzent-Match → kein neuer wines-, nur neuer skus-Datensatz) → Task 3 ✓
AC7 (region/country/grape_variety/notes bleiben nach Sync erhalten)    → Task 3 ✓
AC8 (10 fehlerfreie Zeilen → korrekter Import + Erfolgsmeldung)        → Task 3, 4 ✓
AC9 (CSV und XLSX liefern identisches Ergebnis)                        → Task 1 ✓
Edge Case: Datei ohne Kopfzeile / leere erste Zeile                    → Task 1 ✓
Edge Case: Datei komplett leer (0 Datenzeilen)                         → Task 1, 4 ✓
Edge Case: unbekannter Typ-Wert                                        → Task 2 ✓
Edge Case: Excel-Datum als Date-Objekt oder serielle Zahl              → Task 2 ✓
Edge Case: zwei Zeilen matchen denselben bestehenden Wein              → Task 3 ✓
Edge Case: zwei neue Zeilen mit identischem name+producer matchen sich gegenseitig → Task 3 ✓
Edge Case: Datei mit ~500 Zeilen (keine Performance-Sonderbehandlung)  → kein eigener Task, siehe Global Constraints
Edge Case: Wizard abgebrochen vor Bestätigen (keine Schreibvorgänge)   → Task 4 (kein zusätzlicher Code nötig, reiner State-Reset)
Edge Case: Tab während laufendem Import geschlossen                   → kein eigener Task, siehe Global Constraints
```

Spec coverage verified: all 9 acceptance criteria and all edge cases are covered.

## Global Constraints

- Alle visuellen Tokens über `var(--...)` — keine hartkodierten Hex-Werte oder Tailwind-Farbklassen (siehe `app/app/quick-add-sheet.tsx`/`app/app/add-discovery-sheet.tsx` als Referenz).
- Schreibpfad geht **ausschließlich** über lokale PowerSync-Inserts/-Updates (`db.writeTransaction`/`tx.execute`), nie über einen direkten `apiMutate`-Call — der Upload-Connector drained automatisch zu `PUT /api/v1/wines/[id]` bzw. `PUT /api/v1/skus/[id]` (siehe `lib/powersync/connector.ts`). Kein neuer Server-Code in diesem Plan.
- Datei-Parsing passiert komplett im Browser (`File.arrayBuffer()`); die Rohdatei verlässt das Gerät nie.
- **Bewusst keine Performance-Sonderbehandlung für große Dateien** (Edge Case "~500 Zeilen" aus der Spec): keine Virtualisierung der Vorschau-Tabelle, keine Chunk-Verarbeitung. Der erwartete Regelfall (einige Dutzend bis wenige hundert Zeilen) ist für eine einfache gerenderte Tabelle und sequenzielle `writeTransaction`-Aufrufe unproblematisch.
- **Bewusst kein Resume/Rollback bei Tab-Schließen während des Imports** (Edge Case): bereits geschriebene Zeilen bleiben als normale lokale PowerSync-Zeilen bestehen (werden ganz normal hochgeladen), nicht erreichte Zeilen gehen verloren. Das ist akzeptiertes Verhalten laut Spec, kein zu implementierender Code.
- Tests: `npx vitest run` · Build: `npm run build`

---

### Task 1: Datei-Parsing + Spalten-Heuristik

**Files:**
- Modify: `package.json` (neue Abhängigkeit `xlsx`)
- Create: `lib/import/fields.ts`
- Create: `lib/import/parse-file.ts`
- Create: `lib/import/__tests__/parse-file.test.ts`

**Interfaces:**
- Produces: `TargetField`, `ColumnMapping`, `TARGET_FIELDS` (`lib/import/fields.ts`); `ImportTable`, `parseImportFile(file)`, `suggestMapping(headers)` (`lib/import/parse-file.ts`) — von Task 2 und Task 4 konsumiert

**Tests required before implementation:**
- `it('parses a CSV file into headers + rows')`
- `it('parses an XLSX file into headers + rows')`
- `it('produces identical headers+rows for equivalent CSV and XLSX input')` (AC9)
- `it('falls back to generic column names when the header row is blank')`
- `it('returns an empty table for a file with no data rows')`
- `it('suggests producer for a column named "Winzer" or "Produzent"')` (AC2)
- `it('leaves a field unmapped when no header matches')`
- `it('never maps the same column index to two different fields')`

**Acceptance criteria covered:** AC1, AC2, AC9, Edge Case (keine Kopfzeile), Edge Case (leere Datei)
**Dependencies:** none

- [x] **Schritt 1: Abhängigkeit installieren**

`npm install xlsx` wurde **nicht** verwendet — die npm-Registry-Version (0.18.5) hat zwei ungepatchte High-Severity-CVEs (Prototype Pollution, ReDoS; SheetJS verteilt gepatchte Versionen nur noch über ein eigenes CDN außerhalb der npm-Registry). Für eine Funktion, die gezielt vom Nutzer hochgeladene Dateien parst, nicht vertretbar — siehe "Abweichung" oben. Stattdessen:

```bash
npm install exceljs
```

`exceljs` deckt nur `.xlsx` ab (kein Legacy-`.xls`); `.csv` wird von einem eigenen, abhängigkeitslosen Parser direkt in `parse-file.ts` gelesen (Schritt 3).

- [x] **Schritt 2: `lib/import/fields.ts` anlegen**

```ts
export type TargetField =
  | 'name' | 'producer' | 'type' | 'region' | 'country' | 'grape_variety' | 'notes'
  | 'vintage' | 'quantity' | 'purchase_price' | 'purchase_date' | 'purchase_location' | 'shelf_location'

// Index in die Rohzeile (ImportTable['rows'][i]), nicht der Spaltenname --
// erlaubt mehrdeutige/doppelte Headernamen in der Quelldatei.
export type ColumnMapping = Partial<Record<TargetField, number>>

export type TargetFieldConfig = {
  key: TargetField
  label: string
  required: boolean
  headerHints: string[]
}

// headerHints: lowercase, als Teilstring gegen den (lowercased) Spaltennamen
// geprüft -- siehe suggestMapping in parse-file.ts. Deutsch zuerst, dann
// gängige englische Varianten (häufigster Fall für Shop-Exporte).
export const TARGET_FIELDS: TargetFieldConfig[] = [
  { key: 'name', label: 'Name', required: true, headerHints: ['name', 'wein', 'wine'] },
  { key: 'producer', label: 'Produzent', required: true, headerHints: ['produzent', 'winzer', 'hersteller', 'producer', 'winery'] },
  { key: 'type', label: 'Typ', required: true, headerHints: ['typ', 'farbe', 'type', 'color', 'colour'] },
  { key: 'region', label: 'Region', required: false, headerHints: ['region'] },
  { key: 'country', label: 'Land', required: false, headerHints: ['land', 'country'] },
  { key: 'grape_variety', label: 'Rebsorte', required: false, headerHints: ['rebsorte', 'traube', 'grape', 'variety'] },
  { key: 'notes', label: 'Notizen', required: false, headerHints: ['notiz', 'notes', 'bemerkung'] },
  { key: 'vintage', label: 'Jahrgang', required: false, headerHints: ['jahrgang', 'jahr', 'vintage', 'year'] },
  { key: 'quantity', label: 'Anzahl', required: false, headerHints: ['anzahl', 'menge', 'stück', 'quantity', 'qty'] },
  { key: 'purchase_price', label: 'Preis', required: false, headerHints: ['preis', 'kaufpreis', 'price'] },
  { key: 'purchase_date', label: 'Kaufdatum', required: false, headerHints: ['kaufdatum', 'datum', 'date'] },
  { key: 'purchase_location', label: 'Kauforte', required: false, headerHints: ['händler', 'shop', 'kauforte', 'location'] },
  { key: 'shelf_location', label: 'Lagerort', required: false, headerHints: ['lagerort', 'regal', 'shelf'] },
]
```

- [x] **Schritt 3: `lib/import/parse-file.ts` anlegen**

Siehe die tatsächliche Implementierung in `lib/import/parse-file.ts`: ein kleiner selbst geschriebener RFC4180-CSV-Parser (`parseCsvText`) plus `exceljs` (`new ExcelJS.Workbook().xlsx.load(buffer)` → `sheet.eachRow({ includeEmpty: true }, ...)`) für `.xlsx`, hinter derselben `parseImportFile(file)`/`suggestMapping(headers)`-Schnittstelle wie ursprünglich geplant (Dateiformat-Entscheidung über `file.name`/`file.type`, nicht über Byte-Sniffing wie bei SheetJS). `suggestMapping` ist unverändert zum ursprünglichen Plan.

- [x] **Schritt 4: `lib/import/__tests__/parse-file.test.ts` anlegen**

Siehe die tatsächliche Implementierung — gleiche Testfälle wie ursprünglich geplant (inkl. AC9-Paritätstest), `xlsxFile()`-Fixture-Helper baut jetzt über `new ExcelJS.Workbook()` + `sheet.addRow(...)` + `workbook.xlsx.writeBuffer()` (asynchron) statt über `XLSX.utils`/`XLSX.write`. Zwei zusätzliche Tests gegenüber dem ursprünglichen Plan: Anführungszeichen-Felder mit eingebettetem Komma, und eine abschließende Leerzeile vor Dateiende (beide decken Verhalten des neuen eigenen CSV-Parsers ab, das SheetJS zuvor implizit mitgebracht hätte).

- [x] **Schritt 5: Tests ausführen**

```bash
npx vitest run lib/import/__tests__/parse-file.test.ts
```
Ergebnis: 11 Tests PASS.

- [x] **Schritt 6: Commit**

```bash
git add package.json package-lock.json lib/import/fields.ts lib/import/parse-file.ts lib/import/__tests__/parse-file.test.ts
git commit -m "feat: add CSV/Excel file parsing + column-mapping heuristic for wine import"
```

---

### Task 2: Zeilen-Validierung

**Files:**
- Create: `lib/import/validate-row.ts`
- Create: `lib/import/__tests__/validate-row.test.ts`

**Interfaces:**
- Consumes: `ColumnMapping`, `TargetField` (Task 1)
- Produces: `ParsedRowValues`, `ParsedRow`, `validateRow(row, mapping)`, `rowHasErrors(row)` — von Task 3 (Typ `ParsedRowValues`) und Task 4 konsumiert

**Tests required before implementation:**
- `it('marks a row with a blank name as an error')` (AC4)
- `it('maps common type synonyms to the four known wine types')`
- `it('errors with the raw value when the type is unmapped and non-empty')`
- `it('errors when the type column is mapped but the cell is blank')`
- `it('defaults quantity to 1 when unmapped/blank, errors on a non-positive or non-integer value')`
- `it('accepts vintage within 1900..current year, errors outside that range or non-integer')`
- `it('accepts a non-negative purchase_price, errors on negative or non-numeric')`
- `it('parses purchase_date in ISO, DD.MM.YYYY, and DD/MM/YYYY formats')`
- `it('parses purchase_date from a Date object and from an Excel serial number')`
- `it('errors on an unparseable purchase_date string')`
- `it('re-validates cleanly after a previously invalid cell is corrected')` (AC5)
- `it('treats a blank optional text field as null, not an error')`

**Acceptance criteria covered:** AC4, AC5, Edge Case (unbekannter Typ), Edge Case (Excel-Datum Date/Serial)
**Dependencies:** Task 1

- [ ] **Schritt 1: `lib/import/validate-row.ts` anlegen**

```ts
import type { WineType } from '@/lib/types'
import type { ColumnMapping, TargetField } from './fields'

export type ParsedRowValues = {
  name: string
  producer: string
  type: WineType | null
  region: string | null
  country: string | null
  grape_variety: string | null
  notes: string | null
  vintage: number | null
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
}

export type ParsedRow = {
  values: ParsedRowValues
  errors: Partial<Record<TargetField, string>>
}

export function rowHasErrors(row: ParsedRow): boolean {
  return Object.keys(row.errors).length > 0
}

const CURRENT_YEAR = new Date().getFullYear()

const TYPE_SYNONYMS: Record<WineType, string[]> = {
  red: ['red', 'rot', 'rotwein'],
  white: ['white', 'weiss', 'weisswein', 'weißwein', 'weiß'],
  'rosé': ['rose', 'rosé', 'rosewein', 'roséwein'],
  sparkling: ['sparkling', 'schaum', 'schaumwein', 'sekt', 'champagner', 'prosecco', 'spumante'],
}

// ß/é normalisiert, damit z.B. "Weißwein" und "Weisswein" beide matchen,
// ohne die Synonym-Liste selbst zu verdoppeln.
function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/ß/g, 'ss').replace(/é/g, 'e')
}

function matchWineType(raw: unknown): WineType | null {
  const normalized = normalize(raw)
  if (!normalized) return null
  for (const [type, synonyms] of Object.entries(TYPE_SYNONYMS) as [WineType, string[]][]) {
    if (synonyms.some(synonym => normalize(synonym) === normalized)) return type
  }
  return null
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DOT_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function parsePurchaseDate(raw: unknown): { value: string | null; valid: boolean } {
  if (raw == null || raw === '') return { value: null, valid: true }

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return { value: null, valid: false }
    return { value: raw.toISOString().split('T')[0], valid: true }
  }

  if (typeof raw === 'number') {
    // Excel-Datumsserial: Tage seit 1899-12-30 (Excels "Tag 0").
    const date = new Date((raw - 25569) * 86400 * 1000)
    if (Number.isNaN(date.getTime())) return { value: null, valid: false }
    return { value: date.toISOString().split('T')[0], valid: true }
  }

  const text = String(raw).trim()
  if (ISO_DATE.test(text)) return { value: text, valid: true }

  const dot = text.match(DOT_DATE)
  if (dot) return { value: `${dot[3]}-${dot[2].padStart(2, '0')}-${dot[1].padStart(2, '0')}`, valid: true }

  const slash = text.match(SLASH_DATE)
  if (slash) return { value: `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`, valid: true }

  return { value: null, valid: false }
}

function cell(row: unknown[], mapping: ColumnMapping, field: TargetField): unknown {
  const index = mapping[field]
  return index == null ? null : row[index] ?? null
}

function trimmedOrNull(raw: unknown): string | null {
  const text = String(raw ?? '').trim()
  return text || null
}

export function validateRow(row: unknown[], mapping: ColumnMapping): ParsedRow {
  const errors: Partial<Record<TargetField, string>> = {}

  const name = String(cell(row, mapping, 'name') ?? '').trim()
  if (!name) errors.name = 'Name fehlt'

  const producer = String(cell(row, mapping, 'producer') ?? '').trim()

  const rawType = cell(row, mapping, 'type')
  const type = matchWineType(rawType)
  if (type == null) {
    errors.type = rawType != null && String(rawType).trim() ? `Unbekannter Typ: ${rawType}` : 'Typ fehlt'
  }

  const region = trimmedOrNull(cell(row, mapping, 'region'))
  const country = trimmedOrNull(cell(row, mapping, 'country'))
  const grapeVariety = trimmedOrNull(cell(row, mapping, 'grape_variety'))
  const notes = trimmedOrNull(cell(row, mapping, 'notes'))
  const purchaseLocation = trimmedOrNull(cell(row, mapping, 'purchase_location'))
  const shelfLocation = trimmedOrNull(cell(row, mapping, 'shelf_location'))

  const rawVintage = cell(row, mapping, 'vintage')
  let vintage: number | null = null
  if (rawVintage != null && String(rawVintage).trim() !== '') {
    const n = Number(rawVintage)
    if (!Number.isInteger(n) || n < 1900 || n > CURRENT_YEAR) errors.vintage = 'Ungültiger Jahrgang'
    else vintage = n
  }

  const rawQuantity = cell(row, mapping, 'quantity')
  let quantity = 1
  if (rawQuantity != null && String(rawQuantity).trim() !== '') {
    const n = Number(rawQuantity)
    if (!Number.isInteger(n) || n <= 0) errors.quantity = 'Ungültige Anzahl'
    else quantity = n
  }

  const rawPrice = cell(row, mapping, 'purchase_price')
  let purchasePrice: number | null = null
  if (rawPrice != null && String(rawPrice).trim() !== '') {
    const n = Number(rawPrice)
    if (!Number.isFinite(n) || n < 0) errors.purchase_price = 'Ungültiger Preis'
    else purchasePrice = n
  }

  const { value: purchaseDate, valid: dateValid } = parsePurchaseDate(cell(row, mapping, 'purchase_date'))
  if (!dateValid) errors.purchase_date = 'Ungültiges Datum'

  return {
    values: {
      name, producer, type, region, country,
      grape_variety: grapeVariety, notes, vintage, quantity,
      purchase_price: purchasePrice, purchase_date: purchaseDate,
      purchase_location: purchaseLocation, shelf_location: shelfLocation,
    },
    errors,
  }
}
```

- [ ] **Schritt 2: `lib/import/__tests__/validate-row.test.ts` anlegen**

```ts
import { describe, it, expect } from 'vitest'
import { validateRow, rowHasErrors } from '../validate-row'
import type { ColumnMapping } from '../fields'

const FULL_MAPPING: ColumnMapping = {
  name: 0, producer: 1, type: 2, region: 3, country: 4, grape_variety: 5,
  notes: 6, vintage: 7, quantity: 8, purchase_price: 9, purchase_date: 10,
  purchase_location: 11, shelf_location: 12,
}

function row(overrides: Partial<Record<keyof typeof FULL_MAPPING, unknown>> = {}): unknown[] {
  const base: unknown[] = ['Barolo', 'Gaja', 'red', null, null, null, null, null, null, null, null, null, null]
  for (const [field, value] of Object.entries(overrides)) {
    base[FULL_MAPPING[field as keyof typeof FULL_MAPPING]] = value
  }
  return base
}

describe('validateRow', () => {
  it('marks a row with a blank name as an error', () => {
    const result = validateRow(row({ name: '  ' }), FULL_MAPPING)
    expect(result.errors.name).toBe('Name fehlt')
    expect(rowHasErrors(result)).toBe(true)
  })

  it('maps common type synonyms to the four known wine types', () => {
    expect(validateRow(row({ type: 'Rotwein' }), FULL_MAPPING).values.type).toBe('red')
    expect(validateRow(row({ type: 'Weißwein' }), FULL_MAPPING).values.type).toBe('white')
    expect(validateRow(row({ type: 'Rosé' }), FULL_MAPPING).values.type).toBe('rosé')
    expect(validateRow(row({ type: 'Sekt' }), FULL_MAPPING).values.type).toBe('sparkling')
  })

  it('errors with the raw value when the type is unmapped and non-empty', () => {
    const result = validateRow(row({ type: 'Orange' }), FULL_MAPPING)
    expect(result.errors.type).toBe('Unbekannter Typ: Orange')
  })

  it('errors when the type column is mapped but the cell is blank', () => {
    const result = validateRow(row({ type: null }), FULL_MAPPING)
    expect(result.errors.type).toBe('Typ fehlt')
  })

  it('defaults quantity to 1 when unmapped/blank, errors on a non-positive or non-integer value', () => {
    expect(validateRow(row(), FULL_MAPPING).values.quantity).toBe(1)
    expect(validateRow(row({ quantity: 0 }), FULL_MAPPING).errors.quantity).toBe('Ungültige Anzahl')
    expect(validateRow(row({ quantity: -2 }), FULL_MAPPING).errors.quantity).toBe('Ungültige Anzahl')
    expect(validateRow(row({ quantity: 2.5 }), FULL_MAPPING).errors.quantity).toBe('Ungültige Anzahl')
    expect(validateRow(row({ quantity: 6 }), FULL_MAPPING).values.quantity).toBe(6)
  })

  it('accepts vintage within 1900..current year, errors outside that range or non-integer', () => {
    expect(validateRow(row({ vintage: 2018 }), FULL_MAPPING).values.vintage).toBe(2018)
    expect(validateRow(row({ vintage: 1899 }), FULL_MAPPING).errors.vintage).toBe('Ungültiger Jahrgang')
    expect(validateRow(row({ vintage: new Date().getFullYear() + 1 }), FULL_MAPPING).errors.vintage).toBe('Ungültiger Jahrgang')
    expect(validateRow(row({ vintage: 2018.5 }), FULL_MAPPING).errors.vintage).toBe('Ungültiger Jahrgang')
  })

  it('accepts a non-negative purchase_price, errors on negative or non-numeric', () => {
    expect(validateRow(row({ purchase_price: 14.5 }), FULL_MAPPING).values.purchase_price).toBe(14.5)
    expect(validateRow(row({ purchase_price: -1 }), FULL_MAPPING).errors.purchase_price).toBe('Ungültiger Preis')
    expect(validateRow(row({ purchase_price: 'teuer' }), FULL_MAPPING).errors.purchase_price).toBe('Ungültiger Preis')
  })

  it('parses purchase_date in ISO, DD.MM.YYYY, and DD/MM/YYYY formats', () => {
    expect(validateRow(row({ purchase_date: '2026-03-05' }), FULL_MAPPING).values.purchase_date).toBe('2026-03-05')
    expect(validateRow(row({ purchase_date: '5.3.2026' }), FULL_MAPPING).values.purchase_date).toBe('2026-03-05')
    expect(validateRow(row({ purchase_date: '5/3/2026' }), FULL_MAPPING).values.purchase_date).toBe('2026-03-05')
  })

  it('parses purchase_date from a Date object and from an Excel serial number', () => {
    const fromDate = validateRow(row({ purchase_date: new Date('2026-03-05T00:00:00.000Z') }), FULL_MAPPING)
    expect(fromDate.values.purchase_date).toBe('2026-03-05')

    // Excel-Serial 46000 entspricht 2025-12-25 (Tage seit 1899-12-30).
    const fromSerial = validateRow(row({ purchase_date: 46000 }), FULL_MAPPING)
    expect(fromSerial.errors.purchase_date).toBeUndefined()
    expect(fromSerial.values.purchase_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('errors on an unparseable purchase_date string', () => {
    expect(validateRow(row({ purchase_date: 'irgendwann' }), FULL_MAPPING).errors.purchase_date).toBe('Ungültiges Datum')
  })

  it('re-validates cleanly after a previously invalid cell is corrected', () => {
    const broken = validateRow(row({ name: '' }), FULL_MAPPING)
    expect(rowHasErrors(broken)).toBe(true)

    const fixed = validateRow(row({ name: 'Barolo' }), FULL_MAPPING)
    expect(rowHasErrors(fixed)).toBe(false)
  })

  it('treats a blank optional text field as null, not an error', () => {
    const result = validateRow(row({ region: '  ' }), FULL_MAPPING)
    expect(result.values.region).toBeNull()
    expect(result.errors.region).toBeUndefined()
  })
})
```

- [ ] **Schritt 3: Tests ausführen**

```bash
npx vitest run lib/import/__tests__/validate-row.test.ts
```
Erwartet: alle Tests PASS.

- [ ] **Schritt 4: Commit**

```bash
git add lib/import/validate-row.ts lib/import/__tests__/validate-row.test.ts
git commit -m "feat: add per-row validation for wine import (type synonyms, dates, numbers)"
```

---

### Task 3: Matching + lokaler Schreibpfad

**Files:**
- Create: `lib/import/commit-rows.ts`
- Create: `lib/import/__tests__/commit-rows.test.ts`

**Interfaces:**
- Consumes: `ParsedRowValues` (Task 2)
- Produces: `matchKey(name, producer)`, `commitImportRows(db, cellarId, rows)` — von Task 4 konsumiert

**Tests required before implementation:**
- `it('creates a new wine + sku when no existing wine matches')`
- `it('reuses an existing wine (no wines insert) when name+producer match, case-insensitively and trimmed')` (AC6)
- `it('issues an UPDATE for region/country/grape_variety/notes right after a new wine insert, only when at least one is set')` (AC7)
- `it('skips the UPDATE when none of region/country/grape_variety/notes are set')`
- `it('matches a later row in the same import to a wine a previous row just created')` (sequential matching)
- `it('gives two rows that match the same pre-existing wine their own sku each, without a second wines insert')`
- `it('counts imported/failed correctly and continues past a row that throws')`

**Acceptance criteria covered:** AC6, AC7, AC8, Edge Case (zwei Zeilen matchen denselben Wein), Edge Case (zwei neue Zeilen matchen sich gegenseitig)
**Dependencies:** Task 2

- [ ] **Schritt 1: `lib/import/commit-rows.ts` anlegen**

```ts
import type { ParsedRowValues } from './validate-row'

// Minimale Teilmenge der PowerSync-DB-API, die dieses Modul braucht --
// erlaubt, im Test eine einfache Fake-Implementierung statt der echten
// PowerSync-Instanz zu übergeben.
export type ImportDb = {
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>
  writeTransaction<T>(callback: (tx: ImportTx) => Promise<T>): Promise<T>
}
export type ImportTx = {
  execute(sql: string, params?: unknown[]): Promise<unknown>
}

export type CommitResult = {
  imported: number
  failed: number
  errors: { index: number; message: string }[]
}

export function matchKey(name: string, producer: string): string {
  return `${name.trim().toLowerCase()}|${producer.trim().toLowerCase()}`
}

/**
 * Schreibt jede Zeile als eigene `writeTransaction`, strikt sequenziell
 * (kein Promise.all) -- absichtlich so, damit eine spätere Zeile im selben
 * Import einen von einer früheren Zeile gerade neu angelegten Wein per
 * Name+Produzent matchen kann: der `getOptional`-Lookup einer Zeile läuft
 * erst, nachdem die writeTransaction der vorherigen Zeile bereits
 * abgeschlossen (und damit lokal sichtbar) ist.
 */
export async function commitImportRows(
  db: ImportDb,
  cellarId: string,
  rows: ParsedRowValues[],
): Promise<CommitResult> {
  const result: CommitResult = { imported: 0, failed: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const existing = await db.getOptional<{ id: string }>(
        `SELECT id FROM wines WHERE cellar_id = ? AND lower(trim(name)) = ? AND lower(trim(producer)) = ?`,
        [cellarId, row.name.trim().toLowerCase(), row.producer.trim().toLowerCase()],
      )

      const wineId = existing?.id ?? crypto.randomUUID()
      const skuId = crypto.randomUUID()

      await db.writeTransaction(async tx => {
        if (!existing) {
          await tx.execute(
            `INSERT INTO wines (id, cellar_id, name, producer, type) VALUES (?, ?, ?, ?, ?)`,
            [wineId, cellarId, row.name, row.producer, row.type],
          )

          // PUT /api/v1/wines/[id] (Insert-Endpunkt) akzeptiert diese vier
          // Felder beim Insert nicht und setzt sie hart auf null -- siehe
          // Spec "Wichtiger Hinweis". Ein UPDATE direkt danach läuft über
          // den PATCH-Endpunkt, der sie korrekt persistiert (gleiches
          // Statement wie app/app/wine-edit-sheet.tsx).
          if (row.region || row.country || row.grape_variety || row.notes) {
            await tx.execute(
              `UPDATE wines SET region = ?, country = ?, grape_variety = ?, notes = ? WHERE id = ?`,
              [row.region, row.country, row.grape_variety, row.notes, wineId],
            )
          }
        }

        await tx.execute(
          `INSERT INTO skus
             (id, wine_id, vintage, quantity, storage_location_id, status, purchase_price, purchase_date, purchase_location, shelf_location, trip_id, photo_path)
           VALUES (?, ?, ?, ?, NULL, 'in_stock', ?, ?, ?, ?, NULL, NULL)`,
          [skuId, wineId, row.vintage, row.quantity, row.purchase_price, row.purchase_date, row.purchase_location, row.shelf_location],
        )
      })

      result.imported++
    } catch (err) {
      result.failed++
      result.errors.push({ index: i, message: err instanceof Error ? err.message : 'Unbekannter Fehler' })
    }
  }

  return result
}
```

- [ ] **Schritt 2: `lib/import/__tests__/commit-rows.test.ts` anlegen**

Eine kleine In-Memory-Fake-DB (statt eines vi.fn-Mocks pro Aufruf) ist hier der pragmatischste Weg, das eigentlich interessante Verhalten -- sequenzielles Matching über mehrere Zeilen hinweg -- end-to-end zu testen, ohne eine echte PowerSync-Instanz zu brauchen. Sie versteht nur die vier festen SQL-Formen, die `commitImportRows` tatsächlich ausgibt.

```ts
import { describe, it, expect } from 'vitest'
import { commitImportRows, matchKey, type ImportDb } from '../commit-rows'
import type { ParsedRowValues } from '../validate-row'

type WineRow = { id: string; cellar_id: string; name: string; producer: string; type: string; region: string | null; country: string | null; grape_variety: string | null; notes: string | null }
type SkuRow = { id: string; wine_id: string; vintage: number | null; quantity: number; purchase_price: number | null; purchase_date: string | null; purchase_location: string | null; shelf_location: string | null }

function makeFakeDb() {
  const wines: WineRow[] = []
  const skus: SkuRow[] = []

  const db: ImportDb = {
    async getOptional<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      if (sql.startsWith('SELECT id FROM wines')) {
        const [cellarId, name, producer] = params as [string, string, string]
        const match = wines.find(w => w.cellar_id === cellarId && w.name.toLowerCase() === name && w.producer.toLowerCase() === producer)
        return (match ? { id: match.id } : null) as T | null
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
    async writeTransaction<T>(callback: (tx: { execute(sql: string, params?: unknown[]): Promise<unknown> }) => Promise<T>): Promise<T> {
      const tx = {
        async execute(sql: string, params: unknown[] = []) {
          if (sql.startsWith('INSERT INTO wines')) {
            const [id, cellarId, name, producer, type] = params as [string, string, string, string, string]
            wines.push({ id, cellar_id: cellarId, name, producer, type, region: null, country: null, grape_variety: null, notes: null })
          } else if (sql.startsWith('UPDATE wines')) {
            const [region, country, grapeVariety, notes, id] = params as [string | null, string | null, string | null, string | null, string]
            const wine = wines.find(w => w.id === id)
            if (wine) Object.assign(wine, { region, country, grape_variety: grapeVariety, notes })
          } else if (sql.startsWith('INSERT INTO skus')) {
            const [id, wineId, vintage, quantity, purchasePrice, purchaseDate, purchaseLocation, shelfLocation] = params as
              [string, string, number | null, number, number | null, string | null, string | null, string | null]
            skus.push({ id, wine_id: wineId, vintage, quantity, purchase_price: purchasePrice, purchase_date: purchaseDate, purchase_location: purchaseLocation, shelf_location: shelfLocation })
          } else {
            throw new Error(`Unexpected statement: ${sql}`)
          }
          return undefined
        },
      }
      return callback(tx)
    },
  }

  return { db, wines, skus }
}

function makeRow(overrides: Partial<ParsedRowValues> = {}): ParsedRowValues {
  return {
    name: 'Barolo', producer: 'Gaja', type: 'red',
    region: null, country: null, grape_variety: null, notes: null,
    vintage: null, quantity: 1, purchase_price: null, purchase_date: null,
    purchase_location: null, shelf_location: null,
    ...overrides,
  }
}

describe('commitImportRows', () => {
  it('creates a new wine + sku when no existing wine matches', async () => {
    const { db, wines, skus } = makeFakeDb()
    const result = await commitImportRows(db, 'cellar-1', [makeRow()])

    expect(result).toEqual({ imported: 1, failed: 0, errors: [] })
    expect(wines).toHaveLength(1)
    expect(skus).toHaveLength(1)
    expect(skus[0].wine_id).toBe(wines[0].id)
  })

  it('reuses an existing wine (no wines insert) when name+producer match, case-insensitively and trimmed', async () => {
    const { db, wines, skus } = makeFakeDb()
    wines.push({ id: 'wine-existing', cellar_id: 'cellar-1', name: 'Barolo', producer: 'Gaja', type: 'red', region: null, country: null, grape_variety: null, notes: null })

    const result = await commitImportRows(db, 'cellar-1', [makeRow({ name: '  BAROLO  ', producer: ' gaja ' })])

    expect(result.imported).toBe(1)
    expect(wines).toHaveLength(1) // kein zweiter Wein
    expect(skus).toHaveLength(1)
    expect(skus[0].wine_id).toBe('wine-existing')
  })

  it('issues an UPDATE for region/country/grape_variety/notes right after a new wine insert, only when at least one is set', async () => {
    const { db, wines } = makeFakeDb()
    await commitImportRows(db, 'cellar-1', [makeRow({ region: 'Piemont', country: 'Italien' })])

    expect(wines[0].region).toBe('Piemont')
    expect(wines[0].country).toBe('Italien')
  })

  it('skips the UPDATE when none of region/country/grape_variety/notes are set', async () => {
    const { db, wines } = makeFakeDb()
    await commitImportRows(db, 'cellar-1', [makeRow()])

    expect(wines[0].region).toBeNull()
  })

  it('matches a later row in the same import to a wine a previous row just created', async () => {
    const { db, wines, skus } = makeFakeDb()
    const result = await commitImportRows(db, 'cellar-1', [
      makeRow({ vintage: 2018 }),
      makeRow({ vintage: 2019 }),
    ])

    expect(result.imported).toBe(2)
    expect(wines).toHaveLength(1) // zweite Zeile matcht die von der ersten Zeile angelegte
    expect(skus).toHaveLength(2)
    expect(skus.every(s => s.wine_id === wines[0].id)).toBe(true)
  })

  it('gives two rows that match the same pre-existing wine their own sku each, without a second wines insert', async () => {
    const { db, wines, skus } = makeFakeDb()
    wines.push({ id: 'wine-existing', cellar_id: 'cellar-1', name: 'Barolo', producer: 'Gaja', type: 'red', region: null, country: null, grape_variety: null, notes: null })

    await commitImportRows(db, 'cellar-1', [makeRow({ vintage: 2018 }), makeRow({ vintage: 2019 })])

    expect(wines).toHaveLength(1)
    expect(skus).toHaveLength(2)
  })

  it('counts imported/failed correctly and continues past a row that throws', async () => {
    const { db } = makeFakeDb()
    let calls = 0
    const failingDb: ImportDb = {
      ...db,
      async writeTransaction(callback) {
        calls++
        if (calls === 1) throw new Error('boom')
        return db.writeTransaction(callback)
      },
    }

    const result = await commitImportRows(failingDb, 'cellar-1', [makeRow(), makeRow({ name: 'Chianti' })])

    expect(result.imported).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.errors).toEqual([{ index: 0, message: 'boom' }])
  })
})

describe('matchKey', () => {
  it('normalizes case and whitespace', () => {
    expect(matchKey('  Barolo ', ' GAJA ')).toBe(matchKey('barolo', 'gaja'))
  })
})
```

- [ ] **Schritt 3: Tests ausführen**

```bash
npx vitest run lib/import/__tests__/commit-rows.test.ts
```
Erwartet: alle Tests PASS.

- [ ] **Schritt 4: Commit**

```bash
git add lib/import/commit-rows.ts lib/import/__tests__/commit-rows.test.ts
git commit -m "feat: add wine-matching + local write path for bulk wine import"
```

---

### Task 4: UI-Wizard + Einstiegspunkt

**Files:**
- Create: `app/app/import-wines-dialog.tsx`
- Modify: `app/app/cellar-screen.tsx`

**Interfaces:**
- Consumes: `parseImportFile`, `suggestMapping`, `TARGET_FIELDS` (Task 1); `validateRow`, `rowHasErrors` (Task 2); `commitImportRows`, `matchKey` (Task 3)
- Produces: `ImportWinesDialog` — in `cellar-screen.tsx` neben `QuickAddSheet` eingebunden

**Acceptance criteria covered:** AC1, AC2, AC3, AC4, AC5, AC8, Edge Case (leere Datei im UI), Edge Case (Abbruch vor Bestätigen)
**Dependencies:** Task 1, Task 2, Task 3

- [ ] **Schritt 1: `app/app/import-wines-dialog.tsx` anlegen**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { useQuery, usePowerSync } from '@powersync/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TARGET_FIELDS, type ColumnMapping } from '@/lib/import/fields'
import { parseImportFile, suggestMapping, type ImportTable } from '@/lib/import/parse-file'
import { validateRow, rowHasErrors, type ParsedRow } from '@/lib/import/validate-row'
import { commitImportRows, matchKey } from '@/lib/import/commit-rows'

type Step = 'upload' | 'mapping' | 'preview'

const NONE = '__none__'

// Dreistufiger Wizard, komplett lokaler State -- kein Schritt verlässt das
// Gerät außer den finalen writeTransaction-Aufrufen in commitImportRows
// (Task 3). editableRows ist eine mutierbare Kopie von table.rows, damit
// Inline-Korrekturen in der Vorschau nicht die Originaldatei anfassen.
export function ImportWinesDialog({ cellarId }: { cellarId: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [table, setTable] = useState<ImportTable | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [editableRows, setEditableRows] = useState<unknown[][]>([])
  const [included, setIncluded] = useState<boolean[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: existingWines } = useQuery<{ name: string; producer: string }>(
    `SELECT name, producer FROM wines WHERE cellar_id = ?`,
    [cellarId],
  )
  const existingKeys = useMemo(
    () => new Set(existingWines.map(w => matchKey(w.name, w.producer))),
    [existingWines],
  )

  function reset() {
    setStep('upload'); setTable(null); setMapping({}); setEditableRows([])
    setIncluded([]); setSummary(null); setError(null)
  }

  async function handleFile(file: File) {
    setError(null)
    const parsed = await parseImportFile(file)
    if (parsed.rows.length === 0) {
      setError('Die Datei enthält keine Datenzeilen.')
      return
    }
    setTable(parsed)
    setMapping(suggestMapping(parsed.headers))
    setEditableRows(parsed.rows.map(row => [...row]))
    setStep('mapping')
  }

  const parsedRows: ParsedRow[] = useMemo(
    () => editableRows.map(row => validateRow(row, mapping)),
    [editableRows, mapping],
  )

  const requiredMapped = TARGET_FIELDS.filter(f => f.required).every(f => mapping[f.key] != null)

  function goToPreview() {
    setIncluded(parsedRows.map(row => !rowHasErrors(row)))
    setStep('preview')
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setEditableRows(prev => {
      const next = prev.map(row => [...row])
      next[rowIndex][columnIndex] = value
      return next
    })
  }

  const selectedCount = included.filter((isIncluded, i) => isIncluded && !rowHasErrors(parsedRows[i])).length

  async function handleImport() {
    setIsImporting(true)
    try {
      const selected = parsedRows
        .map((row, i) => ({ row, isIncluded: included[i] }))
        .filter(({ row, isIncluded }) => isIncluded && !rowHasErrors(row))
        .map(({ row }) => row.values)

      const result = await commitImportRows(db, cellarId, selected)
      setSummary({ imported: result.imported, skipped: editableRows.length - selected.length + result.failed })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) reset() }}>
      <DialogTrigger render={
        <Button size="icon-sm" variant="outline" aria-label="Weine importieren">
          <Upload className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Weine importieren</DialogTitle>
          <DialogDescription>CSV- oder Excel-Datei mit mehreren Weinen auf einmal übernehmen.</DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Input
              type="file"
              accept=".csv,.xlsx"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            {error && <p style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
        )}

        {step === 'mapping' && table && (
          <div className="space-y-4">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' }}>
              Welche Spalte deiner Datei entspricht welchem Feld? Pflichtfelder sind markiert (*).
            </p>
            <div className="space-y-3">
              {TARGET_FIELDS.map(field => (
                <div key={field.key} className="flex items-center justify-between gap-3">
                  <Label>{field.label}{field.required ? ' *' : ''}</Label>
                  <Select
                    value={mapping[field.key] != null ? String(mapping[field.key]) : NONE}
                    onValueChange={value => setMapping(prev => ({
                      ...prev,
                      [field.key]: value === NONE ? undefined : Number(value),
                    }))}
                  >
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>nicht importieren</SelectItem>
                      {table.headers.map((header, i) => (
                        <SelectItem key={i} value={String(i)}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Zurück</Button>
              <Button disabled={!requiredMapped} onClick={goToPreview}>Weiter</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && !summary && (
          <div className="space-y-4">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th></th>
                    {TARGET_FIELDS.filter(f => mapping[f.key] != null).map(f => (
                      <th key={f.key} className="text-left pr-3">{f.label}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((parsedRow, rowIndex) => {
                    const isMatch = existingKeys.has(matchKey(parsedRow.values.name, parsedRow.values.producer))
                    return (
                      <tr key={rowIndex}>
                        <td>
                          <Checkbox
                            checked={included[rowIndex] ?? false}
                            disabled={rowHasErrors(parsedRow)}
                            onCheckedChange={checked => setIncluded(prev => {
                              const next = [...prev]
                              next[rowIndex] = checked === true
                              return next
                            })}
                          />
                        </td>
                        {TARGET_FIELDS.filter(f => mapping[f.key] != null).map(field => {
                          const columnIndex = mapping[field.key]!
                          const fieldError = parsedRow.errors[field.key]
                          return (
                            <td key={field.key} className="pr-3 pb-2">
                              <Input
                                value={String(editableRows[rowIndex][columnIndex] ?? '')}
                                onChange={e => updateCell(rowIndex, columnIndex, e.target.value)}
                                style={fieldError ? { borderColor: 'var(--destructive)' } : undefined}
                                title={fieldError}
                              />
                            </td>
                          )
                        })}
                        <td>{isMatch && <span className="eyebrow">bereits im Keller</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('mapping')}>Zurück</Button>
              <Button disabled={selectedCount === 0 || isImporting} onClick={handleImport}>
                {selectedCount} {selectedCount === 1 ? 'Wein' : 'Weine'} importieren
              </Button>
            </DialogFooter>
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            <p>{summary.imported} importiert{summary.skipped > 0 ? `, ${summary.skipped} übersprungen` : ''}.</p>
            <DialogFooter>
              <DialogClose render={<Button />}>Fertig</DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

> **Hinweis:** Falls `components/ui/checkbox.tsx` noch nicht existiert (aktuell nicht in `components/ui/` vorhanden, siehe Task-Recherche), zuerst per `npx shadcn@latest add checkbox` (gleiches Setup wie die übrigen `components/ui/*`-Dateien, `components.json` ist bereits konfiguriert) hinzufügen, bevor dieser Schritt beginnt.

- [ ] **Schritt 2: `app/app/cellar-screen.tsx` verdrahten**

Import ergänzen:
```tsx
import { ImportWinesDialog } from '@/app/app/import-wines-dialog'
```

In der Quick-Links-Zeile, direkt vor `<QuickAddSheet cellarId={cellarId} />`:
```tsx
          <ImportWinesDialog cellarId={cellarId} />
          <QuickAddSheet cellarId={cellarId} />
```

- [ ] **Schritt 3: Build**

```bash
npm run build 2>&1 | tail -30
```
Erwartet: keine TypeScript-Fehler.

- [ ] **Schritt 4: Manuelle Prüfung (Dev-Server)**

```bash
npm run dev
```
Im Browser: Dialog öffnen, eine kleine CSV-Testdatei (z. B. `Name,Produzent,Typ\nBarolo,Gaja,Rotwein\n,Antinori,red`) hochladen, Mapping prüfen (Produzent sollte automatisch vorbelegt sein), zur Vorschau weiter, die Zeile mit leerem Namen sollte als Fehler markiert und abwählbar sein, danach importieren und im Kellerbestand verifizieren.

- [ ] **Schritt 5: Commit**

```bash
git add app/app/import-wines-dialog.tsx app/app/cellar-screen.tsx
git commit -m "feat: add CSV/Excel wine import wizard to the cellar screen"
```

---

## Parallel Execution

- Task 1 muss zuerst abgeschlossen sein (liefert `ColumnMapping`/`TargetField`, von allen anderen Tasks importiert).
- Task 2 und Task 3 **können parallel laufen**, sobald Task 1 fertig ist: Task 3 braucht nur die `ParsedRowValues`-Typsignatur aus Task 2 (die am Anfang von Task 2 Schritt 1 steht), nicht deren Implementierung — ein Implementierer kann den Typ vorab absprechen und beide Tasks gleichzeitig beginnen.
- Task 4 muss auf Task 1, 2 **und** 3 warten (importiert aus allen dreien).

## Commit Plan

- `feat: add CSV/Excel file parsing + column-mapping heuristic for wine import` (Task 1)
- `feat: add per-row validation for wine import (type synonyms, dates, numbers)` (Task 2)
- `feat: add wine-matching + local write path for bulk wine import` (Task 3)
- `feat: add CSV/Excel wine import wizard to the cellar screen` (Task 4)
