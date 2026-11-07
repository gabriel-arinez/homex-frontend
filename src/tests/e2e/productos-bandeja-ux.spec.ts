import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const token = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const category = [
  { id: 1, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: 'CATEGORIA_PRODUCTO' },
  {
    id: 2,
    codigo: 'PISO_FLOTANTE',
    nombre: 'Piso flotante',
    concepto_codigo: 'CATEGORIA_PRODUCTO',
  },
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
    nombre:
      'Silla ejecutiva acolchada con tapizado especial y un nombre excepcionalmente largo que necesita manejarse sin perder información',
    precio_vigente: '590.00',
    precio_lista: '590.00',
    unidad_stock: 12,
    unidad_stock_info: {
      id: 12,
      codigo: 'PIEZA',
      nombre: 'Pieza',
      concepto_codigo: 'UNIDAD_MEDIDA',
    },
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
    unidad_stock_info: {
      id: 13,
      codigo: 'M2',
      nombre: 'Metro cuadrado',
      concepto_codigo: 'UNIDAD_MEDIDA',
    },
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
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access: token, refresh: 'refresh' }),
    }),
  )
  await page.route('**/api/v1/auth/me/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 7,
        username: 'vendedor',
        display_name: 'Vendedor HOMEX',
        capabilities: canCreate
          ? ['comercial.operar', 'catalogo.crear_producto']
          : ['comercial.operar'],
      }),
    }),
  )
  await page.route(/\/api\/v1\/catalogo\/opciones\/(?:\?.*)?$/, (route) => {
    const code = new URL(route.request().url()).searchParams.get('concepto')
    const options =
      code === 'CATEGORIA_PRODUCTO'
        ? category
        : code === 'MARCA'
          ? [{ id: 10, codigo: 'MARCA_A', nombre: 'Marca A', concepto_codigo: 'MARCA' }]
          : code === 'UNIDAD_MEDIDA'
            ? [
                { id: 12, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' },
                {
                  id: 13,
                  codigo: 'M2',
                  nombre: 'Metro cuadrado',
                  concepto_codigo: 'UNIDAD_MEDIDA',
                },
                { id: 14, codigo: 'BARRA', nombre: 'Barra', concepto_codigo: 'UNIDAD_MEDIDA' },
              ]
            : []
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options),
    })
  })
  await page.route(/\/api\/v1\/catalogo\/familias\/(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        previous: null,
        next: null,
        results: [{ id: 20, codigo: 'SILLA', nombre: 'Silla', activo: true }],
      }),
    }),
  )
  await page.route(/\/api\/v1\/catalogo\/productos\/(?:\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...body, id: 99, stock: '0.0000' }),
      })
    }
    const url = new URL(route.request().url())
    seen.push(url)
    let filtered = items.filter((x) => {
      const state = url.searchParams.get('activo')
      const code = url.searchParams.get('categoria')
      const q = url.searchParams.get('search')?.toLowerCase()
      return (
        (state === null || String(x.activo) === state) &&
        (!code || String(x.categoria) === code) &&
        (!q || (x.nombre + x.sku).toLowerCase().includes(q))
      )
    })
    const pageNumber = Number(url.searchParams.get('page') || '1')
    const size = Number(url.searchParams.get('page_size') || '12')
    const count = filtered.length
    filtered = filtered.slice((pageNumber - 1) * size, pageNumber * size)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count,
        next: null,
        previous: null,
        results: filtered,
      }),
    })
  })
  await page.route(/\/api\/v1\/catalogo\/productos\/\d+\/imagenes\/$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ imagenes: [], limite: 8 }),
    }),
  )
  return seen
}
async function noOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1)
}

test('@a11y FE03 nueva bandeja de productos muestra lista, categorías y precios accesibles', async ({
  page,
}) => {
  await mockBackend(page)
  await page.goto('/productos')
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Precio vigente' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Existencias' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver producto Silla ejecutiva/ })).toHaveAttribute(
    'href',
    '/productos/11',
  )
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

