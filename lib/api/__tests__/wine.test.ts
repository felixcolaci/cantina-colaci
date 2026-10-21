import { describe, it, expect } from 'vitest'
import { parseWinePatch } from '../wine'

describe('parseWinePatch', () => {
  it('rejects a non-object body', () => {
    expect(parseWinePatch(null)).toBeNull()
    expect(parseWinePatch('nope')).toBeNull()
    expect(parseWinePatch(undefined)).toBeNull()
  })

  it('accepts an empty object (caller decides whether an empty patch is a no-op)', () => {
    expect(parseWinePatch({})).toEqual({})
  })

  it('trims and accepts a partial patch of just the touched columns', () => {
    expect(parseWinePatch({ name: '  Barolo  ' })).toEqual({ name: 'Barolo' })
    expect(parseWinePatch({ notes: '  tastes great  ' })).toEqual({ notes: 'tastes great' })
  })

  it('rejects a blank name or producer', () => {
    expect(parseWinePatch({ name: '   ' })).toBeNull()
    expect(parseWinePatch({ producer: '' })).toBeNull()
  })

  it('rejects a type outside the known enum', () => {
    expect(parseWinePatch({ type: 'orange' })).toBeNull()
  })

  it('accepts a known type', () => {
    expect(parseWinePatch({ type: 'rosé' })).toEqual({ type: 'rosé' })
  })

  it('normalizes a blank optional field to null, and accepts an explicit null', () => {
    expect(parseWinePatch({ region: '  ' })).toEqual({ region: null })
    expect(parseWinePatch({ country: null })).toEqual({ country: null })
  })

  it('rejects a non-string, non-null value for an optional field', () => {
    expect(parseWinePatch({ grape_variety: 42 })).toBeNull()
  })

  it('combines multiple fields in one patch', () => {
    expect(parseWinePatch({ name: 'Barolo', producer: 'Gaja', country: 'Italien' })).toEqual({
      name: 'Barolo',
      producer: 'Gaja',
      country: 'Italien',
    })
  })
})
