import { describe, it, expect, vi, beforeEach } from 'vitest'

// NOTE on scope: `lib/__tests__/onboarding.test.ts` already covers
// `createFamilyAndCellar`'s missing-field validation, the RPC error path, and
// the trimmed-values success/redirect path. This file intentionally does not
// repeat those — it covers the branches that file leaves untested: the
// unauthenticated early-exit (there is no family/cellar/wine ownership chain
// to check here, since onboarding *creates* the family, so the closest
// equivalent "rejection" branch is the auth guard), and the name
// length/whitespace edge cases in the trim/slice(0, 60) validation.

const mockGetAuthenticatedUser = vi.fn()
const mockRpc = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
  getAuthenticatedUser: mockGetAuthenticatedUser,
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

// Dynamic import (not a static top-level one) to match the convention used
// by lib/__tests__/onboarding.test.ts and lib/__tests__/join-page.test.tsx:
// the mock factory above reads `mockGetAuthenticatedUser` directly (not
// behind a closure), so it must not be evaluated before that const is
// initialized — a static import gets hoisted ahead of it.
async function loadAction() {
  return (await import('../onboarding')).createFamilyAndCellar
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('createFamilyAndCellar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthenticatedUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockRpc.mockResolvedValue({ data: [{ family_id: 'f1', cellar_id: 'c1' }], error: null })
  })

  it('rejects an unauthenticated caller before calling the RPC', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce({ data: { user: null } })
    const createFamilyAndCellar = await loadAction()

    await expect(
      createFamilyAndCellar(formData({ familyName: 'Colaci', cellarName: 'Keller' }))
    ).rejects.toThrow()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only familyName the same as a missing one', async () => {
    const createFamilyAndCellar = await loadAction()
    await expect(
      createFamilyAndCellar(formData({ familyName: '   ', cellarName: 'Keller' }))
    ).rejects.toThrow('Bitte Familien- und Kellernamen angeben')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only cellarName the same as a missing one', async () => {
    const createFamilyAndCellar = await loadAction()
    await expect(
      createFamilyAndCellar(formData({ familyName: 'Colaci', cellarName: '   ' }))
    ).rejects.toThrow('Bitte Familien- und Kellernamen angeben')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('truncates names longer than 60 characters before calling the RPC', async () => {
    const createFamilyAndCellar = await loadAction()
    const longFamilyName = 'F'.repeat(70)
    const longCellarName = 'C'.repeat(70)

    await createFamilyAndCellar(formData({ familyName: longFamilyName, cellarName: longCellarName }))

    expect(mockRpc).toHaveBeenCalledWith('create_family_and_cellar', {
      p_user_id: 'u1',
      p_family_name: 'F'.repeat(60),
      p_cellar_name: 'C'.repeat(60),
    })
  })
})
