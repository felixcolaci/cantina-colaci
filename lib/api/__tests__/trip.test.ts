import { describe, it, expect } from 'vitest'
import { parseTripInsert } from '../trip'

describe('parseTripInsert', () => {
  it('accepts a full body', () => {
    expect(
      parseTripInsert({
        cellar_id: 'cellar-1',
        name: 'Toskana Sommer 2026',
        location: 'Toskana, Italien',
        date_start: '2026-06-01',
        date_end: '2026-06-10',
      }),
    ).toEqual({
      cellar_id: 'cellar-1',
      name: 'Toskana Sommer 2026',
      location: 'Toskana, Italien',
      date_start: '2026-06-01',
      date_end: '2026-06-10',
    })
  })

  it('accepts just the required fields, defaulting the rest to null', () => {
    expect(parseTripInsert({ cellar_id: 'c', name: 'Reise' })).toEqual({
      cellar_id: 'c',
      name: 'Reise',
      location: null,
      date_start: null,
      date_end: null,
    })
  })

  it('trims name and location, treating a blank location as null', () => {
    expect(parseTripInsert({ cellar_id: 'c', name: '  Reise  ', location: '   ' })).toEqual({
      cellar_id: 'c',
      name: 'Reise',
      location: null,
      date_start: null,
      date_end: null,
    })
  })

  it('rejects a non-object body', () => {
    expect(parseTripInsert(null)).toBeNull()
    expect(parseTripInsert('nope')).toBeNull()
  })

  it('rejects a missing or blank cellar_id/name', () => {
    expect(parseTripInsert({ name: 'Reise' })).toBeNull()
    expect(parseTripInsert({ cellar_id: 'c', name: '   ' })).toBeNull()
  })

  it('rejects a wrong-typed optional field', () => {
    expect(parseTripInsert({ cellar_id: 'c', name: 'Reise', location: 42 })).toBeNull()
    expect(parseTripInsert({ cellar_id: 'c', name: 'Reise', date_start: 2026 })).toBeNull()
  })
})
