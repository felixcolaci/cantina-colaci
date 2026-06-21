import { describe, it, expect } from 'vitest'
import type { WineType, EntryStatus, FamilyRole } from '../types'

describe('domain type literals', () => {
  it('WineType covers all four values', () => {
    const types: WineType[] = ['red', 'white', 'rosé', 'sparkling']
    expect(types).toHaveLength(4)
  })

  it('EntryStatus covers all three values', () => {
    const statuses: EntryStatus[] = ['in_stock', 'consumed', 'gifted']
    expect(statuses).toHaveLength(3)
  })

  it('FamilyRole covers both values', () => {
    const roles: FamilyRole[] = ['owner', 'member']
    expect(roles).toHaveLength(2)
  })
})
