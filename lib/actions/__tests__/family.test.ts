import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockMembershipMaybeSingle = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}))

import { createFamilyInvite } from '../family'

describe('createFamilyInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(createFamilyInvite()).rejects.toThrow('Nicht eingeloggt')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('throws when the caller has no family membership', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })
    await expect(createFamilyInvite()).rejects.toThrow('Kein Familienmitglied')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('throws when the caller is a member but not the owner', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1', role: 'member' } })
    await expect(createFamilyInvite()).rejects.toThrow('Nur der Owner kann Mitglieder einladen')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('throws a user-facing error when the RPC fails', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1', role: 'owner' } })
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'not_family_owner' } })
    await expect(createFamilyInvite()).rejects.toThrow('Einladungslink konnte nicht erstellt werden.')
  })

  it('calls create_family_invite with the caller id and family id, returning the token', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1', role: 'owner' } })
    mockRpc.mockResolvedValueOnce({ data: 'generated-token-abc', error: null })

    const result = await createFamilyInvite()

    expect(mockRpc).toHaveBeenCalledWith('create_family_invite', {
      p_family_id: 'fam-1',
      p_user_id: 'u1',
    })
    expect(result).toEqual({ token: 'generated-token-abc' })
  })
})