test('@a11y vista rápida de productos conserva foco, responde en móvil y respeta tema oscuro', async ({
  page,
}) => {
  await mockBackend(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/productos')
  const trigger = page.getByRole('button', { name: /Vista rápida de Silla ejecutiva/ })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Precio vigente del catálogo')).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Ver ficha completa' })).toHaveAttribute(
    'href',
    '/productos/11',
  )
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (item) => item.impact === 'serious' || item.impact === 'critical',
  )
  expect(violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('FE03 filtros por categoría y atributos conservan búsqueda y vista en URL', async ({
  page,
}) => {
  const calls = await mockBackend(page)
  await page.goto('/productos')
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption('1')
  await expect.poll(() => calls[calls.length - 1]?.searchParams.get('categoria')).toBe('1')
  await page.getByRole('button', { name: 'Más filtros' }).click()
  await page.getByRole('combobox', { name: 'Marca', exact: true }).selectOption('10')
  await expect.poll(() => calls[calls.length - 1]?.searchParams.get('marca')).toBe('10')
  await expect(page).toHaveURL(/marca=10/)
  await expect(page.getByRole('combobox', { name: 'Material' })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption('2')
  await expect(page.getByRole('combobox', { name: 'Material' })).toBeVisible()
  await expect(page).not.toHaveURL(/marca=10/)
  await page.getByRole('button', { name: 'Cuadrícula' }).click()
  await expect(page).toHaveURL(/vista=grid/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Cuadrícula' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('combobox', { name: 'Categoría', exact: true })).toHaveValue('2')
})

test('FE03 creación por categoría exige capacidad y presenta opciones reales', async ({ page }) => {
  await mockBackend(page, true)
  await page.goto('/productos')
  const shortcuts = page.getByRole('group', { name: 'Crear producto por categoría' })
  await expect(shortcuts).toBeVisible()
  await expect(shortcuts.getByRole('button')).toHaveCount(3)
  await shortcuts.getByRole('button', { name: 'Piso' }).click()
  await expect(page).toHaveURL(/\/productos\/nuevo\?categoria=PISO_FLOTANTE/)
})

for (const width of [390, 768, 1440]) {
  test(
    'FE03 productos sin desbordamiento en lista y cuadrícula a ' + width + 'px',
    async ({ page }) => {
      await mockBackend(page)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/productos')
      if (width >= 768)
        await expect(page.getByRole('columnheader', { name: 'Producto' })).toBeVisible()
      else await expect(page.locator('td[data-label="Producto"]').first()).toBeVisible()
      await noOverflow(page)
      await page.getByRole('button', { name: 'Cuadrícula' }).click()
      await expect(page.locator('.product-card')).toHaveCount(2)
      await noOverflow(page)
    },
  )
}

for (const width of [390, 1440]) {
  test(
    '@a11y FE03 creación de productos operable y sin desbordamiento a ' + width + 'px',
    async ({ page }) => {
      await mockBackend(page, true)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/productos/nuevo?categoria=SILLA')
      await expect(page.getByRole('heading', { name: 'Nueva silla' })).toBeVisible()
      await expect(page.getByRole('combobox', { name: 'Unidad comercial *' })).toHaveValue('12')
      await expect(page.getByRole('heading', { name: 'Características de la silla' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Completar por voz' })).toBeVisible()
      expect(await page.locator('input[name="stock"]').count()).toBe(0)
      await noOverflow(page)
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
        (item) => item.impact === 'serious' || item.impact === 'critical',
      )
      expect(violations).toEqual([])
      await page.getByRole('button', { name: 'Completar por voz' }).click()
      await expect(page.getByRole('dialog', { name: 'Completar por voz' })).toBeVisible()
      await page.getByRole('button', { name: 'Cerrar asistente de voz' }).click()
      await expect(page.getByRole('dialog', { name: 'Completar por voz' })).toHaveCount(0)
      await page.getByRole('textbox', { name: 'Nombre comercial *' }).fill('Silla de prueba')
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await expect(page.getByRole('dialog', { name: '¿Deseas salir del producto?' })).toBeVisible()
      await page.getByRole('button', { name: 'Descartar y salir' }).click()
      await expect(page).toHaveURL(/\/productos$/)
    },
  )
}

test('FE03 ofrece tres opciones y solo sale tras guardar un producto válido', async ({ page }) => {
  await mockBackend(page, true)
  await page.goto('/productos/nuevo?categoria=SILLA')
  await page.getByRole('textbox', { name: 'Nombre comercial *' }).fill('Silla con guardado seguro')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  const exit = page.getByRole('dialog', { name: '¿Deseas salir del producto?' })
  await expect(exit).toBeVisible()
  await expect(exit.getByRole('button', { name: 'Seguir editando' })).toBeVisible()
  await expect(exit.getByRole('button', { name: 'Descartar y salir' })).toBeVisible()
  await exit.getByRole('button', { name: 'Guardar producto y salir' }).click()
  await expect(exit.getByRole('alert')).toContainText('Revisa los campos obligatorios')
  await expect(page).toHaveURL(/\/productos\/nuevo/)
  await exit.getByRole('button', { name: 'Seguir editando' }).click()
  await page.getByLabel('Código SKU *').fill('E2E-SAVE-EXIT')
  await page.getByRole('spinbutton', { name: 'Precio normal de venta (Bs) *' }).fill('150')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await exit.getByRole('button', { name: 'Guardar producto y salir' }).click()
  await expect(page).toHaveURL(/\/productos(?:\?|$)/)
})

test('FE03 guardado confirmado redirige sin pedir descartar ni crear un duplicado', async ({
  page,
}) => {
  await mockBackend(page, true)
  let creates = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/catalogo/productos/')
    )
      creates++
  })
  await page.goto('/productos/nuevo?categoria=SILLA')
  await expect(page.getByRole('heading', { name: 'Nueva silla' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Nombre comercial *' }).fill('Silla de integración')
  await page.getByLabel('Código SKU *').fill('E2E-VOICE-001')
  await page.getByRole('spinbutton', { name: 'Precio normal de venta (Bs) *' }).fill('150')
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/catalogo/productos/'),
  )
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  expect((await created).status()).toBe(201)
  await expect(page).toHaveURL(/\/productos(?:\?|$)/)
  expect(creates).toBe(1)
  await expect(page.getByRole('dialog', { name: 'Salir sin guardar' })).toHaveCount(0)
})
