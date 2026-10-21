import { describe, it, expect } from 'vitest'
import { confirmMatches } from '../reset'

describe('confirmMatches', () => {
  it('accepts an exact match', () => {
    expect(confirmMatches({ confirm: 'Meine Cantina' }, 'Meine Cantina')).toBe(true)
  })

  it('trims surrounding whitespace before comparing', () => {
    expect(confirmMatches({ confirm: '  Meine Cantina  ' }, 'Meine Cantina')).toBe(true)
  })

  it('rejects a mismatch, including a different case', () => {
    expect(confirmMatches({ confirm: 'meine cantina' }, 'Meine Cantina')).toBe(false)
    expect(confirmMatches({ confirm: 'Falscher Name' }, 'Meine Cantina')).toBe(false)
  })

  it('rejects a missing confirm field or a non-object body', () => {
    expect(confirmMatches({}, 'Meine Cantina')).toBe(false)
    expect(confirmMatches(null, 'Meine Cantina')).toBe(false)
    expect(confirmMatches('nope', 'Meine Cantina')).toBe(false)
  })

  it('rejects a non-string confirm value', () => {
    expect(confirmMatches({ confirm: 42 }, 'Meine Cantina')).toBe(false)
  })
})
