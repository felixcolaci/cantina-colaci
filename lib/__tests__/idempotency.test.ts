import { describe, it, expect, vi } from 'vitest'
import { claimIdempotencyKey } from '@/lib/idempotency'

function makeAdmin(insert: ReturnType<typeof vi.fn>) {
  return { from: vi.fn(() => ({ insert })) } as unknown as Parameters<typeof claimIdempotencyKey>[0]
}

describe('claimIdempotencyKey', () => {
  it('is a no-op passthrough (returns true, never touches the DB) when key is null/undefined', async () => {
    const insert = vi.fn()
    const admin = makeAdmin(insert)

    expect(await claimIdempotencyKey(admin, null)).toBe(true)
    expect(await claimIdempotencyKey(admin, undefined)).toBe(true)
    expect(admin.from).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns true on the first claim of a key', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const admin = makeAdmin(insert)

    const result = await claimIdempotencyKey(admin, 'key-1')

    expect(result).toBe(true)
    expect(admin.from).toHaveBeenCalledWith('idempotency_keys')
    expect(insert).toHaveBeenCalledWith({ key: 'key-1' })
  })

  it('returns false when the key was already claimed (unique violation, code 23505)', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint "idempotency_keys_pkey"' },
    })
    const admin = makeAdmin(insert)

    const result = await claimIdempotencyKey(admin, 'key-1')

    expect(result).toBe(false)
  })

  it('rethrows on a genuine DB error instead of treating it as "already claimed"', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '42501', message: 'permission denied for table idempotency_keys' },
    })
    const admin = makeAdmin(insert)

    await expect(claimIdempotencyKey(admin, 'key-1')).rejects.toThrow(
      'permission denied for table idempotency_keys'
    )
  })
})
