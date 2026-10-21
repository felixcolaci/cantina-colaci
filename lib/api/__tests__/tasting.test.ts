import { describe, it, expect } from 'vitest'
import { parseTastingInsert } from '../tasting'

describe('parseTastingInsert', () => {
  it('accepts a full body', () => {
    expect(
      parseTastingInsert({ cellar_entry_id: 'sku-1', user_id: 'user-1', date: '2026-01-01', rating: 4, notes: 'Toll' }),
    ).toEqual({ cellar_entry_id: 'sku-1', user_id: 'user-1', date: '2026-01-01', rating: 4, notes: 'Toll' })
  })

  it('defaults notes to null when absent', () => {
    expect(parseTastingInsert({ cellar_entry_id: 'sku-1', user_id: 'user-1', date: '2026-01-01', rating: 3 })).toEqual({
      cellar_entry_id: 'sku-1',
      user_id: 'user-1',
      date: '2026-01-01',
      rating: 3,
      notes: null,
    })
  })

  it('trims notes, treating a blank string as null', () => {
    expect(
      parseTastingInsert({ cellar_entry_id: 'sku-1', user_id: 'user-1', date: '2026-01-01', rating: 3, notes: '   ' }),
    ).toMatchObject({ notes: null })
  })

  it('rejects a non-object body', () => {
    expect(parseTastingInsert(null)).toBeNull()
    expect(parseTastingInsert('nope')).toBeNull()
  })

  it('rejects a missing cellar_entry_id/user_id/date', () => {
    expect(parseTastingInsert({ user_id: 'u', date: '2026-01-01', rating: 3 })).toBeNull()
    expect(parseTastingInsert({ cellar_entry_id: 's', date: '2026-01-01', rating: 3 })).toBeNull()
    expect(parseTastingInsert({ cellar_entry_id: 's', user_id: 'u', rating: 3 })).toBeNull()
  })

  it('rejects a rating outside 1-5 or non-integer', () => {
    expect(parseTastingInsert({ cellar_entry_id: 's', user_id: 'u', date: '2026-01-01', rating: 0 })).toBeNull()
    expect(parseTastingInsert({ cellar_entry_id: 's', user_id: 'u', date: '2026-01-01', rating: 6 })).toBeNull()
    expect(parseTastingInsert({ cellar_entry_id: 's', user_id: 'u', date: '2026-01-01', rating: 2.5 })).toBeNull()
  })
})
