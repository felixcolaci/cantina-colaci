import { describe, it, expect } from 'vitest'
import { commitImportRows, matchKey, type ImportDb } from '../commit-rows'
import type { ParsedRowValues } from '../validate-row'

type WineRow = { id: string; cellar_id: string; name: string; producer: string; type: string; region: string | null; country: string | null; grape_variety: string | null; notes: string | null }
type SkuRow = { id: string; wine_id: string; vintage: number | null; quantity: number; purchase_price: number | null; purchase_date: string | null; purchase_location: string | null; shelf_location: string | null }

// Eine kleine In-Memory-Fake-DB statt eines vi.fn-Mocks pro Aufruf -- so
// lässt sich das eigentlich interessante Verhalten (sequenzielles Matching
// über mehrere Zeilen hinweg) end-to-end testen, ohne eine echte
// PowerSync-Instanz zu brauchen. Sie versteht nur die vier festen SQL-Formen,
// die commitImportRows tatsächlich ausgibt.
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
