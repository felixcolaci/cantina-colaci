import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarMaybeSingle = vi.fn()
const mockTripMaybeSingle = vi.fn()
const mockStorageLocMaybeSingle = vi.fn()
const mockIdempotencyInsert = vi.fn()
const mockWinesCountEq = vi.fn()
const mockWinesInsertSingle = vi.fn()
const mockSkuInsert = vi.fn()

const mockWinesUpdateEq2 = vi.fn()
const mockWinesUpdateEq1 = vi.fn(() => ({ eq: mockWinesUpdateEq2 }))
const mockWinesUpdate = vi.fn(() => ({ eq: mockWinesUpdateEq1 }))

// getFeatureFlags() runs on a separate `createClient()` (non-admin) instance.
const mockFamiliesMaybeSingle = vi.fn()
const mockOverridesEq = vi.fn()

const mockClientFrom = vi.fn((table: string) => {
  if (table === 'families') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockFamiliesMaybeSingle }) }) }
  }
  if (table === 'feature_flag_overrides') {
    return { select: () => ({ eq: mockOverridesEq }) }
  }
  throw new Error(`unexpected client table: ${table}`)
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
    return {
      select: (_cols: unknown, opts?: { count?: string }) => {
        if (opts?.count) return { eq: mockWinesCountEq }
        throw new Error('unexpected wines.select call')
      },
      insert: () => ({ select: () => ({ single: mockWinesInsertSingle }) }),
      update: mockWinesUpdate,
    }
  }
  if (table === 'trips') {
    return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockTripMaybeSingle }) }) }) }
  }
  if (table === 'storage_locations') {
    return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockStorageLocMaybeSingle }) }) }) }
  }
  if (table === 'skus') {
    return { insert: mockSkuInsert }
  }
  if (table === 'idempotency_keys') {
    return { insert: mockIdempotencyInsert }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser }, from: mockClientFrom })),
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    storage: { from: vi.fn(() => { throw new Error('unexpected storage.from call') }) },
  })),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

import { addWine, updateWine } from '../wine'

function throwOnNextRedirect() {
  mockRedirect.mockImplementationOnce(() => {
    throw new Error('NEXT_REDIRECT')
  })
}

function makeAddFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('name', 'Barolo')
  fd.set('producer', 'Gaja')
  fd.set('type', 'red')
  fd.set('quantity', '1')
  fd.set('vintage', '2018')
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('addWine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValue({ data: { id: 'cellar-1' } })
    mockIdempotencyInsert.mockResolvedValue({ error: null })
    // BETA_MODE in lib/flags.ts turns every flag on by default, including
    // unlimited_cellar, so the 50-wine cap check below is skipped unless a
    // test explicitly overrides it off.
    mockFamiliesMaybeSingle.mockResolvedValue({ data: { plan: 'free' } })
    mockOverridesEq.mockResolvedValue({ data: [] })
    mockWinesCountEq.mockResolvedValue({ count: 0 })
    mockWinesInsertSingle.mockResolvedValue({ data: { id: 'wine-1' }, error: null })
    mockSkuInsert.mockResolvedValue({ error: null })
  })

  it('on a normal first call: creates the wine and its sku, then redirects to the wine page', async () => {
    await addWine(makeAddFormData({ __idempotency_key: 'key-1' }))

    expect(mockIdempotencyInsert).toHaveBeenCalledWith({ key: 'key-1' })
    expect(mockWinesInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockSkuInsert).toHaveBeenCalledWith(
      expect.objectContaining({ wine_id: 'wine-1', vintage: 2018, status: 'in_stock' })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('without an idempotency key: behaves exactly as before (no-op passthrough)', async () => {
    await addWine(makeAddFormData())

    expect(mockIdempotencyInsert).not.toHaveBeenCalled()
    expect(mockWinesInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('on a duplicate idempotency key: skips creating the wine and redirects to /cellar instead', async () => {
    // Unlike openBottle (tasting.ts), addWine does not wrap the dedup check
    // in an `if (claimed) { ... }` block -- it relies on redirect() itself
    // halting execution (as it really does in Next.js), so the mock must
    // throw here too, or the test would wrongly fall through into creating
    // the wine anyway.
    mockIdempotencyInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    throwOnNextRedirect()

    await expect(addWine(makeAddFormData({ __idempotency_key: 'dup-key' }))).rejects.toThrow(
      'NEXT_REDIRECT'
    )

    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
    expect(mockWinesInsertSingle).not.toHaveBeenCalled()
    expect(mockSkuInsert).not.toHaveBeenCalled()
  })

  it('without an authenticated user: redirects to /login and never touches the database', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    throwOnNextRedirect()

    await expect(addWine(makeAddFormData())).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('without a family membership: redirects to /onboarding', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })
    throwOnNextRedirect()

    await expect(addWine(makeAddFormData())).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding')
    expect(mockWinesInsertSingle).not.toHaveBeenCalled()
  })

  it('rejects a trip_id that does not belong to the caller cellar (foreign id)', async () => {
    mockTripMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(addWine(makeAddFormData({ trip_id: 'trip-from-another-cellar' }))).rejects.toThrow(
      'Invalid trip'
    )
    expect(mockWinesInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockSkuInsert).not.toHaveBeenCalled()
  })

  it('enforces the free-plan 50-wine cap when unlimited_cellar is off', async () => {
    mockOverridesEq.mockResolvedValueOnce({ data: [{ flag: 'unlimited_cellar', enabled: false }] })
    mockWinesCountEq.mockResolvedValueOnce({ count: 50 })

    await expect(addWine(makeAddFormData())).rejects.toThrow('Limite raggiunto')
    expect(mockWinesInsertSingle).not.toHaveBeenCalled()
  })

  it('rejects an unsupported photo content type', async () => {
    const fd = makeAddFormData()
    fd.set('photo', new File(['bytes'], 'label.gif', { type: 'image/gif' }))

    await expect(addWine(fd)).rejects.toThrow('Unsupported image type')
    expect(mockSkuInsert).not.toHaveBeenCalled()
  })
})

describe('updateWine', () => {
  function makeUpdateFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData()
    fd.set('id', 'wine-1')
    fd.set('name', 'Barolo Riserva')
    fd.set('producer', 'Gaja')
    fd.set('type', 'red')
    for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
    return fd
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValue({ data: { id: 'cellar-1' } })
    mockWinesUpdateEq2.mockResolvedValue({ error: null })
  })

  it('on a normal call: updates the wine scoped to id and the caller cellar_id, then redirects', async () => {
    await updateWine(makeUpdateFormData())

    expect(mockWinesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Barolo Riserva', producer: 'Gaja', type: 'red' })
    )
    expect(mockWinesUpdateEq1).toHaveBeenCalledWith('id', 'wine-1')
    expect(mockWinesUpdateEq2).toHaveBeenCalledWith('cellar_id', 'cellar-1')
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('without an authenticated user: redirects to /login and never touches the database', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    throwOnNextRedirect()

    await expect(updateWine(makeUpdateFormData())).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects when the caller has no family membership', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(updateWine(makeUpdateFormData())).rejects.toThrow('Kein Zugriff')
    expect(mockWinesUpdate).not.toHaveBeenCalled()
  })

  it('rejects when the caller family has no cellar', async () => {
    mockCellarMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(updateWine(makeUpdateFormData())).rejects.toThrow('Kein Keller gefunden')
    expect(mockWinesUpdate).not.toHaveBeenCalled()
  })

  it('scopes the update to the caller own cellar_id, so a wine from another family is never matched', async () => {
    // updateWine has no separate wine lookup: ownership is enforced entirely
    // by chaining .eq('id', id).eq('cellar_id', cellar.id) on the update
    // itself, so a foreign wine id simply matches zero rows.
    await updateWine(makeUpdateFormData({ id: 'wine-from-another-family' }))

    expect(mockWinesUpdateEq1).toHaveBeenCalledWith('id', 'wine-from-another-family')
    expect(mockWinesUpdateEq2).toHaveBeenCalledWith('cellar_id', 'cellar-1')
  })
})
