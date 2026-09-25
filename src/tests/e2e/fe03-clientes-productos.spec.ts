import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const clients = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  tipo_cliente: 1,
  nombres: `Cliente ${index + 1}`,
  apellidos: 'HOMEX',
  celular: `70000${index}`,
  activo: true,
  created_by: 7,
  updated_by: 7,
}))
const products = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  categoria: 1,
  sku: `SKU-${index + 1}`,
  nombre: `Producto ${index + 1}`,
  precio_lista: '1500.00',
  precio_vigente: index === 0 ? '1200.00' : '1500.00',
  stock: 8,
  demanda_pendiente: 3,
  disponibilidad_referencial: 5,
  unidad_stock: 1,
  activo: true,
  observaciones: null,
  imagen_principal:
    index === 0
      ? {
          original: 'https://media.example/original.webp',
          ancho: 1280,
          alto: 960,
          variantes: {
            '320': 'https://media.example/320.webp',
            '640': 'https://media.example/640.webp',
            '1280': 'https://media.example/1280.webp',
          },
        }
      : null,
  created_by: 7,
  updated_by: 7,
}))

async function mockBackend(page: Page) {
  let privilegedCatalogCalls = 0

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
  await page.route('**/api/v1/clientes/', (route) => {
    const url = new URL(route.request().url())
    const pageNumber = Number(url.searchParams.get('page') ?? '1')
    const pageSize = Number(url.searchParams.get('page_size') ?? '20')
    const start = (pageNumber - 1) * pageSize
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: clients.length,
        next:
          start + pageSize < clients.length
            ? 'http://localhost:8000/api/v1/clientes/?page=2'
            : null,
        previous: pageNumber > 1 ? 'http://localhost:8000/api/v1/clientes/?page=1' : null,
        results: clients.slice(start, start + pageSize),
      }),
    })
  })
  await page.route('**/api/v1/clientes/1/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(clients[0]),
    }),
  )
  await page.route('**/api/v1/catalogo/productos/', (route) => {
    const url = new URL(route.request().url())
    const pageNumber = Number(url.searchParams.get('page') ?? '1')
    const pageSize = Number(url.searchParams.get('page_size') ?? '20')
    const start = (pageNumber - 1) * pageSize
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: products.length,
        next:
          start + pageSize < products.length
            ? 'http://localhost:8000/api/v1/catalogo/productos/?page=2'
            : null,
        previous: pageNumber > 1 ? 'http://localhost:8000/api/v1/catalogo/productos/?page=1' : null,
        results: products.slice(start, start + pageSize),
      }),
    })
  })
  for (const endpoint of ['sillas', 'pisos', 'descuentos']) {
    await page.route(`**/api/v1/catalogo/${endpoint}/**`, (route) => {
      privilegedCatalogCalls += 1
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Sin permiso' }),
      })
    })
  }
  await page.route('https://media.example/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="100%" height="100%" fill="#ddd"/></svg>',
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

  return () => privilegedCatalogCalls
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true)
}

for (const width of [360, 390, 768, 1024, 1440])
  test(`FE03 clientes y productos operables a ${width}px`, async ({ page }) => {
    const privilegedCalls = await mockBackend(page)
    await page.setViewportSize({ width, height: 900 })

    await page.goto('/clientes')
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
    await expect(page.getByText('12 clientes')).toBeVisible()
    await noOverflow(page)

    await page.goto('/productos')
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
    await expect(page.getByText('8 productos')).toBeVisible()
    await expect(page.getByText('Categoría #1').first()).toBeVisible()
    await expect(page.locator('img[alt="Producto 1"]')).toHaveAttribute('srcset', /320\.webp 320w/)
    await expect(page.locator('img[alt="Producto 1"]')).not.toHaveAttribute('src', /original/)
    expect(privilegedCalls()).toBe(0)
    await noOverflow(page)

    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )
    expect(violations).toEqual([])
  })

test('FE03 permite al vendedor editar su propio cliente sin exigir capacidad administrativa', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/clientes/1')
  await expect(page.getByRole('heading', { name: 'Cliente 1 HOMEX' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible()
})

test('FE03 conserva contraste y catálogo en tema oscuro', async ({ page }) => {
  const privilegedCalls = await mockBackend(page)
  await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/productos')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
  expect(privilegedCalls()).toBe(0)
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (item) => item.impact === 'serious' || item.impact === 'critical',
  )
  expect(violations).toEqual([])
})
