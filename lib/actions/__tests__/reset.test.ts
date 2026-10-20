import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarsEq = vi.fn()
const mockWinesEq = vi.fn()
const mockWinesDeleteIn = vi.fn()
const mockSkusSelectIn = vi.fn()
const mockSkusDeleteIn = vi.fn()
const mockWinePhotosSelectIn = vi.fn()
const mockTastingsDeleteIn = vi.fn()
const mockTripsDeleteEq = vi.fn()
const mockLocationsDeleteEq = vi.fn()

const mockStorageRemove = vi.fn()
const mockStorageFrom = vi.fn(() => ({ remove: mockStorageRemove }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'cellars') {
    return {
      select: () => ({
        eq: mockCellarsEq,
      }),
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
  if (table === 'wine_photos') {
    return { select: () => ({ in: mockWinePhotosSelectIn }) }
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
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom, storage: { from: mockStorageFrom } })),
}))

// Mirrors real Next.js behavior: redirect() throws rather than returning, so
// code after it never runs (same rationale as demo.test.ts).
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path)
    const err = new Error(`NEXT_REDIRECT: ${path}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${path};307;`
    throw err
  },
}))

import { resetCellar, resetFamily } from '../reset'

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

// cellars.select().eq() is awaited directly in resetFamily (a list query)
// but chained with .order().limit().maybeSingle() in resetCellar (a single
// most-recently-created-cellar lookup) -- so mockCellarsEq's return shape is
// configured per test to match whichever action is under test.
function cellarsEqForSingle(result: { data: unknown; error: unknown }) {
  mockCellarsEq.mockReturnValue({
    order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve(result) }) }),
  })
}
function cellarsEqForList(result: { data: unknown; error: unknown }) {
  mockCellarsEq.mockReturnValue(Promise.resolve(result))
}

describe('resetCellar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('redirects to /login without touching any data when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    await expect(resetCellar(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockWinesDeleteIn).not.toHaveBeenCalled()
  })

  it('redirects to /onboarding when the caller has no family membership', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await expect(resetCellar(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/onboarding')
    expect(mockWinesDeleteIn).not.toHaveBeenCalled()
  })

  it('rejects a non-owner member', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'member' }, error: null,
    })

    await expect(resetCellar(makeFormData())).rejects.toThrow(
      'Nur der Owner kann den Keller zurücksetzen'
    )

    expect(mockWinesDeleteIn).not.toHaveBeenCalled()
  })

  it('redirects to / when the family has no cellar', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner' }, error: null,
    })
    cellarsEqForSingle({ data: null, error: null })

    await expect(resetCellar(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/')
    expect(mockWinesDeleteIn).not.toHaveBeenCalled()
  })

  it('rejects a confirm text that does not match the cellar name', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner' }, error: null,
    })
    cellarsEqForSingle({ data: { id: 'cellar-1', name: 'Meine Cantina' }, error: null })

    await expect(
      resetCellar(makeFormData({ confirm: 'wrong' }))
    ).rejects.toThrow('Bestätigungstext stimmt nicht mit dem Namen des Kellers überein')

    expect(mockWinesEq).not.toHaveBeenCalled()
  })

  it('on the happy path: purges family-owned photos from storage, cascades the delete, and redirects', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner' }, error: null,
    })
    cellarsEqForSingle({ data: { id: 'cellar-1', name: 'Meine Cantina' }, error: null })
    mockWinesEq.mockResolvedValueOnce({ data: [{ id: 'wine-1' }, { id: 'wine-2' }], error: null })
    mockSkusSelectIn.mockResolvedValueOnce({
      data: [
        { id: 'sku-1', photo_path: 'families/fam-1/wines/wine-1/a.jpg' },
        { id: 'sku-2', photo_path: 'demo/shared.jpg' },
      ],
      error: null,
    })
    mockWinePhotosSelectIn.mockResolvedValueOnce({
      data: [{ path: 'families/fam-1/wines/wine-2/b.jpg' }],
      error: null,
    })
    mockStorageRemove.mockResolvedValueOnce({ error: null })
    mockTastingsDeleteIn.mockResolvedValueOnce({ error: null })
    mockSkusDeleteIn.mockResolvedValueOnce({ error: null })
    mockWinesDeleteIn.mockResolvedValueOnce({ error: null })
    mockTripsDeleteEq.mockResolvedValueOnce({ error: null })
    mockLocationsDeleteEq.mockResolvedValueOnce({ error: null })

    await expect(
      resetCellar(makeFormData({ confirm: 'Meine Cantina' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockWinesEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockSkusSelectIn).toHaveBeenCalledWith('wine_id', ['wine-1', 'wine-2'])
    expect(mockWinePhotosSelectIn).toHaveBeenCalledWith('wine_id', ['wine-1', 'wine-2'])
    // The demo/ path is excluded -- never deleted since it's shared across cellars.
    expect(mockStorageFrom).toHaveBeenCalledWith('wine-photos')
    expect(mockStorageRemove).toHaveBeenCalledWith([
      'families/fam-1/wines/wine-1/a.jpg',
      'families/fam-1/wines/wine-2/b.jpg',
    ])
    expect(mockTastingsDeleteIn).toHaveBeenCalledWith('cellar_entry_id', ['sku-1', 'sku-2'])
    expect(mockSkusDeleteIn).toHaveBeenCalledWith('id', ['sku-1', 'sku-2'])
    expect(mockWinesDeleteIn).toHaveBeenCalledWith('id', ['wine-1', 'wine-2'])
    expect(mockTripsDeleteEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockLocationsDeleteEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
  })

  it('on an empty cellar: skips wine/sku/photo cleanup but still clears trips and locations', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner' }, error: null,
    })
    cellarsEqForSingle({ data: { id: 'cellar-1', name: 'Meine Cantina' }, error: null })
    mockWinesEq.mockResolvedValueOnce({ data: [], error: null })
    mockTripsDeleteEq.mockResolvedValueOnce({ error: null })
    mockLocationsDeleteEq.mockResolvedValueOnce({ error: null })

    await expect(
      resetCellar(makeFormData({ confirm: 'Meine Cantina' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockSkusSelectIn).not.toHaveBeenCalled()
    expect(mockStorageRemove).not.toHaveBeenCalled()
    expect(mockTripsDeleteEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockLocationsDeleteEq).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
  })
})

