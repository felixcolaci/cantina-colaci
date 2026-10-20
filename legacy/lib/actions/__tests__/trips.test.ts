import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()
const mockRevalidatePath = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarMaybeSingle = vi.fn()
const mockIdempotencyInsert = vi.fn()
const mockTripInsert = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'cellars') {
    return { select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockCellarMaybeSingle }) }) }) }) }
  }
  if (table === 'idempotency_keys') {
    return { insert: mockIdempotencyInsert }
  }
  if (table === 'trips') {
    return { insert: mockTripInsert }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

// Mirrors real Next.js behavior: redirect() throws rather than returning, so
// code after it (the trip insert, revalidatePath) never runs on the early
// onboarding/login redirects. See the same comment in demo.test.ts.
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path)
    const err = new Error(`NEXT_REDIRECT: ${path}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${path};307;`
    throw err
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}))

import { createTrip } from '../trips'

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('name', 'Toskana 2026')
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('createTrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValue({ data: { id: 'cellar-1' } })
    mockIdempotencyInsert.mockResolvedValue({ error: null })
    mockTripInsert.mockResolvedValue({ error: null })
  })

  it('redirects to onboarding without inserting when the caller has no family membership', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(createTrip(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/onboarding')
    expect(mockTripInsert).not.toHaveBeenCalled()
  })

  it('redirects to login without inserting when the caller family has no cellar', async () => {
    mockCellarMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(createTrip(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockTripInsert).not.toHaveBeenCalled()
  })

  it('on a normal first call: claims the idempotency key, inserts the trip, and redirects', async () => {
    await expect(
      createTrip(
        makeFormData({
          __idempotency_key: 'key-1',
          location: 'Chianti',
          date_start: '2026-05-01',
          date_end: '15.05.2026',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockIdempotencyInsert).toHaveBeenCalledWith({ key: 'key-1' })
    expect(mockTripInsert).toHaveBeenCalledWith({
      cellar_id: 'cellar-1',
      name: 'Toskana 2026',
      location: 'Chianti',
      date_start: '2026-05-01',
      date_end: '2026-05-15',
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/trips')
    expect(mockRedirect).toHaveBeenCalledWith('/trips')
  })

  it('without an idempotency key: behaves exactly as before (no-op passthrough)', async () => {
    await expect(createTrip(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockIdempotencyInsert).not.toHaveBeenCalled()
    expect(mockTripInsert).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/trips')
  })

  it('on a duplicate idempotency key: skips the insert but still redirects as success', async () => {
    mockIdempotencyInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    await expect(createTrip(makeFormData({ __idempotency_key: 'dup-key' }))).rejects.toThrow(
      'NEXT_REDIRECT'
    )

    expect(mockTripInsert).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith('/trips')
  })
})
