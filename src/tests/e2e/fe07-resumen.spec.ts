import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo7fQ.signature'
const states = [
  { id: 1, codigo: 'BORRADOR', nombre: 'Borrador', concepto_codigo: 'ESTADO_PROFORMA' },
  { id: 2, codigo: 'ENVIADA', nombre: 'Enviada', concepto_codigo: 'ESTADO_PROFORMA' },
  { id: 3, codigo: 'APROBADA', nombre: 'Aprobada', concepto_codigo: 'ESTADO_PROFORMA' },
]
async function mock(
  page: Page,
  {
    capabilities = ['comercial.operar'],
    counts = { BORRADOR: 2, ENVIADA: 3, APROBADA: 1 } as Record<string, number>,
    failure = '',
  } = {},
) {
  await page.addInitScript(
    ({ access }) =>
      sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'refresh' })),
    { access },
  )
  await page.route('**/api/v1/auth/token/refresh/', (r) =>
    r.fulfill({ json: { access, refresh: 'refresh' } }),
  )
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({ json: { id: 7, username: 'persona', display_name: 'María HOMEX', capabilities } }),
  )
  await page.route('**/api/v1/catalogo/opciones/**', (r) => r.fulfill({ json: states }))
  await page.route(/\/api\/v1\/proformas\/(?:\?.*)?$/, (r) => {
    const state = new URL(r.request().url()).searchParams.get('estado') ?? ''
    return state === failure
      ? r.fulfill({ status: 503, json: { detail: 'Métrica temporalmente no disponible.' } })
      : r.fulfill({ json: { count: counts[state] ?? 0, next: null, previous: null, results: [] } })
  })
}
test('FE07 muestra distribución y fallback textual con datos del servidor', async ({ page }) => {
  await mock(page)
  await page.goto('/resumen')
  await expect(page.getByText('Proformas editables actuales')).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Conteos actuales de proformas por estado' }),
  ).toContainText('Total consultado6')
  await expect(page.getByText(/99.9|stock valorizado|eficiencia/i)).toHaveCount(0)
})
test('FE07 conserva datos parciales y permite actualizar', async ({ page }) => {
  await mock(page, { failure: 'ENVIADA' })
  await page.goto('/resumen')
  await expect(page.getByRole('status')).toContainText('1 indicador no pudo actualizarse')
  await expect(page.getByText('No disponible')).toBeVisible()
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Actualizar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Distribución actual de proformas' }),
  ).toBeVisible()
})
test('FE07 representa cero sin fabricar actividad', async ({ page }) => {
  await mock(page, { counts: {} })
  await page.goto('/resumen')
  await expect(page.getByRole('table')).toContainText('Total consultado0')
  await expect(page.getByText('Revisar proformas')).toBeVisible()
})
test('FE07 usa el mismo contrato para vendedor y administrador', async ({ page }) => {
  await mock(page, { capabilities: ['comercial.operar', 'comercial.administrar'] })
  await page.goto('/resumen')
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
  await expect(page.getByText('Vista operativa de María HOMEX.')).toBeVisible()
})
test('@a11y FE07 funciona en tema oscuro y mantiene valores sin hover', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
  await mock(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/resumen')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('table')).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true)
})
