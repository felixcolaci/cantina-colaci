import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarMaybeSingle = vi.fn()
const mockWinesEq = vi.fn()
const mockWinesDeleteIn = vi.fn()
const mockSkusSelectIn = vi.fn()
const mockSkusDeleteIn = vi.fn()
const mockTastingsDeleteIn = vi.fn()
const mockTripsDeleteEq = vi.fn()
const mockLocationsDeleteEq = vi.fn()
const mockCellarUpdate = vi.fn(() => ({ eq: mockCellarUpdateEq }))
const mockCellarUpdateEq = vi.fn()
const mockFamilyUpdate = vi.fn(() => ({ eq: mockFamilyUpdateEq }))
const mockFamilyUpdateEq = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'cellars') {
    return {
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockCellarMaybeSingle }) }) }) }),
      update: mockCellarUpdate,
    }
  }
  if (table === 'wines') {
    return {
      select: () => ({ eq: mockWinesEq }),
      delete: () => ({ in: mockWinesDeleteIn }),
    }
  }
  if (table === 'skus') {
    return {
      select: () => ({ in: mockSkusSelectIn }),
      delete: () => ({ in: mockSkusDeleteIn }),
    }
  }
  if (table === 'tastings') {
    return { delete: () => ({ in: mockTastingsDeleteIn }) }
  }
  if (table === 'trips') {
    return { delete: () => ({ eq: mockTripsDeleteEq }) }
  }
  if (table === 'storage_locations') {
    return { delete: () => ({ eq: mockLocationsDeleteEq }) }
  }
  if (table === 'families') {
    return { update: mockFamilyUpdate }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

// Mirrors real Next.js behavior: redirect() throws (a NEXT_REDIRECT digest
// error) rather than returning, so code after it never runs. The other
// action test files in this repo only ever call redirect() as their final
// statement, so a non-throwing stub works there; clearDemoCellar redirects
// mid-function on its rejection branches, so a faithful stub has to throw.
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path)
    const err = new Error(`NEXT_REDIRECT: ${path}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${path};307;`
    throw err
  },
}))

import { clearDemoCellar } from '../demo'

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('clearDemoCellar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('redirects without touching any data when the caller has no family membership', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await expect(clearDemoCellar(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/')
    expect(mockCellarMaybeSingle).not.toHaveBeenCalled()
    expect(mockWinesDeleteIn).not.toHaveBeenCalled()
  })

  it('rejects a non-owner member even if the family is a demo family', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'member', families: { is_demo: true } },
      error: null,
    })

    await expect(clearDemoCellar(makeFormData())).rejects.toThrow(
      'Nur der Owner kann die Demo-Cantina zurücksetzen'
    )

    expect(mockRedirect).not.toHaveBeenCalled()
    expect(mockCellarMaybeSingle).not.toHaveBeenCalled()
  })

  it('rejects an owner whose family is not a demo family', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner', families: { is_demo: false } },
      error: null,
    })

    await expect(clearDemoCellar(makeFormData())).rejects.toThrow(
      'Diese Cantina ist keine Demo-Cantina'
    )

    expect(mockRedirect).not.toHaveBeenCalled()
    expect(mockCellarMaybeSingle).not.toHaveBeenCalled()
  })

  it('on the happy path: cascades the delete through wines/skus/tastings/trips/storage_locations and flips is_demo to false', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner', families: { is_demo: true } },
      error: null,
    })
    mockCellarMaybeSingle.mockResolvedValueOnce({ data: { id: 'cellar-1' }, error: null })
    mockWinesEq.mockResolvedValueOnce({ data: [{ id: 'wine-1' }, { id: 'wine-2' }], error: null })
    mockSkusSelectIn.mockResolvedValueOnce({ data: [{ id: 'sku-1' }], error: null })
    mockTastingsDeleteIn.mockResolvedValueOnce({ error: null })
    mockSkusDeleteIn.mockResolvedValueOnce({ error: null })
    mockWinesDeleteIn.mockResolvedValueOnce({ error: null })
    mockTripsDeleteEq.mockResolvedValueOnce({ error: null })
    mockLocationsDeleteEq.mockResolvedValueOnce({ error: null })
    mockCellarUpdateEq.mockResolvedValueOnce({ error: null })
    mockFamilyUpdateEq.mockResolvedValueOnce({ error: null })

    await expect(
      clearDemoCellar(makeFormData({ cellarName: 'Neuer Keller' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockWinesEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockSkusSelectIn).toHaveBeenCalledWith('wine_id', ['wine-1', 'wine-2'])
    expect(mockTastingsDeleteIn).toHaveBeenCalledWith('cellar_entry_id', ['sku-1'])
    expect(mockSkusDeleteIn).toHaveBeenCalledWith('id', ['sku-1'])
    expect(mockWinesDeleteIn).toHaveBeenCalledWith('id', ['wine-1', 'wine-2'])
    expect(mockTripsDeleteEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockLocationsDeleteEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockCellarUpdate).toHaveBeenCalledWith({ name: 'Neuer Keller' })
    expect(mockCellarUpdateEq).toHaveBeenCalledWith('id', 'cellar-1')
    expect(mockFamilyUpdate).toHaveBeenCalledWith({ is_demo: false })
    expect(mockFamilyUpdateEq).toHaveBeenCalledWith('id', 'fam-1')
    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
  })
})
