import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hashKey } from '@/lib/mcp/auth'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockApiKeyInsert = vi.fn()
const mockApiKeyDeleteEq2 = vi.fn()
const mockApiKeyDeleteEq1 = vi.fn(() => ({ eq: mockApiKeyDeleteEq2 }))

const mockSessionFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  throw new Error(`unexpected table on session client: ${table}`)
})

const mockAdminFrom = vi.fn((table: string) => {
  if (table === 'api_keys') {
    return {
      insert: mockApiKeyInsert,
      delete: () => ({ eq: mockApiKeyDeleteEq1 }),
    }
  }
  throw new Error(`unexpected table on admin client: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser }, from: mockSessionFrom })),
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

import { generateApiKey, revokeApiKey } from '../api-keys'

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('api-keys actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1', role: 'owner' } })
    mockApiKeyInsert.mockResolvedValue({ error: null })
    mockApiKeyDeleteEq2.mockResolvedValue({ error: null })
  })

  describe('generateApiKey', () => {
    it('on a normal call by the owner: inserts a key hashed for the caller family and returns the raw key', async () => {
      const result = await generateApiKey(makeFormData({ name: 'Claude Desktop' }))

      expect(result.key).toBeTruthy()
      expect(mockApiKeyInsert).toHaveBeenCalledWith({
        family_id: 'fam-1',
        name: 'Claude Desktop',
        key_hash: hashKey(result.key),
      })
    })

    it('rejects an unauthenticated caller before inserting anything', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } })

      await expect(generateApiKey(makeFormData({ name: 'x' }))).rejects.toThrow()

      expect(mockRedirect).toHaveBeenCalledWith('/login')
      expect(mockApiKeyInsert).not.toHaveBeenCalled()
    })

    it('rejects a caller with no family membership', async () => {
      mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(generateApiKey(makeFormData({ name: 'x' }))).rejects.toThrow(
        'Nur der Familienbesitzer kann API-Schlüssel generieren.'
      )
      expect(mockApiKeyInsert).not.toHaveBeenCalled()
    })

    it('rejects a caller who is a family member but not the owner', async () => {
      mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1', role: 'member' } })

      await expect(generateApiKey(makeFormData({ name: 'x' }))).rejects.toThrow(
        'Nur der Familienbesitzer kann API-Schlüssel generieren.'
      )
      expect(mockApiKeyInsert).not.toHaveBeenCalled()
    })
  })

  describe('revokeApiKey', () => {
    it('on a normal call by the owner: deletes the key scoped to the caller family and redirects', async () => {
      await revokeApiKey(makeFormData({ id: 'key-1' }))

      expect(mockApiKeyDeleteEq1).toHaveBeenCalledWith('id', 'key-1')
      expect(mockApiKeyDeleteEq2).toHaveBeenCalledWith('family_id', 'fam-1')
      expect(mockRedirect).toHaveBeenCalledWith('/settings/api-keys')
    })

    it("scopes the delete to the caller's own family, so another family's key id can't be revoked", async () => {
      // The action never checks whether `id` actually belongs to the caller's
      // family before issuing the delete — it relies entirely on the
      // `.eq('family_id', membership.family_id)` filter to make a
      // cross-family delete a no-op. Confirm that scoping clause is always
      // present, not just the id filter.
      await revokeApiKey(makeFormData({ id: 'someone-elses-key' }))

      expect(mockApiKeyDeleteEq1).toHaveBeenCalledWith('id', 'someone-elses-key')
      expect(mockApiKeyDeleteEq2).toHaveBeenCalledWith('family_id', 'fam-1')
    })

    it('rejects an unauthenticated caller before deleting anything', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } })

      await expect(revokeApiKey(makeFormData({ id: 'key-1' }))).rejects.toThrow()

      expect(mockRedirect).toHaveBeenCalledWith('/login')
      expect(mockApiKeyDeleteEq1).not.toHaveBeenCalled()
    })

    it('rejects a caller with no family membership', async () => {
      mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(revokeApiKey(makeFormData({ id: 'key-1' }))).rejects.toThrow(
        'Nur der Familienbesitzer kann API-Schlüssel widerrufen.'
      )
      expect(mockApiKeyDeleteEq1).not.toHaveBeenCalled()
    })

    it('rejects a caller who is a family member but not the owner', async () => {
      mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1', role: 'member' } })

      await expect(revokeApiKey(makeFormData({ id: 'key-1' }))).rejects.toThrow(
        'Nur der Familienbesitzer kann API-Schlüssel widerrufen.'
      )
      expect(mockApiKeyDeleteEq1).not.toHaveBeenCalled()
    })
  })
})
