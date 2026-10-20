import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarMaybeSingle = vi.fn()
const mockWineMaybeSingle = vi.fn()
const mockStorageLocMaybeSingle = vi.fn()
const mockIdempotencyInsert = vi.fn()
const mockSkuInsert = vi.fn()

const mockSkuUpdateEq2 = vi.fn()
const mockSkuUpdateEq1 = vi.fn(() => ({ eq: mockSkuUpdateEq2 }))
const mockSkuUpdate = vi.fn(() => ({ eq: mockSkuUpdateEq1 }))
const mockSkuPhotoMaybeSingle = vi.fn()

const mockRemove = vi.fn()
const mockStorageFrom = vi.fn((bucket: string) => {
  if (bucket !== 'wine-photos') throw new Error(`unexpected bucket: ${bucket}`)
  return { remove: mockRemove }
})

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'cellars') {
    return {
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockCellarMaybeSingle }) }) }) }),
    }
  }
  if (table === 'wines') {
    return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockWineMaybeSingle }) }) }) }
  }
  if (table === 'storage_locations') {
    return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockStorageLocMaybeSingle }) }) }) }
  }
  if (table === 'skus') {
    return {
      update: mockSkuUpdate,
      insert: mockSkuInsert,
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockSkuPhotoMaybeSingle }) }) }),
    }
  }
  if (table === 'idempotency_keys') {
    return { insert: mockIdempotencyInsert }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom, storage: { from: mockStorageFrom } })),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

import { updateSku, clearSkuPhoto, addSku } from '../skus'

function throwOnNextRedirect() {
  mockRedirect.mockImplementationOnce(() => {
    throw new Error('NEXT_REDIRECT')
  })
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('id', 'sku-1')
  fd.set('wine_id', 'wine-1')
  fd.set('quantity', '2')
  fd.set('vintage', '2020')
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('updateSku', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValue({ data: { id: 'cellar-1' } })
    mockWineMaybeSingle.mockResolvedValue({ data: { id: 'wine-1' } })
    mockSkuUpdateEq2.mockResolvedValue({ error: null })
  })

  it('on a normal call: updates the sku scoped to id and wine_id, then redirects', async () => {
    await updateSku(makeFormData())

    expect(mockSkuUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2, vintage: 2020, status: 'in_stock' })
    )
    expect(mockSkuUpdateEq1).toHaveBeenCalledWith('id', 'sku-1')
    expect(mockSkuUpdateEq2).toHaveBeenCalledWith('wine_id', 'wine-1')
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('marks the sku consumed when quantity drops to zero', async () => {
    await updateSku(makeFormData({ quantity: '0' }))

    expect(mockSkuUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'consumed' }))
  })

  it('without an authenticated user: redirects to /login and never touches the database', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    throwOnNextRedirect()

    await expect(updateSku(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects when the caller has no family membership', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(updateSku(makeFormData())).rejects.toThrow('Kein Zugriff')
    expect(mockSkuUpdate).not.toHaveBeenCalled()
  })

  it('rejects a wine_id that does not belong to the caller family cellar (foreign id)', async () => {
    mockWineMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(updateSku(makeFormData({ wine_id: 'wine-from-another-family' }))).rejects.toThrow(
      'Wein nicht gefunden'
    )
    expect(mockSkuUpdate).not.toHaveBeenCalled()
  })

  it('rejects a storage_location_id that does not belong to the caller cellar', async () => {
    mockStorageLocMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(
      updateSku(makeFormData({ storage_location_id: 'loc-from-another-cellar' }))
    ).rejects.toThrow('Ungültiger Lagerort')
    expect(mockSkuUpdate).not.toHaveBeenCalled()
  })
})

describe('clearSkuPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValue({ data: { id: 'cellar-1' } })
    mockWineMaybeSingle.mockResolvedValue({ data: { id: 'wine-1' } })
    mockSkuPhotoMaybeSingle.mockResolvedValue({ data: { photo_path: 'families/fam-1/wines/wine-1/sku-1.jpg' } })
    mockSkuUpdateEq2.mockResolvedValue({ error: null })
    mockRemove.mockResolvedValue({ error: null })
  })

  function makeClearFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData()
    fd.set('entry_id', 'sku-1')
    fd.set('wine_id', 'wine-1')
    for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
    return fd
  }

  it('on a normal call: removes the orphaned storage object, clears photo_path scoped to entry_id and wine_id, then redirects', async () => {
    await clearSkuPhoto(makeClearFormData())

    expect(mockRemove).toHaveBeenCalledWith(['families/fam-1/wines/wine-1/sku-1.jpg'])
    expect(mockSkuUpdate).toHaveBeenCalledWith({ photo_path: null })
    expect(mockSkuUpdateEq1).toHaveBeenCalledWith('id', 'sku-1')
    expect(mockSkuUpdateEq2).toHaveBeenCalledWith('wine_id', 'wine-1')
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('when the sku has no photo: skips the storage removal but still clears the column', async () => {
    mockSkuPhotoMaybeSingle.mockResolvedValueOnce({ data: { photo_path: null } })

    await clearSkuPhoto(makeClearFormData())

    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockSkuUpdate).toHaveBeenCalledWith({ photo_path: null })
  })

  it('without an authenticated user: redirects to /login and never touches the database', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    throwOnNextRedirect()

    await expect(clearSkuPhoto(makeClearFormData())).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects a wine_id that does not belong to the caller family cellar (foreign id)', async () => {
    mockWineMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(
      clearSkuPhoto(makeClearFormData({ wine_id: 'wine-from-another-family' }))
    ).rejects.toThrow('Wein nicht gefunden')
    expect(mockSkuUpdate).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
  })
})

describe('addSku', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValue({ data: { id: 'cellar-1' } })
    mockWineMaybeSingle.mockResolvedValue({ data: { id: 'wine-1' } })
    mockIdempotencyInsert.mockResolvedValue({ error: null })
    mockSkuInsert.mockResolvedValue({ error: null })
  })

  it('on a normal first call: inserts the sku and redirects to the wine page', async () => {
    await addSku(makeFormData({ __idempotency_key: 'key-1' }))

    expect(mockIdempotencyInsert).toHaveBeenCalledWith({ key: 'key-1' })
    expect(mockSkuInsert).toHaveBeenCalledWith(
      expect.objectContaining({ wine_id: 'wine-1', quantity: 2, vintage: 2020, status: 'in_stock' })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('without an idempotency key: behaves exactly as before (no-op passthrough)', async () => {
    await addSku(makeFormData())

    expect(mockIdempotencyInsert).not.toHaveBeenCalled()
    expect(mockSkuInsert).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('on a duplicate idempotency key: skips the insert but still redirects as success', async () => {
    mockIdempotencyInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    await addSku(makeFormData({ __idempotency_key: 'dup-key' }))

    expect(mockSkuInsert).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('without an authenticated user: redirects to /login and never touches the database', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    throwOnNextRedirect()

    await expect(addSku(makeFormData())).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects a wine_id that does not belong to the caller family cellar (foreign id), even with a dup key', async () => {
    mockWineMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(
      addSku(makeFormData({ wine_id: 'wine-from-another-family', __idempotency_key: 'dup-key' }))
    ).rejects.toThrow('Wein nicht gefunden')
    expect(mockIdempotencyInsert).not.toHaveBeenCalled()
    expect(mockSkuInsert).not.toHaveBeenCalled()
  })
})
