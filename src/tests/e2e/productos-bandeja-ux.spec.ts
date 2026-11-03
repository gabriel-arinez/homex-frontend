import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const token = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const category = [
  { id: 1, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: 'CATEGORIA_PRODUCTO' },
  { id: 2, codigo: 'PISO_FLOTANTE', nombre: 'Piso flotante', concepto_codigo: 'CATEGORIA_PRODUCTO' },
  { id: 3, codigo: 'OTRO', nombre: 'Otro producto', concepto_codigo: 'CATEGORIA_PRODUCTO' },
]
const items = [
  {
    id: 11,
    categoria: 1,
    categoria_info: category[0],
    familia: 20,
    familia_info: { id: 20, codigo: 'SILLA', nombre: 'Silla' },
    sku: 'S-001',
    nombre: 'Silla ejecutiva acolchada con tapizado especial y un nombre excepcionalmente largo que necesita manejarse sin perder información',
    precio_vigente: '590.00',
    precio_lista: '590.00',
    unidad_stock: 12,
    unidad_stock_info: { id: 12, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' },
    stock: '27.0000',
    demanda_pendiente: '1.0000',
    disponibilidad_referencial: '26.0000',
    activo: true,
    imagen_principal: null,
    promocion: null,
  },
  {
    id: 12,
    categoria: 2,
    categoria_info: category[1],
    sku: 'P-001',
    nombre: 'Piso flotante roble claro',
    precio_vigente: '125.00',
    precio_lista: '150.00',
    unidad_stock: 13,
    unidad_stock_info: { id: 13, codigo: 'M2', nombre: 'Metro cuadrado', concepto_codigo: 'UNIDAD_MEDIDA' },
    stock: '16.5000',
    demanda_pendiente: '0.0000',
    disponibilidad_referencial: '16.5000',
    activo: true,
    imagen_principal: null,
    promocion: { vigente: true },
  },
]

async function mockBackend(page: Page, canCreate = false) {
  const seen: URL[] = []
  await page.addInitScript(
    ({ access }) =>
      sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'refresh' })),
    { access: token },
  )
  await page.route('**/api/v1/auth/token/refresh/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access: token, refresh: 'refresh' }) }),
  )
  await page.route('**/api/v1/auth/me/', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 7, username: 'vendedor', display_name: 'Vendedor HOMEX',
        capabilities: canCreate ? ['comercial.operar', 'catalogo.crear_producto'] : ['comercial.operar'],
      }),
    }),
  )
  await page.route(/\/api\/v1\/catalogo\/opciones\/(?:\?.*)?$/, (route) => {
    const code = new URL(route.request().url()).searchParams.get('concepto')
    const options = code === 'CATEGORIA_PRODUCTO'
      ? category
      : code === 'MARCA'
        ? [{ id: 10, codigo: 'MARCA_A', nombre: 'Marca A', concepto_codigo: 'MARCA' }]
        : []
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options) })
  })
  await page.route(/\/api\/v1\/catalogo\/familias\/(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      count: 1, previous: null, next: null, results: [{ id: 20, codigo: 'SILLA', nombre: 'Silla', activo: true }],
    }) }),
  )
  await page.route(/\/api\/v1\/catalogo\/productos\/(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    seen.push(url)
    let filtered = items.filter((x) => {
      const state = url.searchParams.get('activo')
      const code = url.searchParams.get('categoria')
      const q = url.searchParams.get('search')?.toLowerCase()
      return (state === null || String(x.activo) === state) &&
        (!code || String(x.categoria) === code) &&
        (!q || (x.nombre + x.sku).toLowerCase().includes(q))
    })
    const pageNumber = Number(url.searchParams.get('page') || '1')
    const size = Number(url.searchParams.get('page_size') || '12')
    const count = filtered.length
    filtered = filtered.slice((pageNumber - 1) * size, pageNumber * size)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      count, next: null, previous: null, results: filtered,
    }) })
  })
  return seen
}
async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

test('@a11y FE03 nueva bandeja de productos muestra lista, categorías y precios accesibles', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/productos')
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Precio vigente' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Existencias' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver producto Silla ejecutiva/ })).toHaveAttribute('href', '/productos/11')
  await expect(page.getByText('27 piezas')).toBeVisible()
  await expect(page.getByText('Pendiente: 1')).toBeVisible()
  await expect(page.getByText('16,5 m²')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cuadrícula' }).click()
  await expect(page.locator('.product-card')).toHaveCount(2)
  await expect(page.getByText('Sin imagen')).toHaveCount(2)
  await expect(page.getByText('Promoción', { exact: true })).toBeVisible()
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (item) => item.impact === 'serious' || item.impact === 'critical',
  )
  expect(violations).toEqual([])
})

test('FE03 filtros por categoría y atributos conservan búsqueda y vista en URL', async ({ page }) => {
  const calls = await mockBackend(page)
  await page.goto('/productos')
  await page.getByLabel('Categoría', { exact: true }).selectOption('1')
  await expect.poll(() => calls.at(-1)?.searchParams.get('categoria')).toBe('1')
  await page.getByRole('button', { name: 'Más filtros' }).click()
  await page.getByLabel('Marca', { exact: true }).selectOption('10')
  await expect.poll(() => calls.at(-1)?.searchParams.get('marca')).toBe('10')
  await expect(page).toHaveURL(/marca=10/)
  await expect(page.getByRole('combobox', { name: 'Material' })).toHaveCount(0)
  await page.getByLabel('Categoría', { exact: true }).selectOption('2')
  await expect(page.getByRole('combobox', { name: 'Material' })).toBeVisible()
  await expect(page).not.toHaveURL(/marca=10/)
  await page.getByRole('button', { name: 'Cuadrícula' }).click()
  await expect(page).toHaveURL(/vista=grid/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Cuadrícula' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Categoría', { exact: true })).toHaveValue('2')
})

test('FE03 creación por categoría exige capacidad y presenta opciones reales', async ({ page }) => {
  await mockBackend(page, true)
  await page.goto('/productos')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  await expect(page.getByRole('group', { name: 'Elegir categoría del nuevo producto' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Piso flotante' })).toBeVisible()
  await page.getByRole('button', { name: 'Piso flotante' }).click()
  await expect(page).toHaveURL(/\/productos\/nuevo\?categoria=PISO_FLOTANTE/)
})

for (const width of [390, 768, 1440]) {
  test('FE03 productos sin desbordamiento en lista y cuadrícula a ' + width + 'px', async ({ page }) => {
    await mockBackend(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/productos')
    await expect(page.getByRole('columnheader', { name: 'Producto' })).toHaveCount(1)
    await noOverflow(page)
    await page.getByRole('button', { name: 'Cuadrícula' }).click()
    await expect(page.locator('.product-card')).toHaveCount(2)
    await noOverflow(page)
  })
}
