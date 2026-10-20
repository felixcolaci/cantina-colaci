import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { cleanTestUserData } from '../helpers/db'
import { TEST_EMAIL } from '../helpers/constants'

test.beforeAll(async () => {
  await cleanTestUserData()
})

test('completes onboarding and lands on dashboard', async ({ page }) => {
  await page.goto('/')

  // Should redirect to /onboarding since test user has no family yet
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 8_000 })

  await page.fill('[name="familyName"]', 'Colaci E2E')
  await page.fill('[name="cellarName"]', 'Testkeller')
  await page.click('[type="submit"]')

  // Should end up on dashboard after onboarding
  await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10_000 })
  await expect(page.locator('h2')).toContainText('Willkommen')

  // Regression coverage for review finding 1.3: families.is_demo defaults to
  // `true` in the schema (it exists to flag the auto-seeded demo family), and
  // a prior stage fixed create_family_and_cellar's RPC to set is_demo = false
  // explicitly on a real onboarding insert. Assert that fix held — a
  // regression here means every new user's own cellar silently shows the
  // "Erkunde deine Cantina mit Beispielweinen" demo banner over their real
  // data (see app/(app)/cellar/page.tsx and app/(app)/family/page.tsx).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket as unknown as typeof global.WebSocket },
    }
  )

  const { data: users } = await admin.auth.admin.listUsers()
  const testUser = users?.users.find(u => u.email === TEST_EMAIL)
  expect(testUser).toBeTruthy()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', testUser!.id)
    .eq('role', 'owner')
    .maybeSingle()
  expect(membership).toBeTruthy()

  const { data: family } = await admin
    .from('families')
    .select('is_demo')
    .eq('id', membership!.family_id)
    .maybeSingle()

  expect(family?.is_demo).toBe(false)
})

test('shows dashboard stats after onboarding', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('http://localhost:3000/')

  await expect(page.locator('text=Flaschen im Keller')).toBeVisible()
  await expect(page.locator('text=Verschiedene Weine')).toBeVisible()
})
