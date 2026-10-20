import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

const mockMembershipMaybeSingle = vi.fn()
const mockCellarMaybeSingle = vi.fn()
const mockWineMaybeSingle = vi.fn()
const mockPhotoInsert = vi.fn()
const mockPhotoSelectMaybeSingle = vi.fn()
const mockPhotoDeleteEq = vi.fn()

const mockUpload = vi.fn()
const mockRemove = vi.fn()
const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
}))

const mockFrom = vi.fn((table: string) => {
  if (table === 'family_members') {
    return { select: () => ({ eq: () => ({ maybeSingle: mockMembershipMaybeSingle }) }) }
  }
  if (table === 'cellars') {
    return {
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockCellarMaybeSingle }) }) }),
      }),
    }
  }
  if (table === 'wines') {
    return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockWineMaybeSingle }) }) }) }
  }
  if (table === 'wine_photos') {
    return {
      insert: mockPhotoInsert,
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockPhotoSelectMaybeSingle }) }) }),
      delete: () => ({ eq: mockPhotoDeleteEq }),
    }
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

import { addWinePhoto, deleteWinePhoto } from '../wine-photos'

function makePhotoFormData(overrides: Record<string, string> = {}, file: File | null = defaultFile()): FormData {
  const fd = new FormData()
  fd.set('wine_id', 'wine-1')
  if (file) fd.set('photo', file)
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

function defaultFile(): File {
  return new File(['fake-bytes'], 'label.jpg', { type: 'image/jpeg' })
}

function makeDeleteFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('wine_id', 'wine-1')
  fd.set('photo_id', 'photo-1')
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value)
  return fd
}

describe('wine-photos actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockMembershipMaybeSingle.mockResolvedValue({ data: { family_id: 'fam-1' } })
    mockCellarMaybeSingle.mockResolvedValue({ data: { id: 'cellar-1' } })
    mockWineMaybeSingle.mockResolvedValue({ data: { id: 'wine-1' } })
    mockUpload.mockResolvedValue({ error: null })
    mockPhotoInsert.mockResolvedValue({ error: null })
    mockPhotoSelectMaybeSingle.mockResolvedValue({
      data: { id: 'photo-1', path: 'families/fam-1/wines/wine-1/photo-1.jpg' },
    })
    mockPhotoDeleteEq.mockResolvedValue({ error: null })
  })

  describe('addWinePhoto', () => {
    it('on a normal upload: uploads under the caller family path, inserts the bare storage path (not a URL), and redirects', async () => {
      await addWinePhoto(makePhotoFormData())

      expect(mockStorageFrom).toHaveBeenCalledWith('wine-photos')
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(/^families\/fam-1\/wines\/wine-1\/.+\.jpg$/),
        expect.any(File),
        expect.objectContaining({ contentType: 'image/jpeg' })
      )
      expect(mockPhotoInsert).toHaveBeenCalledWith({
        wine_id: 'wine-1',
        path: expect.stringMatching(/^families\/fam-1\/wines\/wine-1\/.+\.jpg$/),
      })
      expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
    })

    it('rejects an unauthenticated caller before touching storage', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } })

      await expect(addWinePhoto(makePhotoFormData())).rejects.toThrow()

      expect(mockRedirect).toHaveBeenCalledWith('/login')
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('rejects a caller with no family membership', async () => {
      mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(addWinePhoto(makePhotoFormData())).rejects.toThrow('Kein Zugriff')

      expect(mockUpload).not.toHaveBeenCalled()
    })

    it("rejects a wine that belongs to another family (cross-family IDOR), mirroring the storage bucket's family-scoped path policy", async () => {
      // The wines lookup is filtered by the caller's own cellar_id (see
      // verifyWineOwnership in wine-photos.ts), so a wine_id from a
      // different family's cellar resolves to no row here, exactly like
      // the storage.objects path policy added in
      // 20261020120000_wine_photos_rls_storage_and_advisories.sql scopes
      // families/<family_id>/... paths to that family's members.
      mockWineMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(addWinePhoto(makePhotoFormData())).rejects.toThrow('Wein nicht gefunden')

      expect(mockUpload).not.toHaveBeenCalled()
      expect(mockPhotoInsert).not.toHaveBeenCalled()
    })

    it('rejects when the caller has no cellar yet', async () => {
      mockCellarMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(addWinePhoto(makePhotoFormData())).rejects.toThrow('Kein Keller')

      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('rejects when no photo was selected', async () => {
      await expect(addWinePhoto(makePhotoFormData({}, null))).rejects.toThrow('Kein Foto ausgewählt')
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('rejects an unsupported file type', async () => {
      const file = new File(['bytes'], 'label.gif', { type: 'image/gif' })
      await expect(addWinePhoto(makePhotoFormData({}, file))).rejects.toThrow(
        'Format nicht unterstützt (JPEG, PNG, WebP, HEIC)'
      )
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('rejects a file over the 5 MB limit', async () => {
      const file = defaultFile()
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 })
      await expect(addWinePhoto(makePhotoFormData({}, file))).rejects.toThrow('Foto zu groß (max 5 MB)')
      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('surfaces a generic error when the storage upload fails', async () => {
      mockUpload.mockResolvedValueOnce({ error: { message: 'network error' } })
      await expect(addWinePhoto(makePhotoFormData())).rejects.toThrow('Upload fehlgeschlagen')
      expect(mockPhotoInsert).not.toHaveBeenCalled()
    })
  })

  describe('deleteWinePhoto', () => {
    it('on a normal delete: removes the storage object at the stored bare path, deletes the row, and redirects', async () => {
      await deleteWinePhoto(makeDeleteFormData())

      expect(mockRemove).toHaveBeenCalledWith(['families/fam-1/wines/wine-1/photo-1.jpg'])
      expect(mockPhotoDeleteEq).toHaveBeenCalledWith('id', 'photo-1')
      expect(mockRedirect).toHaveBeenCalledWith('/wine/wine-1')
    })

    it('rejects an unauthenticated caller', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } })

      await expect(deleteWinePhoto(makeDeleteFormData())).rejects.toThrow()

      expect(mockRedirect).toHaveBeenCalledWith('/login')
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it('rejects a caller with no family membership', async () => {
      mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(deleteWinePhoto(makeDeleteFormData())).rejects.toThrow('Kein Zugriff')

      expect(mockRemove).not.toHaveBeenCalled()
    })

    it("can't delete a photo belonging to another family's wine", async () => {
      mockWineMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(deleteWinePhoto(makeDeleteFormData())).rejects.toThrow('Wein nicht gefunden')

      expect(mockPhotoSelectMaybeSingle).not.toHaveBeenCalled()
      expect(mockRemove).not.toHaveBeenCalled()
      expect(mockPhotoDeleteEq).not.toHaveBeenCalled()
    })

    it('rejects when the photo row does not exist for this wine', async () => {
      mockPhotoSelectMaybeSingle.mockResolvedValueOnce({ data: null })

      await expect(deleteWinePhoto(makeDeleteFormData())).rejects.toThrow('Foto nicht gefunden')

      expect(mockRemove).not.toHaveBeenCalled()
      expect(mockPhotoDeleteEq).not.toHaveBeenCalled()
    })
  })
})
