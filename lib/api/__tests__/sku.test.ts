import { describe, it, expect } from 'vitest'
import { parseSkuInsertExtra, parseSkuPatch } from '../sku'

describe('parseSkuInsertExtra', () => {
  it('defaults every field to null for an empty body', () => {
    expect(parseSkuInsertExtra({})).toEqual({
      storage_location_id: null,
      purchase_price: null,
      purchase_date: null,
      purchase_location: null,
      shelf_location: null,
    })
  })

  it('defaults every field to null for a non-object body', () => {
    expect(parseSkuInsertExtra(null)).toEqual({
      storage_location_id: null,
      purchase_price: null,
      purchase_date: null,
      purchase_location: null,
      shelf_location: null,
    })
  })

  it('accepts a full set of optional fields', () => {
    expect(
      parseSkuInsertExtra({
        storage_location_id: 'loc-1',
        purchase_price: 24.5,
        purchase_date: '2026-01-01',
        purchase_location: 'Weinhandlung',
        shelf_location: 'Reihe 3',
      }),
    ).toEqual({
      storage_location_id: 'loc-1',
      purchase_price: 24.5,
      purchase_date: '2026-01-01',
      purchase_location: 'Weinhandlung',
      shelf_location: 'Reihe 3',
    })
  })

  it('treats an explicit null the same as an absent field', () => {
    expect(parseSkuInsertExtra({ storage_location_id: null, purchase_price: null })).toEqual({
      storage_location_id: null,
      purchase_price: null,
      purchase_date: null,
      purchase_location: null,
      shelf_location: null,
    })
  })

  it('rejects a wrong-typed field', () => {
    expect(parseSkuInsertExtra({ storage_location_id: 42 })).toBeNull()
    expect(parseSkuInsertExtra({ purchase_price: 'free' })).toBeNull()
    expect(parseSkuInsertExtra({ purchase_price: Infinity })).toBeNull()
    expect(parseSkuInsertExtra({ shelf_location: 123 })).toBeNull()
  })
})

describe('parseSkuPatch', () => {
  it('rejects a non-object body', () => {
    expect(parseSkuPatch(null)).toBeNull()
    expect(parseSkuPatch('nope')).toBeNull()
  })

  it('accepts an empty object (caller decides whether an empty patch is a no-op)', () => {
    expect(parseSkuPatch({})).toEqual({})
  })

  it('accepts a quantity + status pair (the open-bottle shape)', () => {
    expect(parseSkuPatch({ quantity: 2, status: 'in_stock' })).toEqual({ quantity: 2, status: 'in_stock' })
    expect(parseSkuPatch({ quantity: 0, status: 'consumed' })).toEqual({ quantity: 0, status: 'consumed' })
  })

  it('rejects a negative or non-integer quantity', () => {
    expect(parseSkuPatch({ quantity: -1 })).toBeNull()
    expect(parseSkuPatch({ quantity: 1.5 })).toBeNull()
  })

  it('rejects a status outside the known enum', () => {
    expect(parseSkuPatch({ status: 'lost' })).toBeNull()
  })
})
