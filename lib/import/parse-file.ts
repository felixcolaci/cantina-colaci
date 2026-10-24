import ExcelJS from 'exceljs'
import type { CellValue } from 'exceljs'
import { TARGET_FIELDS, type ColumnMapping } from './fields'

export type ImportTable = {
  headers: string[]
  rows: unknown[][]
}

/**
 * Winziger eigener RFC4180-Parser (Anführungszeichen, "" als Escape,
 * eingebettete Kommas/Zeilenumbrüche in Quotes) -- kein zusätzliches Paket
 * für reines CSV-Parsing nötig, siehe Plan "Offene Punkte"/Sicherheits-
 * entscheidung gegen `xlsx` (SheetJS).
 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  function endField() {
    row.push(field)
    field = ''
  }
  function endRow() {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
          continue
        }
        inQuotes = false
        continue
      }
      field += char
      continue
    }
    if (char === '"') { inQuotes = true; continue }
    if (char === ',') { endField(); continue }
    if (char === '\r') continue
    if (char === '\n') { endRow(); continue }
    field += char
  }
  if (field !== '' || row.length > 0) endRow()

  return rows
}

function cellToPrimitive(value: CellValue): unknown {
  if (value == null) return null
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if ('result' in value) return value.result ?? null
    if ('richText' in value) return value.richText.map(part => part.text).join('')
    if ('text' in value) return (value as { text: unknown }).text
    return null
  }
  return value
}

async function parseWorkbook(buffer: ArrayBuffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const raw: unknown[][] = []
  sheet.eachRow({ includeEmpty: true }, excelRow => {
    const values = (excelRow.values as CellValue[]).slice(1) // Index 0 ist bei ExcelJS immer leer (1-basiert)
    raw.push(values.map(cellToPrimitive))
  })
  return raw
}

// Eine durch einen Zeilenumbruch erzeugte, komplett leere Zeile (eine
// einzelne leere Zelle) wird übersprungen -- z.B. eine Leerzeile vor dem
// Dateiende. Eine Zeile mit mehreren, aber alle leeren Zellen (z.B. aus
// ",") bleibt erhalten -- das kann eine echte Datenzeile mit leeren Werten
// sein (siehe den Mapping-Fallback-Test für eine komplett leere Kopfzeile).
function dropBlankLines(raw: unknown[][]): unknown[][] {
  return raw.filter(row => !(row.length <= 1 && (row[0] === '' || row[0] == null)))
}

/**
 * Liest eine CSV- oder Excel-(.xlsx)-Datei komplett clientseitig, nie auf
 * dem Server. Legacy-`.xls` (vor-2007-Binärformat) wird bewusst NICHT
 * unterstützt: `exceljs` kann es nicht lesen, und ein zweites Paket allein
 * für dieses seltene Altformat lohnt sich nicht (siehe Plan).
 */
export async function parseImportFile(file: File): Promise<ImportTable> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
  const raw = dropBlankLines(
    isCsv ? parseCsvText(await file.text()) : await parseWorkbook(await file.arrayBuffer()),
  )
  if (raw.length === 0) return { headers: [], rows: [] }

  const [headerRow, ...dataRows] = raw
  const headers = headerRow.map((cellValue, i) => {
    const text = typeof cellValue === 'string' ? cellValue.trim() : cellValue != null ? String(cellValue) : ''
    return text || `Spalte ${i + 1}`
  })
  return { headers, rows: dataRows }
}

/**
 * Bevorzugt eine Vorbelegung pro Zielfeld anhand des Spaltennamens (erster
 * Treffer gewinnt, jede Spalte wird höchstens einem Feld zugeordnet) --
 * bleibt im Mapping-Schritt frei änderbar, ist nur ein Startpunkt.
 */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const used = new Set<number>()

  for (const field of TARGET_FIELDS) {
    const index = headers.findIndex((header, i) => {
      if (used.has(i)) return false
      const lower = header.toLowerCase()
      return field.headerHints.some(hint => lower.includes(hint))
    })
    if (index !== -1) {
      mapping[field.key] = index
      used.add(index)
    }
  }

  return mapping
}
