import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { createAdminClient } from '@/lib/supabase/server'
import { signPhotoPath, signPhotoPaths } from '../wine-photos'

const mockCreateSignedUrl = vi.fn()
const mockCreateSignedUrls = vi.fn()
const mockStorageFrom = vi.fn((bucket: string) => {
  if (bucket !== 'wine-photos') throw new Error(`unexpected bucket: ${bucket}`)
  return { createSignedUrl: mockCreateSignedUrl, createSignedUrls: mockCreateSignedUrls }
})

const admin = { storage: { from: mockStorageFrom } } as unknown as ReturnType<typeof createAdminClient>

describe('signPhotoPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('signs a path and returns the signed URL', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://proj.supabase.co/storage/v1/object/sign/wine-photos/demo/brunello.jpg?token=abc' },
      error: null,
    })

    const url = await signPhotoPath(admin, 'demo/brunello.jpg')

    expect(mockStorageFrom).toHaveBeenCalledWith('wine-photos')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('demo/brunello.jpg', 3600)
    expect(url).toBe('https://proj.supabase.co/storage/v1/object/sign/wine-photos/demo/brunello.jpg?token=abc')
  })

  it('respects a custom TTL', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/y' }, error: null })

    await signPhotoPath(admin, 'demo/brunello.jpg', 120)

    expect(mockCreateSignedUrl).toHaveBeenCalledWith('demo/brunello.jpg', 120)
  })

  it('degrades to null (instead of throwing) when signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'object not found' } })

    const url = await signPhotoPath(admin, 'families/f1/wines/missing.jpg')

    expect(url).toBeNull()
  })
})

describe('signPhotoPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns an empty map without calling the API when given no paths', async () => {
    const result = await signPhotoPaths(admin, [])

    expect(mockCreateSignedUrls).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it('de-dupes paths before signing and maps each path to its signed URL', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        { error: null, path: 'demo/brunello.jpg', signedUrl: 'https://x/demo/brunello.jpg?token=a' },
        { error: null, path: 'demo/barolo.jpg', signedUrl: 'https://x/demo/barolo.jpg?token=b' },
      ],
      error: null,
    })

    const result = await signPhotoPaths(admin, ['demo/brunello.jpg', 'demo/barolo.jpg', 'demo/brunello.jpg'])

    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['demo/brunello.jpg', 'demo/barolo.jpg'], 3600)
    expect(result.get('demo/brunello.jpg')).toBe('https://x/demo/brunello.jpg?token=a')
    expect(result.get('demo/barolo.jpg')).toBe('https://x/demo/barolo.jpg?token=b')
    expect(result.size).toBe(2)
  })

  it('omits entries that individually failed to sign, keeping the ones that succeeded', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        { error: null, path: 'demo/brunello.jpg', signedUrl: 'https://x/demo/brunello.jpg?token=a' },
        { error: 'not found', path: 'demo/missing.jpg', signedUrl: null },
      ],
      error: null,
    })

    const result = await signPhotoPaths(admin, ['demo/brunello.jpg', 'demo/missing.jpg'])

    expect(result.get('demo/brunello.jpg')).toBe('https://x/demo/brunello.jpg?token=a')
    expect(result.has('demo/missing.jpg')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('returns an empty map (instead of throwing) when the whole batch call fails', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: { message: 'network error' } })

    const result = await signPhotoPaths(admin, ['demo/brunello.jpg'])

    expect(result.size).toBe(0)
  })
})
