import { describe, it, expect } from 'vitest'
import { parseApiKeyInsert } from '../api-key'

describe('parseApiKeyInsert', () => {
  it('accepts a valid name, trimmed', () => {
    expect(parseApiKeyInsert({ name: '  Claude Desktop  ' })).toEqual({ name: 'Claude Desktop' })
  })

  it('caps the name at 100 chars', () => {
    expect(parseApiKeyInsert({ name: 'x'.repeat(150) })).toEqual({ name: 'x'.repeat(100) })
  })

  it('rejects a missing, blank, or non-string name', () => {
    expect(parseApiKeyInsert({})).toBeNull()
    expect(parseApiKeyInsert({ name: '   ' })).toBeNull()
    expect(parseApiKeyInsert({ name: 42 })).toBeNull()
  })

  it('rejects a non-object body', () => {
    expect(parseApiKeyInsert(null)).toBeNull()
    expect(parseApiKeyInsert('nope')).toBeNull()
  })
})
