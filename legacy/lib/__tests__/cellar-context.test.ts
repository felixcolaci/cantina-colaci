import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockGetAuthenticatedUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
  getAuthenticatedUser: mockGetAuthenticatedUser,
}))

function mockRpcResult(data: { family_id: string; cellar_id: string | null } | null) {
  mockRpc.mockReturnValueOnce({
    maybeSingle: () => Promise.resolve({ data, error: null }),
  })
}

// getCellarContext is wrapped in React.cache(), which memoizes by call
// signature for the module's lifetime outside of a real Next.js request
// scope. Re-importing the module fresh per test (via resetModules) avoids
// the second test seeing the first test's cached result.
describe('getCellarContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns null when there is no authenticated user', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: null } })
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns null when the user has no family membership', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    mockRpcResult(null)
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toBeNull()
  })

  it('returns familyId with null cellarId when membership exists but no cellar yet', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    mockRpcResult({ family_id: 'fam-1', cellar_id: null })
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toEqual({ userId: 'u1', email: 'a@b.com', familyId: 'fam-1', cellarId: null })
  })

  it('returns full context when membership and cellar exist', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    mockRpcResult({ family_id: 'fam-1', cellar_id: 'cellar-1' })
    const { getCellarContext } = await import('../cellar-context')
    const result = await getCellarContext()
    expect(result).toEqual({ userId: 'u1', email: 'a@b.com', familyId: 'fam-1', cellarId: 'cellar-1' })
    expect(mockRpc).toHaveBeenCalledWith('get_cellar_context', { p_user_id: 'u1' })
  })
})
