import { describe, it, expect } from 'vitest'
import { hashKey } from '../mcp/auth'

describe('hashKey', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashKey('test-api-key-123')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('is deterministic', () => {
    expect(hashKey('same-key')).toBe(hashKey('same-key'))
  })

  it('produces different hashes for different keys', () => {
    expect(hashKey('key-a')).not.toBe(hashKey('key-b'))
  })
})
