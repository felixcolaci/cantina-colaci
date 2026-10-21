import { describe, it, expect } from 'vitest'
import { parseStorageLocationInsert } from '../storage-location'

describe('parseStorageLocationInsert', () => {
  it('accepts a valid body', () => {
    expect(parseStorageLocationInsert({ cellar_id: 'cellar-1', name: 'Klimaschrank', type: 'climate_cabinet' })).toEqual({
      cellar_id: 'cellar-1',
      name: 'Klimaschrank',
      type: 'climate_cabinet',
    })
  })

  it('trims the name', () => {
    expect(parseStorageLocationInsert({ cellar_id: 'c', name: '  Keller  ', type: 'cellar' })).toEqual({
      cellar_id: 'c',
      name: 'Keller',
      type: 'cellar',
    })
  })

  it('rejects a non-object body', () => {
    expect(parseStorageLocationInsert(null)).toBeNull()
    expect(parseStorageLocationInsert('nope')).toBeNull()
  })

  it('rejects a missing or blank cellar_id/name', () => {
    expect(parseStorageLocationInsert({ name: 'Keller', type: 'cellar' })).toBeNull()
    expect(parseStorageLocationInsert({ cellar_id: 'c', name: '  ', type: 'cellar' })).toBeNull()
  })

  it('rejects a type outside the known enum', () => {
    expect(parseStorageLocationInsert({ cellar_id: 'c', name: 'Keller', type: 'garage' })).toBeNull()
  })
})
