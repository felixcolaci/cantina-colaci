import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockGetAuthenticatedUser = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
  getAuthenticatedUser: mockGetAuthenticatedUser,
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

describe('createFamilyAndCellar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthenticatedUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } })
  })

  it('throws when familyName is missing', async () => {
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await expect(
      createFamilyAndCellar(formData({ cellarName: 'Keller' }))
    ).rejects.toThrow('Bitte Familien- und Kellernamen angeben')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('throws when cellarName is missing', async () => {
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await expect(
      createFamilyAndCellar(formData({ familyName: 'Colaci' }))
    ).rejects.toThrow('Bitte Familien- und Kellernamen angeben')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('throws a generic error when the RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await expect(
      createFamilyAndCellar(formData({ familyName: 'Colaci', cellarName: 'Keller' }))
    ).rejects.toThrow('Anlegen fehlgeschlagen')
  })

  it('calls the RPC with trimmed values and redirects to / on success', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ family_id: 'f1', cellar_id: 'c1' }], error: null })
    const { createFamilyAndCellar } = await import('../actions/onboarding')
    await createFamilyAndCellar(formData({ familyName: '  Colaci  ', cellarName: '  Keller  ' }))
    expect(mockRpc).toHaveBeenCalledWith('create_family_and_cellar', {
      p_user_id: 'u1',
      p_family_name: 'Colaci',
      p_cellar_name: 'Keller',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})
