import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const evidenceDir = process.env.CI
  ? 'test-results/playwright/evidence/fe01'
  : 'docs/implementacion/evidencias/fe01'

mkdirSync(evidenceDir, { recursive: true })

const viewports = [
  { width: 360, height: 900 },
  { width: 390, height: 900 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
] as const

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(
    dimensions.scrollWidth,
    `overflow horizontal: scrollWidth=${dimensions.scrollWidth}, clientWidth=${dimensions.clientWidth}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function assertNoSeriousAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()

  const blocking = result.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )

  expect(
    blocking,
    blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n'),
  ).toEqual([])
}

for (const viewport of viewports) {
  test(`FE01 responde correctamente a ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/resumen')

    await expect(page.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible()

    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)

    await page.screenshot({
      path: `${evidenceDir}/resumen-${viewport.width}.png`,
      fullPage: true,
    })
  })
}

const darkViewports = [
  { width: 390, height: 900 },
  { width: 1440, height: 900 },
] as const

for (const viewport of darkViewports) {
  test(`FE01 mantiene accesibilidad en tema oscuro a ${viewport.width}px`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homex.theme', 'dark')
    })

    await page.setViewportSize(viewport)
    await page.goto('/resumen')

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible()

    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)

    await page.screenshot({
      path: `${evidenceDir}/resumen-dark-${viewport.width}.png`,
      fullPage: true,
    })
  })
}

test('FE01 usa drawer operable en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/resumen')

  const layer = page.locator('.sidebar-layer')
  const menu = page.getByRole('button', { name: 'Abrir navegación' })

  await expect(menu).toBeVisible()
  await expect(layer).toBeHidden()

  await menu.click()
  await expect(layer).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(layer).toBeHidden()
})

test('FE01 libera el espacio del sidebar al compactarlo en desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/resumen')

  const sidebar = page.locator('.sidebar')
  const main = page.locator('#main-content')

  await expect(sidebar).toHaveCSS('width', '264px')
  await expect(main).toHaveCSS('margin-left', '264px')

  await page.getByRole('button', { name: 'Compactar navegación' }).click()

  await expect(sidebar).toHaveCSS('width', '72px')
  await expect(main).toHaveCSS('margin-left', '72px')

  const resumen = page.getByRole('link', { name: 'Resumen' })
  await resumen.focus()

  await expect(page.getByRole('tooltip')).toHaveText('Resumen')
})

test('FE01 no bloquea las acciones del contenido en tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto('/resumen')

  await page.getByRole('button', { name: 'Acción contextual' }).click({
    timeout: 3_000,
  })

  await assertNoHorizontalOverflow(page)
})
