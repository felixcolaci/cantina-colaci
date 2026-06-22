import { describe, it, expect } from 'vitest'
import { WINE_COUNTRIES, WINE_REGIONS, GRAPE_VARIETIES } from '../wine-data'

describe('WINE_COUNTRIES', () => {
  it('contains Italien', () => {
    expect(WINE_COUNTRIES).toContain('Italien')
  })
  it('contains Frankreich', () => {
    expect(WINE_COUNTRIES).toContain('Frankreich')
  })
  it('has at least 10 entries', () => {
    expect(WINE_COUNTRIES.length).toBeGreaterThanOrEqual(10)
  })
})

describe('WINE_REGIONS', () => {
  it('contains Italian regions under key "Italien"', () => {
    expect(WINE_REGIONS['Italien']).toContain('Toskana')
    expect(WINE_REGIONS['Italien']).toContain('Piemont')
    expect(WINE_REGIONS['Italien']).toContain('Venetien')
  })
  it('contains French regions under key "Frankreich"', () => {
    expect(WINE_REGIONS['Frankreich']).toContain('Bordeaux')
    expect(WINE_REGIONS['Frankreich']).toContain('Burgund')
  })
  it('every country in WINE_REGIONS exists in WINE_COUNTRIES', () => {
    for (const country of Object.keys(WINE_REGIONS)) {
      expect(WINE_COUNTRIES).toContain(country)
    }
  })
})

describe('GRAPE_VARIETIES', () => {
  it('contains Sangiovese', () => {
    expect(GRAPE_VARIETIES).toContain('Sangiovese')
  })
  it('contains Riesling', () => {
    expect(GRAPE_VARIETIES).toContain('Riesling')
  })
  it('has at least 20 entries', () => {
    expect(GRAPE_VARIETIES.length).toBeGreaterThanOrEqual(20)
  })
})
