import { describe, it, expect, vi } from 'vitest'

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}))

import { compressImage } from '../image-compress'

describe('compressImage', () => {
  it('returns a File', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    const result = await compressImage(file)
    expect(result).toBeInstanceOf(File)
  })
})
