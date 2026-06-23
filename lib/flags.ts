import { createClient } from '@/lib/supabase/server'

export type FlagName =
  | 'mcp_integration'
  | 'unlimited_cellar'
  | 'advanced_stats'
  | 'shared_tours'
  | 'winery_profiles'
  | 'social_map'

export type Plan = 'free' | 'pro' | 'business'

export type FeatureFlags = Record<FlagName, boolean>

// During beta: all flags on for everyone.
// When billing goes live: set BETA_MODE to false — plan defaults kick in.
const BETA_MODE = true

const PLAN_FLAGS: Record<Plan, FeatureFlags> = {
  free: {
    mcp_integration: true,
    unlimited_cellar: false,
    advanced_stats: false,
    shared_tours: true,
    winery_profiles: false,
    social_map: true,
  },
  pro: {
    mcp_integration: true,
    unlimited_cellar: true,
    advanced_stats: true,
    shared_tours: true,
    winery_profiles: false,
    social_map: true,
  },
  business: {
    mcp_integration: true,
    unlimited_cellar: true,
    advanced_stats: true,
    shared_tours: true,
    winery_profiles: true,
    social_map: true,
  },
}

const ALL_ON: FeatureFlags = {
  mcp_integration: true,
  unlimited_cellar: true,
  advanced_stats: true,
  shared_tours: true,
  winery_profiles: true,
  social_map: true,
}

export function resolveFlagsFromPlan(
  plan: Plan,
  overrides: Partial<Record<FlagName, boolean>>
): FeatureFlags {
  const base: FeatureFlags = BETA_MODE ? { ...ALL_ON } : { ...PLAN_FLAGS[plan] }
  return { ...base, ...overrides } as FeatureFlags
}

export async function getFamilyId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return membership?.family_id ?? null
}

export async function getFeatureFlags(familyId: string): Promise<FeatureFlags> {
  const supabase = await createClient()

  const [familyResult, overridesResult] = await Promise.all([
    supabase
      .from('families')
      .select('plan')
      .eq('id', familyId)
      .maybeSingle(),
    supabase
      .from('feature_flag_overrides')
      .select('flag, enabled')
      .eq('family_id', familyId),
  ])

  const plan = (familyResult.data?.plan ?? 'free') as Plan
  const overrides: Partial<Record<FlagName, boolean>> = {}
  for (const row of overridesResult.data ?? []) {
    overrides[row.flag as FlagName] = row.enabled
  }

  return resolveFlagsFromPlan(plan, overrides)
}
