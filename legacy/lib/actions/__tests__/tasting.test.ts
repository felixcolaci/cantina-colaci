import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()
const mockMembershipMaybeSingle = vi.fn()
const mockEntryMaybeSingle = vi.fn()
const mockIdempotencyInsert = vi.fn()
const mockTastingInsert = vi.fn()
const mockSkuUpdateEq = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'skus') {
    return {
      select: () => ({ eq: () => ({ maybeSingle: mockEntryMaybeSingle }) }),
      update: () => ({ eq: mockSkuUpdateEq }),
    }
  }
  if (table === 'idempotency_keys') {
    return { insert: mockIdempotencyInsert }
  }
  if (table === 'tastings') {
    return { insert: mockTastingInsert }
  }
  throw new Error(`unexpected table: ${table}`)
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

import { openBottle } from '../tasting'

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('cellar_entry_id', 'sku-1')
  fd.set('date', '2026-01-01')
  fd.set('rating', '4')
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('openBottle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockEntryMaybeSingle.mockResolvedValue({
      data: {
        id: 'sku-1',
        quantity: 3,
        wine_id: 'wine-1',
        wines: { cellars: { family_id: 'fam-1' } },
      },
    })
    mockIdempotencyInsert.mockResolvedValue({ error: null })
    mockTastingInsert.mockResolvedValue({ error: null })
    mockSkuUpdateEq.mockResolvedValue({ error: null })
  })

  it('on a normal first call: inserts the tasting, decrements quantity, and redirects', async () => {
    await openBottle(makeFormData({ __idempotency_key: 'key-1' }))

    expect(mockIdempotencyInsert).toHaveBeenCalledWith({ key: 'key-1' })
    expect(mockTastingInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cellar_entry_id: 'sku-1', user_id: 'user-1', rating: 4 })
    )
    expect(mockSkuUpdateEq).toHaveBeenCalledWith('id', 'sku-1')
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('without an idempotency key: behaves exactly as before (no-op passthrough)', async () => {
    await openBottle(makeFormData())

    expect(mockIdempotencyInsert).not.toHaveBeenCalled()
    expect(mockTastingInsert).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('on a duplicate idempotency key: skips the mutation but still redirects as success', async () => {
    mockIdempotencyInsert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    await openBottle(makeFormData({ __idempotency_key: 'dup-key' }))

    expect(mockTastingInsert).not.toHaveBeenCalled()
    expect(mockSkuUpdateEq).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
  })

  it('still enforces the family ownership check even with a duplicate idempotency key', async () => {
    mockEntryMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'sku-1',
        quantity: 3,
        wine_id: 'wine-1',
        wines: { cellars: { family_id: 'some-other-family' } },
      },
    })

    await expect(
      openBottle(makeFormData({ __idempotency_key: 'dup-key' }))
    ).rejects.toThrow('Unauthorized')

    expect(mockIdempotencyInsert).not.toHaveBeenCalled()
  })
})
