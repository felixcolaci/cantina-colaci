import { describe, it, expect } from 'vitest'
import { parseDiscoveryInsert } from '../discovery'

describe('parseDiscoveryInsert', () => {
  it('accepts a full body', () => {
    expect(
      parseDiscoveryInsert({
        cellar_id: 'cellar-1',
        created_by: 'user-1',
        name: 'Barolo Riserva',
        producer: 'Gaja',
        vintage: 2018,
        type: 'red',
        location_text: 'Osteria da Mario',
        trip_id: null,
        date: '2026-10-18',
        rating: 4,
        notes: 'Sehr elegant, viel Tannin',
        price: 14.5,
      }),
    ).toEqual({
      cellar_id: 'cellar-1',
      created_by: 'user-1',
      name: 'Barolo Riserva',
      producer: 'Gaja',
      vintage: 2018,
      type: 'red',
      location_text: 'Osteria da Mario',
      trip_id: null,
      date: '2026-10-18',
      rating: 4,
      notes: 'Sehr elegant, viel Tannin',
      price: 14.5,
    })
  })

  it('accepts just the required fields, defaulting the rest to null', () => {
    expect(
      parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18' }),
    ).toEqual({
      cellar_id: 'c',
      created_by: 'u',
      name: 'Wein',
      producer: null,
      vintage: null,
      type: null,
      location_text: null,
      trip_id: null,
      date: '2026-10-18',
      rating: null,
      notes: null,
      price: null,
    })
  })

  it('trims name/producer/location_text/notes, treating blank as null', () => {
    const result = parseDiscoveryInsert({
      cellar_id: 'c', created_by: 'u', name: '  Wein  ', date: '2026-10-18',
      producer: '   ', location_text: '  ', notes: '   ',
    })
    expect(result?.name).toBe('Wein')
    expect(result?.producer).toBeNull()
    expect(result?.location_text).toBeNull()
    expect(result?.notes).toBeNull()
  })

  it('rejects a non-object body', () => {
    expect(parseDiscoveryInsert(null)).toBeNull()
    expect(parseDiscoveryInsert('nope')).toBeNull()
  })

  it('rejects a missing or blank cellar_id/created_by/name/date', () => {
    expect(parseDiscoveryInsert({ created_by: 'u', name: 'Wein', date: '2026-10-18' })).toBeNull()
    expect(parseDiscoveryInsert({ cellar_id: 'c', name: 'Wein', date: '2026-10-18' })).toBeNull()
    expect(parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: '  ', date: '2026-10-18' })).toBeNull()
    expect(parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: 'Wein' })).toBeNull()
  })

  it('rejects a rating outside 1-5 or non-integer', () => {
    const base = { cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18' }
    expect(parseDiscoveryInsert({ ...base, rating: 0 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, rating: 6 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, rating: 3.5 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, rating: 5 })?.rating).toBe(5)
    expect(parseDiscoveryInsert({ ...base })?.rating).toBeNull()
  })

  it('rejects a wrong-typed optional field', () => {
    const base = { cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18' }
    expect(parseDiscoveryInsert({ ...base, producer: 42 })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, price: '12.50' })).toBeNull()
    expect(parseDiscoveryInsert({ ...base, trip_id: 42 })).toBeNull()
  })

  it('rejects an unknown wine type', () => {
    expect(
      parseDiscoveryInsert({ cellar_id: 'c', created_by: 'u', name: 'Wein', date: '2026-10-18', type: 'orange' }),
    ).toBeNull()
  })
})
