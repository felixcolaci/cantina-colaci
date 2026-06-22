import { test, expect } from '@playwright/test'

test('cellar page renders with empty state', async ({ page }) => {
  await page.goto('/cellar')
  await expect(page).toHaveURL(/\/cellar/)
  // Either shows wines or empty state
  const hasWines = await page.locator('a[href^="/wine/"]').count() > 0
  if (!hasWines) {
    await expect(page.locator('text=Keine Weine im Keller')).toBeVisible()
  }
})

test('add wine form is reachable', async ({ page }) => {
  await page.goto('/wine/new')
  await expect(page.locator('[name="name"]')).toBeVisible()
  await expect(page.locator('[name="producer"]')).toBeVisible()
})

test('navigation links work', async ({ page }) => {
  await page.goto('/')
  await page.click('a[href="/cellar"]')
  await expect(page).toHaveURL(/\/cellar/)

  await page.click('a[href="/trips"]')
  await expect(page).toHaveURL(/\/trips/)

  await page.click('a[href="/history"]')
  await expect(page).toHaveURL(/\/history/)
})
