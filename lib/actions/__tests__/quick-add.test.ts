import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarMaybeSingle = vi.fn()
const mockStorageLocMaybeSingle = vi.fn()
const mockIdempotencyInsert = vi.fn()
const mockWinesCountEq = vi.fn()
const mockWinesInsertSingle = vi.fn()
const mockSkuInsert = vi.fn()

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
    }
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
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

import { quickAddWine } from '../quick-add'

function throwOnNextRedirect() {
  mockRedirect.mockImplementationOnce(() => {
    throw new Error('NEXT_REDIRECT')
  })
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('name', 'Barolo')
  fd.set('producer', 'Gaja')
  fd.set('type', 'red')
  fd.set('quantity', '1')
  fd.set('vintage', '2018')
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('quickAddWine', () => {
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

  it('on a normal first call: creates the wine and its sku, then redirects to /cellar', async () => {
    await quickAddWine(makeFormData({ __idempotency_key: 'key-1' }))

    expect(mockIdempotencyInsert).toHaveBeenCalledWith({ key: 'key-1' })
    expect(mockWinesInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockSkuInsert).toHaveBeenCalledWith(
      expect.objectContaining({ wine_id: 'wine-1', vintage: 2018, status: 'in_stock' })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
  })

  it('without an idempotency key: behaves exactly as before (no-op passthrough)', async () => {
    await quickAddWine(makeFormData())

    expect(mockIdempotencyInsert).not.toHaveBeenCalled()
    expect(mockWinesInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
  })

  it('on a duplicate idempotency key: skips creating the wine but still redirects to /cellar', async () => {
    // quickAddWine, like addWine, relies on redirect() itself halting
    // execution (real Next.js behavior) rather than wrapping the dedup
    // check in an `if (claimed) { ... }` block, so the mock must throw here
    // too or the test would wrongly fall through into creating the wine.
    mockIdempotencyInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    throwOnNextRedirect()

    await expect(quickAddWine(makeFormData({ __idempotency_key: 'dup-key' }))).rejects.toThrow(
      'NEXT_REDIRECT'
    )

    expect(mockRedirect).toHaveBeenCalledWith('/cellar')
    expect(mockWinesInsertSingle).not.toHaveBeenCalled()
    expect(mockSkuInsert).not.toHaveBeenCalled()
  })

  it('without an authenticated user: redirects to /login and never touches the database', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    throwOnNextRedirect()

    await expect(quickAddWine(makeFormData())).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('without a family membership: redirects to /onboarding', async () => {
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })
    throwOnNextRedirect()

    await expect(quickAddWine(makeFormData())).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding')
    expect(mockWinesInsertSingle).not.toHaveBeenCalled()
  })

  it('rejects a storage_location_id that does not belong to the caller cellar (foreign id)', async () => {
    mockStorageLocMaybeSingle.mockResolvedValueOnce({ data: null })

    await expect(
      quickAddWine(makeFormData({ storage_location_id: 'loc-from-another-cellar' }))
    ).rejects.toThrow('Ungültiger Lagerort')
    expect(mockWinesInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockSkuInsert).not.toHaveBeenCalled()
  })

  it('enforces the free-plan 50-wine cap when unlimited_cellar is off', async () => {
    mockOverridesEq.mockResolvedValueOnce({ data: [{ flag: 'unlimited_cellar', enabled: false }] })
    mockWinesCountEq.mockResolvedValueOnce({ count: 50 })

    await expect(quickAddWine(makeFormData())).rejects.toThrow('Limite raggiunto')
    expect(mockWinesInsertSingle).not.toHaveBeenCalled()
  })
})
