import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const client = {
  id: 1,
  tipo_cliente: 1,
  nombres: 'Ana',
  apellidos: 'Pérez',
  celular: '70000000',
  activo: true,
  created_by: 7,
  updated_by: 7,
}
const product = {
  id: 1,
  categoria: 1,
  sku: 'S-01',
  nombre: 'Silla ejecutiva',
  precio_lista: '1500.00',
  precio_vigente: '1200.00',
  stock: 8,
  demanda_pendiente: 3,
  disponibilidad_referencial: 5,
  unidad_stock: 1,
  activo: true,
  observaciones: null,
  imagen_principal: null,
  created_by: 7,
  updated_by: 7,
}

async function mockApp(page: Page) {
  await page.route('**/api/v1/auth/token/refresh/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access, refresh: 'refresh' }),
    }),
  )
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
  await page.route(/\/api\/v1\/clientes\/(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [client] }),
    }),
  )
  await page.route(/\/api\/v1\/catalogo\/productos\/(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [product] }),
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
}

async function assertA11y(page: Page) {
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (item) => item.impact === 'serious' || item.impact === 'critical',
  )
  expect(violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true)
}

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`@a11y FE03.5 mantiene clientes y productos accesibles a ${width}px`, async ({ page }) => {
    await mockApp(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/clientes')
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
    await assertA11y(page)
    await page.goto('/productos')
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
    await assertA11y(page)
  })
}

test('FE03.5 expone filtros, permite retirarlos y evita navegación prematura', async ({ page }) => {
  await mockApp(page)
  await page.goto('/clientes')
  await page.getByRole('searchbox', { name: 'Buscar por nombre, empresa o celular' }).fill('Ana')
  await expect(page.getByLabel('Filtros activos')).toContainText('Búsqueda: Ana')
  await page.getByRole('button', { name: 'Quitar filtro: Búsqueda: Ana' }).click()
  await expect(page.getByLabel('Filtros activos')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Proformas' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Pedidos' })).toHaveCount(0)
})

test('FE03.5 activa el skip-link y mueve el foco al contenido principal', async ({ page }) => {
  await mockApp(page)
  await page.goto('/clientes')
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Saltar al contenido principal' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})

test('FE03.5 comunica qué vista de productos está seleccionada', async ({ page }) => {
  await mockApp(page)
  await page.goto('/productos')
  const grid = page.getByRole('button', { name: 'Cuadrícula' })
  const list = page.getByRole('button', { name: 'Lista' })
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  await expect(list).toHaveAttribute('aria-pressed', 'false')
  await list.click()
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
  await expect(list).toHaveAttribute('aria-pressed', 'true')
})

test('@a11y FE03.5 navegación móvil cierra con Escape y devuelve el foco', async ({ page }) => {
  await mockApp(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/clientes')
  const opener = page.getByRole('button', { name: 'Abrir navegación' })
  await opener.focus()
  await opener.click()
  await expect(page.getByRole('button', { name: 'Cerrar navegación' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
  await assertA11y(page)
  await page.screenshot({
    path: 'test-results/playwright/evidence/fe03-5/clientes-mobile-light.png',
    fullPage: true,
  })
})

test('@a11y FE03.5 conserva jerarquía y contraste en tema oscuro', async ({ page }) => {
  await mockApp(page)
  await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/productos')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await assertA11y(page)
  await page.screenshot({
    path: 'test-results/playwright/evidence/fe03-5/productos-desktop-dark.png',
    fullPage: true,
  })
})

test('FE03.5 explica un error temporal y permite reintentar con seguridad', async ({ page }) => {
  await mockApp(page)
  let attempts = 0
  await page.route(/\/api\/v1\/clientes\/(?:\?.*)?$/, (route) => {
    attempts += 1
    return attempts === 1
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Servicio temporalmente no disponible' }),
        })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: 1, next: null, previous: null, results: [client] }),
        })
  })
  await page.goto('/clientes')
  await expect(page.getByRole('alert')).toContainText('Servicio temporalmente no disponible')
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('1 cliente', { exact: true })).toBeVisible()
  expect(attempts).toBe(2)
})
