import { expect, test } from '@playwright/test'

const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'

test('FE09 carga el shell público sin desbordamiento horizontal', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.getByLabel('Usuario')).toBeEditable()
  await expect(page.getByLabel('Contraseña')).toBeEditable()
  const viewport = page.viewportSize()
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth }))
  expect(layout.width).toBeLessThanOrEqual(viewport?.width ?? layout.width)
})

test('FE09 restaura sesión y permite recargar una ruta SPA operativa', async ({ page }) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
  )
  await page.route('**/api/v1/auth/token/refresh/', (route) =>
    route.fulfill({ json: { access, refresh: 'refresh' } }),
  )
  await page.route('**/api/v1/auth/me/', (route) =>
    route.fulfill({
      json: {
        id: 7,
        username: 'vendedor',
        display_name: 'María Vendedora',
        capabilities: ['comercial.operar'],
      },
    }),
  )
  await page.addInitScript(
    ({ token }) =>
      sessionStorage.setItem(
        'homex.session.v1',
        JSON.stringify({ access: token, refresh: 'refresh' }),
      ),
    { token: access },
  )

  await page.goto('/resumen')
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible()
  await expect(page.getByText('Vista operativa de María Vendedora.')).toBeVisible()
})
