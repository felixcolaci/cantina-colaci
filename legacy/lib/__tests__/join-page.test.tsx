import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetAuthenticatedUser = vi.fn()
const mockRpc = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  createAdminClient: () => ({ rpc: mockRpc }),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

describe('JoinPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function searchParams(params: { token?: string }) {
    return Promise.resolve(params)
  }

  it('redirects to / when no token is present', async () => {
    const { default: JoinPage } = await import('../../app/(auth)/join/page')
    await JoinPage({ searchParams: searchParams({}) })
    expect(mockRedirect).toHaveBeenCalledWith('/')
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('redirects to login with the token carried in ?next= when not logged in', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: null } })
    const { default: JoinPage } = await import('../../app/(auth)/join/page')
    await JoinPage({ searchParams: searchParams({ token: 'tok-123' }) })
    expect(mockRedirect).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent('/join?token=tok-123')}`
    )
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('shows an invalid-link message for an unknown token', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'invite_not_found' } })
    const { default: JoinPage } = await import('../../app/(auth)/join/page')
    const result = await JoinPage({ searchParams: searchParams({ token: 'bad-token' }) })
    render(result as React.ReactElement)
    expect(screen.getByText(/ungültig oder abgelaufen/)).toBeInTheDocument()
    expect(mockRedirect).not.toHaveBeenCalledWith('/')
  })

  it('shows an invalid-link message for an already-used token', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'invite_already_used' } })
    const { default: JoinPage } = await import('../../app/(auth)/join/page')
    const result = await JoinPage({ searchParams: searchParams({ token: 'used-token' }) })
    render(result as React.ReactElement)
    expect(screen.getByText(/ungültig oder abgelaufen/)).toBeInTheDocument()
    expect(mockRedirect).not.toHaveBeenCalledWith('/')
  })

  it('shows an invalid-link message for an expired token', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'invite_expired' } })
    const { default: JoinPage } = await import('../../app/(auth)/join/page')
    const result = await JoinPage({ searchParams: searchParams({ token: 'expired-token' }) })
    render(result as React.ReactElement)
    expect(screen.getByText(/ungültig oder abgelaufen/)).toBeInTheDocument()
    expect(mockRedirect).not.toHaveBeenCalledWith('/')
  })

  it('redeems a valid token and redirects to / on success', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockRpc.mockResolvedValueOnce({ data: 'fam-1', error: null })
    const { default: JoinPage } = await import('../../app/(auth)/join/page')
    await JoinPage({ searchParams: searchParams({ token: 'good-token' }) })
    expect(mockRpc).toHaveBeenCalledWith('redeem_family_invite', {
      p_token: 'good-token',
      p_user_id: 'u1',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})
