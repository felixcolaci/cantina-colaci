import { describe, it, expect } from 'vitest'
import { resolveFlagsFromPlan } from '../flags'

describe('resolveFlagsFromPlan', () => {
  it('override takes precedence over plan default', () => {
    const flags = resolveFlagsFromPlan('free', { advanced_stats: true })
    expect(flags.advanced_stats).toBe(true)
  })

  it('override can disable a flag that is on by default', () => {
    const flags = resolveFlagsFromPlan('pro', { social_map: false })
    expect(flags.social_map).toBe(false)
  })

  it('override can disable unlimited_cellar even in beta mode', () => {
    const flags = resolveFlagsFromPlan('free', { unlimited_cellar: false })
    expect(flags.unlimited_cellar).toBe(false)
  })

  it('business plan override enables winery_profiles', () => {
    const flags = resolveFlagsFromPlan('business', { winery_profiles: true })
    expect(flags.winery_profiles).toBe(true)
  })

  it('all flag names are present in result', () => {
    const flags = resolveFlagsFromPlan('free', {})
    const expectedKeys = [
      'mcp_integration', 'unlimited_cellar', 'advanced_stats',
      'shared_tours', 'winery_profiles', 'social_map',
    ]
    for (const key of expectedKeys) {
      expect(key in flags).toBe(true)
    }
  })
})
