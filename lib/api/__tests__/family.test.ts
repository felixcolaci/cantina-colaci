import { describe, it, expect } from 'vitest'
import { parseFamilyMemberPatch, requireOwnerRole } from '../family'
import { ApiAuthError } from '../auth'

describe('parseFamilyMemberPatch', () => {
  it('accepts a display_name string, trimmed and capped at 40 chars', () => {
    expect(parseFamilyMemberPatch({ display_name: '  Felix  ' })).toEqual({ display_name: 'Felix' })
    expect(parseFamilyMemberPatch({ display_name: 'x'.repeat(50) })).toEqual({ display_name: 'x'.repeat(40) })
  })

  it('treats null or a blank string as clearing the name', () => {
    expect(parseFamilyMemberPatch({ display_name: null })).toEqual({ display_name: null })
    expect(parseFamilyMemberPatch({ display_name: '   ' })).toEqual({ display_name: null })
  })

  it('rejects a body without display_name, or a non-object body', () => {
    expect(parseFamilyMemberPatch({})).toBeNull()
    expect(parseFamilyMemberPatch(null)).toBeNull()
    expect(parseFamilyMemberPatch('nope')).toBeNull()
  })

  it('rejects a wrong-typed display_name', () => {
    expect(parseFamilyMemberPatch({ display_name: 42 })).toBeNull()
  })
})

describe('requireOwnerRole', () => {
  it('passes for an owner', () => {
    expect(() => requireOwnerRole({ familyId: 'f', role: 'owner' })).not.toThrow()
  })

  it('throws a 403 ApiAuthError for a member', () => {
    try {
      requireOwnerRole({ familyId: 'f', role: 'member' })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiAuthError)
      expect((err as ApiAuthError).status).toBe(403)
    }
  })
})
