import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const evidenceDir = 'test-results/playwright/evidence/fe01-regression'
mkdirSync(evidenceDir, { recursive: true })

const e2eAccess = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/token/refresh/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access: e2eAccess, refresh: 'e2e-refresh' }),
    }),
  )
  await page.route('**/api/v1/catalogo/opciones/**', (route) =>
    route.fulfill({
      json: [
        { id: 1, codigo: 'BORRADOR', nombre: 'Borrador', concepto_codigo: 'ESTADO_PROFORMA' },
        { id: 2, codigo: 'ENVIADA', nombre: 'Enviada', concepto_codigo: 'ESTADO_PROFORMA' },
        { id: 3, codigo: 'APROBADA', nombre: 'Aprobada', concepto_codigo: 'ESTADO_PROFORMA' },
      ],
    }),
  )
  await page.route(/\/api\/v1\/proformas\/(?:\?.*)?$/, (route) => {
    const estado = new URL(route.request().url()).searchParams.get('estado')
    const count = estado === 'BORRADOR' ? 2 : estado === 'ENVIADA' ? 3 : 1
    return route.fulfill({ json: { count, next: null, previous: null, results: [] } })
  })
  await page.route('**/api/v1/auth/me/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 7,
        username: 'vendedor',
        display_name: 'María Vendedora',
        capabilities: ['comercial.operar'],
      }),
    }),
  )
  await page.addInitScript(
    ({ access }) => {
      sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'e2e-refresh' }))
    },
    { access: e2eAccess },
  )
})

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

  await page.getByRole('button', { name: 'Actualizar' }).click({
    timeout: 3_000,
  })

  await assertNoHorizontalOverflow(page)
})

for (const theme of ['light', 'dark'] as const) {
  test('FE01 usa ancho fluido a 2880px con tema ' + theme + ' (zoom reducido)', async ({ page }) => {
    await page.addInitScript((selected) => localStorage.setItem('homex.theme', selected), theme)
    await page.setViewportSize({ width: 2880, height: 900 })
    await page.goto('/resumen')

    await expect(page.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

    async function checkFluidWidth() {
      const widths = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>('#main-content')
        const content = main?.firstElementChild as HTMLElement | null
        if (!main || !content) throw new Error('No se encontró el contenido del layout')
        const styles = getComputedStyle(main)
        return {
          available:
            main.clientWidth -
            Number.parseFloat(styles.paddingLeft) -
            Number.parseFloat(styles.paddingRight),
          content: content.getBoundingClientRect().width,
        }
      })

      expect(widths.available).toBeGreaterThan(2000)
      expect(widths.content).toBeGreaterThanOrEqual(widths.available - 2)
      expect(widths.content).toBeLessThanOrEqual(widths.available + 2)
    }

    await checkFluidWidth()
    await page.getByRole('button', { name: 'Compactar navegación' }).click()
    await checkFluidWidth()
    await assertNoHorizontalOverflow(page)
  })
}

test('FE01 oculta las barras globales sin desactivar el scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 480 })
  await page.goto('/resumen')
  await expect(page.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible()

  const scrollState = await page.evaluate(() => {
    const sidebarNav = document.querySelector<HTMLElement>(
      '.sidebar nav[aria-label="Navegación principal"]',
    )
    if (!sidebarNav) throw new Error('No se encontró la navegación lateral')
    const panel = document.createElement('div')
    panel.style.cssText = 'overflow:auto;width:180px;height:48px;position:fixed;left:0;top:0'
    panel.innerHTML = '<div style="width:400px;height:300px"></div>'
    document.body.appendChild(panel)

    panel.scrollTop = 70
    panel.scrollLeft = 80
    sidebarNav.scrollTop = 70
    const result = {
      documentScrollbar: getComputedStyle(document.documentElement).scrollbarWidth,
      sidebarScrollbar: getComputedStyle(sidebarNav).scrollbarWidth,
      nestedScrollbar: getComputedStyle(panel).scrollbarWidth,
      sidebarScrollable: sidebarNav.scrollHeight > sidebarNav.clientHeight,
      sidebarScrolled: sidebarNav.scrollTop > 0,
      nestedScrolledVertically: panel.scrollTop > 0,
      nestedScrolledHorizontally: panel.scrollLeft > 0,
    }
    panel.remove()
    return result
  })

  expect(scrollState).toEqual({
    documentScrollbar: 'none',
    sidebarScrollbar: 'none',
    nestedScrollbar: 'none',
    sidebarScrollable: true,
    sidebarScrolled: true,
    nestedScrolledVertically: true,
    nestedScrolledHorizontally: true,
  })
  await assertNoHorizontalOverflow(page)
})
