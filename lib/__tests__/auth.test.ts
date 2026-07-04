import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock before importing the module under test
const mockFrom = vi.fn()
const mockAdminCreateUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: mockFrom,
    auth: { admin: { createUser: mockAdminCreateUser } },
  }),
}))

import { registerWithCode } from '../actions/auth'

function mockInviteQuery(found: boolean) {
  mockFrom.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        is: () => ({
          maybeSingle: () => Promise.resolve({ data: found ? { code: 'VALID-CODE' } : null }),
        }),
      }),
    }),
  })
}

function mockUpdateQuery() {
  mockFrom.mockReturnValueOnce({
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  })
}

describe('registerWithCode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when code is not found or already used', async () => {
    mockInviteQuery(false)
    const result = await registerWithCode('a@b.com', 'password123', 'BAD-CODE')
    expect(result).toEqual({ error: 'Ungültiger Einladungscode' })
    expect(mockAdminCreateUser).not.toHaveBeenCalled()
  })

  it('returns error when email is already registered', async () => {
    mockInviteQuery(true)
    mockAdminCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'User already registered' },
    })
    const result = await registerWithCode('existing@b.com', 'password123', 'VALID-CODE')
    expect(result).toEqual({ error: 'Diese E-Mail-Adresse ist bereits registriert' })
  })

  it('returns generic error on unexpected createUser failure', async () => {
    mockInviteQuery(true)
    mockAdminCreateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'Internal server error' },
    })
    const result = await registerWithCode('new@b.com', 'password123', 'VALID-CODE')
    expect(result).toEqual({ error: 'Registrierung fehlgeschlagen' })
  })

  it('marks code as used and returns no error on success', async () => {
    mockInviteQuery(true)
    mockAdminCreateUser.mockResolvedValueOnce({
      data: { user: { id: 'user-abc-123' } },
      error: null,
    })
    mockUpdateQuery()
    const result = await registerWithCode('new@b.com', 'password123', 'VALID-CODE')
    expect(result).toEqual({ error: null })
    // Verify code was marked used (second call to .from)
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'invitation_codes')
  })
})
