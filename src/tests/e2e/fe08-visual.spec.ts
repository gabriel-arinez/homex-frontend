import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark'] as const) {
  test(`FE08 regresión visual login ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript((selected) => localStorage.setItem('homex.theme', selected), theme)
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(page).toHaveScreenshot(`login-${theme}-390.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    })
  })
}
