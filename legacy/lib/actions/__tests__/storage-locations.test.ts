import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarMaybeSingle = vi.fn()
const mockInsert = vi.fn()
const mockDeleteEqId = vi.fn(() => ({ eq: mockDeleteEqCellar }))
const mockDeleteEqCellar = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'cellars') {
    return { select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockCellarMaybeSingle }) }) }) }) }
  }
  if (table === 'storage_locations') {
    return {
      insert: mockInsert,
      delete: () => ({ eq: mockDeleteEqId }),
    }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

// Mirrors real Next.js behavior: redirect() throws rather than returning, so
// code after it (notably the lookups that follow the onboarding redirect)
// never runs. See the same comment in demo.test.ts for why this file can't
// reuse the repo's existing non-throwing redirect stub.
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path)
    const err = new Error(`NEXT_REDIRECT: ${path}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${path};307;`
    throw err
  },
}))

import { createLocation, deleteLocation } from '../storage-locations'

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('createLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('redirects to onboarding without inserting when the caller has no cellar', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(createLocation(makeFormData({ name: 'Keller', type: 'fridge' }))).rejects.toThrow(
      'NEXT_REDIRECT'
    )

    expect(mockRedirect).toHaveBeenCalledWith('/onboarding')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('on the happy path: inserts the location scoped to the caller cellar and redirects', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValueOnce({ data: { id: 'cellar-1' } })
    mockInsert.mockResolvedValueOnce({ error: null })

    await expect(
      createLocation(makeFormData({ name: 'Weinkühlschrank', type: 'fridge' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockInsert).toHaveBeenCalledWith({
      cellar_id: 'cellar-1',
      name: 'Weinkühlschrank',
      type: 'fridge',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/settings/locations')
  })
})

describe('deleteLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('redirects to onboarding without deleting when the caller has no cellar', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(deleteLocation(makeFormData({ id: 'loc-1' }))).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/onboarding')
    expect(mockDeleteEqId).not.toHaveBeenCalled()
  })

  it('scopes the delete to the caller own cellar, so an id from another cellar matches no row', async () => {
    // The action never looks up which cellar `id` actually belongs to — it
    // relies entirely on chaining .eq('cellar_id', <caller's own cellar>)
    // onto the delete. Whatever `id` is passed, the query must still be
    // scoped to the caller's own cellar, which is what stops a cross-cellar
    // id from matching any row in the real database.
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValueOnce({ data: { id: 'cellar-mine' } })
    mockDeleteEqCellar.mockResolvedValueOnce({ error: null })

    await expect(
      deleteLocation(makeFormData({ id: 'loc-belongs-to-other-cellar' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockDeleteEqId).toHaveBeenCalledWith('id', 'loc-belongs-to-other-cellar')
    expect(mockDeleteEqCellar).toHaveBeenCalledWith('cellar_id', 'cellar-mine')
  })

  it('on the happy path: deletes a location that belongs to the caller cellar and redirects', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValueOnce({ data: { id: 'cellar-mine' } })
    mockDeleteEqCellar.mockResolvedValueOnce({ error: null })

    await expect(deleteLocation(makeFormData({ id: 'loc-mine' }))).rejects.toThrow('NEXT_REDIRECT')

    expect(mockDeleteEqId).toHaveBeenCalledWith('id', 'loc-mine')
    expect(mockDeleteEqCellar).toHaveBeenCalledWith('cellar_id', 'cellar-mine')
    expect(mockRedirect).toHaveBeenCalledWith('/settings/locations')
  })
})
