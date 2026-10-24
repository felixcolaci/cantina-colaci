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

  it('leaves an unmapped field as null/default without an error', () => {
    const mapping: ColumnMapping = { name: 0, producer: 1, type: 2 }
    const result = validateRow(['Barolo', 'Gaja', 'red'], mapping)
    expect(rowHasErrors(result)).toBe(false)
    expect(result.values.region).toBeNull()
    expect(result.values.quantity).toBe(1)
  })
})
