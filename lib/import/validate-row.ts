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
