import { describe, it, expect, vi } from 'vitest'
import { requireApiUserFromCookie, ApiAuthError } from '../auth'

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}))

describe('requireApiUserFromCookie', () => {
  it('resolves the user from a valid session cookie', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    const user = await requireApiUserFromCookie()

    expect(user).toEqual({ id: 'u1' })
  })

  it('throws ApiAuthError when there is no session cookie', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(requireApiUserFromCookie()).rejects.toThrow(ApiAuthError)
  })

  it('throws ApiAuthError when the cookie session is invalid/expired', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } })

    await expect(requireApiUserFromCookie()).rejects.toThrow(ApiAuthError)
  })
})
