import { describe, it, expect } from 'vitest'
import { DEMO_WINES, DEMO_STORAGE_LOCATIONS, DEMO_TRIP } from '../seed/demo-data'

describe('demo seed data', () => {
  it('has 6 wines', () => {
    expect(DEMO_WINES).toHaveLength(6)
  })

  it('covers all four wine types', () => {
    const types = new Set(DEMO_WINES.map(w => w.type))
    expect(types).toContain('red')
    expect(types).toContain('white')
    expect(types).toContain('rosé')
    expect(types).toContain('sparkling')
  })

  it('has 2 storage locations', () => {
    expect(DEMO_STORAGE_LOCATIONS).toHaveLength(2)
  })

  it('all storageLocationIndex values are valid', () => {
    DEMO_WINES.forEach(w => {
      expect(w.storageLocationIndex).toBeGreaterThanOrEqual(0)
      expect(w.storageLocationIndex).toBeLessThan(DEMO_STORAGE_LOCATIONS.length)
    })
  })

  it('has 2 pre-recorded tastings', () => {
    const tastings = DEMO_WINES.filter(w => w.tasting !== null)
    expect(tastings).toHaveLength(2)
  })

  it('all ratings are between 1 and 10', () => {
    DEMO_WINES.filter(w => w.tasting).forEach(w => {
      expect(w.tasting!.rating).toBeGreaterThanOrEqual(1)
      expect(w.tasting!.rating).toBeLessThanOrEqual(10)
    })
  })

  it('all wines have a demoPhotoPath under demo/', () => {
    DEMO_WINES.forEach(w => {
      expect(w.demoPhotoPath).toMatch(/^demo\/[a-z-]+\.jpg$/)
    })
  })
})