describe('resetFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('redirects to /login without touching any data when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    await expect(resetFamily(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockWinesDeleteIn).not.toHaveBeenCalled()
  })

  it('rejects a non-owner member', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'member', families: { name: 'Colaci' } }, error: null,
    })

    await expect(resetFamily(makeFormData())).rejects.toThrow(
      'Nur der Owner kann die Familie zurücksetzen'
    )

    expect(mockWinesDeleteIn).not.toHaveBeenCalled()
  })

  it('rejects a confirm text that does not match the family name', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner', families: { name: 'Colaci' } }, error: null,
    })

    await expect(
      resetFamily(makeFormData({ confirm: 'wrong' }))
    ).rejects.toThrow('Bestätigungstext stimmt nicht mit dem Namen der Familie überein')

    expect(mockCellarsEq).not.toHaveBeenCalled()
  })

  it('on the happy path: wipes every cellar belonging to the family and redirects', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { family_id: 'fam-1', role: 'owner', families: { name: 'Colaci' } }, error: null,
    })
    cellarsEqForList({ data: [{ id: 'cellar-1' }, { id: 'cellar-2' }], error: null })
    mockWinesEq
      .mockResolvedValueOnce({ data: [{ id: 'wine-1' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    mockSkusSelectIn.mockResolvedValueOnce({
      data: [{ id: 'sku-1', photo_path: 'families/fam-1/wines/wine-1/a.jpg' }], error: null,
    })
    mockWinePhotosSelectIn.mockResolvedValueOnce({ data: [], error: null })
    mockStorageRemove.mockResolvedValueOnce({ error: null })
    mockTastingsDeleteIn.mockResolvedValueOnce({ error: null })
    mockSkusDeleteIn.mockResolvedValueOnce({ error: null })
    mockWinesDeleteIn.mockResolvedValueOnce({ error: null })
    mockTripsDeleteEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
    mockLocationsDeleteEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    await expect(
      resetFamily(makeFormData({ confirm: 'Colaci' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockWinesEq).toHaveBeenNthCalledWith(1, 'cellar_id', 'cellar-1')
    expect(mockWinesEq).toHaveBeenNthCalledWith(2, 'cellar_id', 'cellar-2')
    expect(mockStorageRemove).toHaveBeenCalledWith(['families/fam-1/wines/wine-1/a.jpg'])
    expect(mockWinesDeleteIn).toHaveBeenCalledWith('id', ['wine-1'])
    expect(mockTripsDeleteEq).toHaveBeenNthCalledWith(1, 'cellar_id', 'cellar-1')
    expect(mockTripsDeleteEq).toHaveBeenNthCalledWith(2, 'cellar_id', 'cellar-2')
    expect(mockLocationsDeleteEq).toHaveBeenNthCalledWith(1, 'cellar_id', 'cellar-1')
    expect(mockLocationsDeleteEq).toHaveBeenNthCalledWith(2, 'cellar_id', 'cellar-2')
    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
  })
})
