import { test, expect } from '@playwright/test'
import { cleanTestUserData } from '../helpers/db'

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
})

test('shows dashboard stats after onboarding', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('http://localhost:3000/')

  await expect(page.locator('text=Flaschen im Keller')).toBeVisible()
  await expect(page.locator('text=Verschiedene Weine')).toBeVisible()
})
