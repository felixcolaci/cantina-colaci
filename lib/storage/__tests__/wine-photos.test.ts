import { describe, it, expect } from 'vitest'
import {
  isPhotoPathOwnedByFamily, isDemoPhotoPath, buildWinePhotoPath, buildDiscoveryPhotoPath,
  isValidPhotoPath, isUuid,
} from '../wine-photos'

const FAMILY_ID = '11111111-1111-1111-1111-111111111111'
const WINE_ID = '22222222-2222-2222-2222-222222222222'
const PHOTO_ID = '33333333-3333-3333-3333-333333333333'

describe('buildWinePhotoPath', () => {
  it('builds a path under the family prefix that isPhotoPathOwnedByFamily accepts', () => {
    const path = buildWinePhotoPath('f1', 'w1', 'p1', 'jpg')

    expect(path).toBe('families/f1/wines/w1/p1.jpg')
    expect(isPhotoPathOwnedByFamily(path, 'f1')).toBe(true)
    expect(isPhotoPathOwnedByFamily(path, 'OTHER_FAMILY')).toBe(false)
  })
})

describe('isPhotoPathOwnedByFamily / isDemoPhotoPath', () => {
  it('accepts a path under the given family, rejects any other family', () => {
    expect(isPhotoPathOwnedByFamily('families/f1/wines/w1/a.jpg', 'f1')).toBe(true)
    expect(isPhotoPathOwnedByFamily('families/f2/wines/w1/a.jpg', 'f1')).toBe(false)
  })

  it('identifies demo/ paths regardless of family', () => {
    expect(isDemoPhotoPath('demo/brunello.jpg')).toBe(true)
    expect(isDemoPhotoPath('families/f1/wines/w1/a.jpg')).toBe(false)
  })
})

describe('isUuid', () => {
  it('accepts a canonical UUID', () => {
    expect(isUuid(WINE_ID)).toBe(true)
  })

  it('rejects a non-UUID, including one carrying a path-traversal attempt', () => {
    expect(isUuid('../../../etc/passwd')).toBe(false)
    expect(isUuid('w1')).toBe(false)
    expect(isUuid('')).toBe(false)
  })
})

describe('isValidPhotoPath', () => {
  it('accepts a well-formed wine photo path', () => {
    expect(isValidPhotoPath(buildWinePhotoPath(FAMILY_ID, WINE_ID, PHOTO_ID, 'jpg'))).toBe(true)
  })

  it('accepts a well-formed discovery photo path', () => {
    expect(isValidPhotoPath(buildDiscoveryPhotoPath(FAMILY_ID, WINE_ID, PHOTO_ID, 'png'))).toBe(true)
  })

  it('accepts a well-formed demo path', () => {
    expect(isValidPhotoPath('demo/brunello.jpg')).toBe(true)
  })

  it('rejects a path-traversal attempt smuggled into an id segment, even inside the right family prefix', () => {
    const traversal = `families/${FAMILY_ID}/wines/../../../demo/secret.jpg`
    expect(isValidPhotoPath(traversal)).toBe(false)
    // isPhotoPathOwnedByFamily alone (a bare prefix check) would wrongly let this through --
    // this is exactly the gap isValidPhotoPath exists to close.
    expect(isPhotoPathOwnedByFamily(traversal, FAMILY_ID)).toBe(true)
  })

  it('rejects an extra path segment', () => {
    expect(isValidPhotoPath(`families/${FAMILY_ID}/wines/${WINE_ID}/sub/${PHOTO_ID}.jpg`)).toBe(false)
  })

  it('rejects a disallowed extension', () => {
    expect(isValidPhotoPath(`families/${FAMILY_ID}/wines/${WINE_ID}/${PHOTO_ID}.svg`)).toBe(false)
  })

  it('rejects a non-UUID id segment', () => {
    expect(isValidPhotoPath(`families/${FAMILY_ID}/wines/not-a-uuid/${PHOTO_ID}.jpg`)).toBe(false)
  })

  it('rejects a demo path with a nested segment', () => {
    expect(isValidPhotoPath('demo/../families/f1/secret.jpg')).toBe(false)
  })
})
