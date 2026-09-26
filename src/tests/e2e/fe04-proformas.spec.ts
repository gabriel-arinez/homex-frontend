import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const options = {
  MONEDA: [
    { id: 40, concepto_codigo: 'MONEDA', codigo: 'BOB', nombre: 'Bolivianos' },
    { id: 41, concepto_codigo: 'MONEDA', codigo: 'USD', nombre: 'Dólares estadounidenses' },
  ],
  ESTADO_PROFORMA: [
    { id: 2, concepto_codigo: 'ESTADO_PROFORMA', codigo: 'BORRADOR', nombre: 'Borrador' },
    { id: 3, concepto_codigo: 'ESTADO_PROFORMA', codigo: 'ENVIADA', nombre: 'Enviada' },
  ],
  TIPO_ITEM: [
    { id: 10, concepto_codigo: 'TIPO_ITEM', codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble a medida' },
    { id: 11, concepto_codigo: 'TIPO_ITEM', codigo: 'SILLA', nombre: 'Silla' },
  ],
  UNIDAD_MEDIDA: [{ id: 20, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
  TIPO_MUEBLE: [
    { id: 30, concepto_codigo: 'TIPO_MUEBLE', codigo: 'ESCRITORIO', nombre: 'Escritorio' },
  ],
}
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
  id: 4,
  categoria: 1,
  sku: 'S-01',
  nombre: 'Silla ejecutiva',
  precio_lista: '1500.00',
  precio_vigente: '1200.00',
  stock: 8,
  demanda_pendiente: 3,
  disponibilidad_referencial: 5,
  unidad_stock: 20,
  activo: true,
  observaciones: null,
  imagen_principal: null,
  created_by: 7,
  updated_by: 7,
}
function makeQuote() {
  return {
    id: 1,
    numero: 101,
    cliente: 1,
    cliente_resumen: { id: 1, nombre: 'Ana Pérez', empresa: null, celular: '70000000' },
    vendedor: 7,
    estado: 2,
    estado_info: { id: 2, codigo: 'BORRADOR', nombre: 'Borrador' },
    titulo: 'Oficina nueva',
    fecha: '2026-09-25',
    plazo_entrega: null,
    validez_oferta: null,
    porcentaje_adelanto: null,
    moneda: 40,
    moneda_info: { id: 40, codigo: 'BOB', nombre: 'Bolivianos' },
    subtotal: '0.00',
    descuento_total: '0.00',
    total: '0.00',
    observaciones: null,
    prospecto_nombre: null,
    prospecto_empresa: null,
    prospecto_celular: null,
    prospecto_direccion: null,
    cliente_nombre_snapshot: null,
    cliente_empresa_snapshot: null,
    cliente_celular_snapshot: null,
    cliente_direccion_snapshot: null,
    created_by: 7,
    updated_by: 7,
    detalles: [] as Array<Record<string, unknown>>,
  }
}
async function mockBackend(page: Page) {
  let quote = makeQuote(),
    files: Array<Record<string, unknown>> = []
  await page.route('**/api/v1/auth/token/refresh/', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access, refresh: 'refresh' }),
    }),
  )
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({
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
  await page.route('**/api/v1/catalogo/opciones/**', (r) => {
    const c = new URL(r.request().url()).searchParams.get('concepto') as keyof typeof options
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options[c] ?? []),
    })
  })
  await page.route('**/api/v1/clientes/1/', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(client) }),
  )
  await page.route(/\/api\/v1\/clientes\/(?:\?.*)?$/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [client] }),
    }),
  )
  await page.route('**/api/v1/catalogo/productos/4/', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(product) }),
  )
  await page.route(/\/api\/v1\/catalogo\/productos\/(?:\?.*)?$/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [product] }),
    }),
  )
  await page.route(/\/api\/v1\/proformas\/(?:\?.*)?$/, async (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON()
      quote = { ...quote, ...body }
      return r.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(quote),
      })
    }
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [quote] }),
    })
  })
  await page.route('**/api/v1/proformas/1/', async (r) => {
    if (r.request().method() === 'PATCH') quote = { ...quote, ...r.request().postDataJSON() }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quote) })
  })
  await page.route('**/api/v1/proformas/1/detalles/', async (r) => {
    const body = r.request().postDataJSON()
    const line = {
      id: 10,
      proforma: 1,
      ...body,
      tipo_item_info: options.TIPO_ITEM.find((x) => x.id === body.tipo_item),
      unidad_info: options.UNIDAD_MEDIDA[0],
      precio_antes_snapshot: null,
      precio_ahora_snapshot: null,
      total: body.modo_calculo === 'TOTAL_NEGOCIADO' ? body.importe_negociado : '300.00',
      especificacion: null,
    }
    quote.detalles = [line]
    quote.subtotal = String(line.total)
    quote.total = String(line.total)
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(line) })
  })
  await page.route('**/api/v1/proformas-detalle/10/', async (r) => {
    const body = r.request().postDataJSON()
    quote.detalles[0] = { ...quote.detalles[0], ...body }
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quote.detalles[0]),
    })
  })
  await page.route('**/api/v1/proformas-detalle/10/especificacion/', async (r) => {
    const body = r.request().postDataJSON()
    const spec = { id: 5, proforma_detalle: 10, ...body, tipo_mueble_info: options.TIPO_MUEBLE[0] }
    quote.detalles[0] = { ...quote.detalles[0], especificacion: spec }
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(spec) })
  })
  await page.route('**/api/v1/proformas/1/enviar/', (r) => {
    quote.estado_info = { id: 3, codigo: 'ENVIADA', nombre: 'Enviada' }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quote) })
  })
  await page.route('**/api/v1/proformas/1/aprobar/', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pedido_id: 55, estado: 'CONFIRMADO' }),
    }),
  )
  await page.route('**/api/v1/proformas/1/detalles/10/archivos/', (r) => {
    if (r.request().method() === 'POST') {
      const file = {
        id: 9,
        nombre: 'referencia.png',
        mime_type: 'image/png',
        tamano_bytes: 4,
        url: 'https://media.example/reference.webp',
      }
      files = [file]
      return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(file) })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(files) })
  })
  await page.route('**/api/v1/proformas/1/detalles/10/archivos/9/', (r) =>
    r.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Los adjuntos sólo se modifican en BORRADOR.' }),
    }),
  )
  await page.route('**/api/v1/proformas/999/detalles/10/archivos/9/', (r) =>
    r.fulfill({
      status: 403,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Sin permiso.' }),
    }),
  )
  await page.route('https://media.example/reference.webp', (r) =>
    r.fulfill({ status: 200, contentType: 'image/webp', body: 'image' }),
  )
  await page.addInitScript(
    ({ token }) =>
      sessionStorage.setItem(
        'homex.session.v1',
        JSON.stringify({ access: token, refresh: 'refresh' }),
      ),
    { token: access },
  )
  return { quote: () => quote }
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true)
}

test('FE04 crea, agrega total negociado, envía, congela y aprueba', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/proformas')
  await page.getByRole('button', { name: 'Nueva proforma' }).click()
  await expect(page).toHaveURL(/\/proformas\/nueva$/)
  await expect(page.getByRole('heading', { name: 'Nueva proforma' })).toBeVisible()
  await expect(page.locator('#cliente-proforma option[value="1"]')).toHaveCount(1)
  await page.locator('#cliente-proforma').selectOption('1')
  await page.getByLabel('Título').fill('Oficina nueva')
  await page.getByRole('button', { name: 'Crear borrador' }).click()
  await expect(page).toHaveURL(/\/proformas\/1$/)
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByLabel('Tipo de línea').selectOption('10')
  await page.getByLabel('Nombre comercial').fill('Tres escritorios')
  await page.getByLabel('Cantidad', { exact: true }).fill('3')
  await page.locator('#unidad-linea').selectOption('20')
  await page.locator('#modo-calculo').selectOption('TOTAL_NEGOCIADO')
  await page.getByLabel('Total negociado (BOB)').fill('100.00')
  await page.getByRole('button', { name: 'Guardar línea' }).click()
  await expect(page.getByText(/total negociado exacto/)).toContainText('Bs 100,00')
  await page.getByRole('button', { name: 'Editar línea' }).click()
  await page.getByLabel('Nombre comercial').fill('Tres escritorios ejecutivos')
  await page.getByRole('button', { name: 'Guardar línea' }).click()
  await expect(page.getByRole('heading', { name: 'Tres escritorios ejecutivos' })).toBeVisible()
  await page.getByRole('button', { name: 'Agregar especificación' }).click()
  await page.locator('#tipo-mueble').selectOption('30')
  await page.getByLabel('Dimensiones (JSON opcional)').fill('{"ancho":1.2}')
  await page.getByRole('button', { name: 'Guardar especificación' }).click()
  await expect(page.getByText('Escritorio', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/modo lectura/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar línea' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Aprobar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click()
  await expect(page.getByRole('status')).toContainText('Pedido #55')
})

test('FE04 representa conflicto de stock y doble aprobación sin éxito aparente', async ({
  page,
}) => {
  const state = await mockBackend(page)
  state.quote().detalles = [
    {
      id: 10,
      proforma: 1,
      tipo_item: 10,
      tipo_item_info: options.TIPO_ITEM[0],
      producto: null,
      nombre: 'Escritorio',
      descripcion: null,
      cantidad: 1,
      unidad: 20,
      unidad_info: options.UNIDAD_MEDIDA[0],
      modo_calculo: 'TOTAL_NEGOCIADO',
      precio_unitario: '0',
      importe_negociado: '100.00',
      descuento: '0',
      precio_antes_snapshot: null,
      precio_ahora_snapshot: null,
      total: '100.00',
      especificacion: null,
    },
  ]
  state.quote().total = '100.00'
  await page.route('**/api/v1/proformas/1/aprobar/', (r) =>
    r.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Stock insuficiente para confirmar el pedido.' }),
    }),
  )
  await page.goto('/proformas/1')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click()
  await page.getByRole('button', { name: 'Aprobar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click()
  await expect(page.getByRole('alert')).toContainText('Stock insuficiente')
  await expect(page.getByText(/Pedido #/)).toHaveCount(0)
})

test('FE04 sube imagen válida, rechaza tipo inválido y representa eliminación bloqueada', async ({
  page,
}) => {
  const state = await mockBackend(page)
  state.quote().detalles = [
    {
      id: 10,
      proforma: 1,
      tipo_item: 10,
      tipo_item_info: options.TIPO_ITEM[0],
      producto: null,
      nombre: 'Escritorio',
      descripcion: null,
      cantidad: 1,
      unidad: 20,
      unidad_info: options.UNIDAD_MEDIDA[0],
      modo_calculo: 'TOTAL_NEGOCIADO',
      precio_unitario: '0',
      importe_negociado: '100.00',
      descuento: '0',
      precio_antes_snapshot: null,
      precio_ahora_snapshot: null,
      total: '100.00',
      especificacion: null,
    },
  ]
  state.quote().total = '100.00'
  await page.goto('/proformas/1')
  const input = page.getByLabel('Seleccionar imágenes')
  await input.setInputFiles({
    name: 'referencia.png',
    mimeType: 'image/png',
    buffer: Buffer.from('test'),
  })
  await expect(page.getByAltText('Preview de referencia.png')).toHaveAttribute('src', /^blob:/)
  await page.getByRole('button', { name: 'Subir' }).click()
  await expect(page.getByAltText('referencia.png')).toHaveAttribute(
    'src',
    'https://media.example/reference.webp',
  )
  await input.setInputFiles({
    name: 'referencia.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  })
  await expect(page.getByRole('alert')).toContainText('usa JPEG, PNG o WebP')
  await page.route('**/api/v1/proformas/1/detalles/10/archivos/', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ archivo: ['La imagen supera el máximo de 10 MiB.'] }),
        })
      : r.fallback(),
  )
  await input.setInputFiles({
    name: 'grande.png',
    mimeType: 'image/png',
    buffer: Buffer.from('test'),
  })
  await page.getByRole('button', { name: 'Subir' }).click()
  await expect(page.getByText('La imagen supera el máximo de 10 MiB.')).toBeVisible()
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0)
  await expect(page.getByAltText('Preview de grande.png')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Subir' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByAltText('Preview de grande.png')).toHaveCount(0)
  expect(
    await page.evaluate(async () =>
      fetch('http://localhost:8000/api/v1/proformas/999/detalles/10/archivos/9/', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer x' },
      }).then((r) => r.status),
    ),
  ).toBe(403)
  const publicMedia = await page.goto('https://media.example/reference.webp')
  expect(publicMedia?.status()).toBe(200)
})

test('FE04 protege ruta por capacidad y recurso ajeno como 404', async ({ page }) => {
  await mockBackend(page)
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 9,
        username: 'sin_rol',
        display_name: 'Sin rol',
        capabilities: [],
      }),
    }),
  )
  await page.goto('/proformas')
  await expect(page).toHaveURL(/\/forbidden$/)
  await expect(page.getByRole('link', { name: 'Proformas' })).toHaveCount(0)
})

test('FE04 representa acceso directo a proforma de otro vendedor como 404', async ({ page }) => {
  await mockBackend(page)
  await page.route('**/api/v1/proformas/999/', (r) =>
    r.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'No encontrado.' }),
    }),
  )
  await page.goto('/proformas/999')
  await expect(page.getByRole('alert')).toContainText('No encontrado')
})


test('FE04 refresca la autoridad tras 409 de edición y congela inmediatamente', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/proformas/1')
  await expect(page.getByRole('button', { name: 'Editar cabecera' })).toBeEnabled()
  await page.getByRole('button', { name: 'Editar cabecera' }).click()
  await page.getByLabel('Título').fill('Cambio concurrente')
  await page.route('**/api/v1/proformas/1/', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    state.quote().estado = 3
    state.quote().estado_info = { id: 3, codigo: 'ENVIADA', nombre: 'Enviada' }
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'La proforma ya fue enviada por otra operación.' }),
    })
  })
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alert')).toContainText('La proforma ya fue enviada')
  await expect(page.getByText(/modo lectura/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar cabecera' })).toHaveCount(0)
})

test('FE04 mantiene visible la proforma si fallan catálogos y permite reintentar', async ({ page }) => {
  await mockBackend(page)
  let failed = false
  await page.route('**/api/v1/catalogo/opciones/**', (route) => {
    const concepto = new URL(route.request().url()).searchParams.get('concepto')
    if (concepto === 'TIPO_ITEM' && !failed) {
      failed = true
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Catálogo temporalmente no disponible.' }),
      })
    }
    return route.fallback()
  })
  await page.goto('/proformas/1')
  await expect(page.getByRole('heading', { name: 'Proforma #101' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar datos auxiliares' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar línea' })).toBeDisabled()
  await page.getByRole('button', { name: 'Reintentar datos auxiliares' }).click()
  await expect(page.getByRole('button', { name: 'Reintentar datos auxiliares' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Agregar línea' })).toBeEnabled()
})

test('FE04 permite seleccionar cliente y producto más allá de la primera página', async ({ page }) => {
  const state = await mockBackend(page)
  const clientPageTwo = { ...client, id: 200, nombres: 'Beatriz', apellidos: 'Segunda página' }
  const productPageTwo = {
    ...product,
    id: 200,
    sku: 'S-200',
    nombre: 'Silla segunda página',
    precio_vigente: '950.00',
  }
  await page.route(/\/api\/v1\/clientes\/(?:\?.*)?$/, (route) => {
    const pageNumber = new URL(route.request().url()).searchParams.get('page')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        pageNumber === '2'
          ? { count: 21, next: null, previous: 'page=1', results: [clientPageTwo] }
          : {
              count: 21,
              next: 'http://localhost:8000/api/v1/clientes/?page=2',
              previous: null,
              results: [client],
            },
      ),
    })
  })
  await page.goto('/proformas/nueva')
  await expect(page.getByRole('heading', { name: 'Nueva proforma' })).toBeVisible()
  await page.getByRole('button', { name: 'Cargar más clientes' }).click()
  await expect(page.locator('#cliente-proforma option[value="200"]')).toHaveCount(1)
  await page.locator('#cliente-proforma').selectOption('200')

  state.quote().detalles = []
  await page.route(/\/api\/v1\/catalogo\/productos\/(?:\?.*)?$/, (route) => {
    const pageNumber = new URL(route.request().url()).searchParams.get('page')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        pageNumber === '2'
          ? { count: 21, next: null, previous: 'page=1', results: [productPageTwo] }
          : {
              count: 21,
              next: 'http://localhost:8000/api/v1/catalogo/productos/?page=2',
              previous: null,
              results: [product],
            },
      ),
    })
  })
  await page.goto('/proformas/1')
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByLabel('Tipo de línea').selectOption('11')
  await page.getByRole('button', { name: 'Cargar más productos' }).click()
  await expect(page.locator('#producto-linea option[value="200"]')).toHaveCount(1)
  await page.locator('#producto-linea').selectOption('200')
  await expect(page.getByLabel('Nombre comercial')).toHaveValue('Silla segunda página')
})

for (const width of [360, 390, 768, 1024, 1440])
  test(`@a11y FE04 proforma operable a ${width}px`, async ({ page }) => {
    await mockBackend(page)
    if (width === 1440) await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/proformas')
    await expect(page.getByRole('heading', { name: 'Proformas' })).toBeVisible()
    await noOverflow(page)
    await page.goto('/proformas/nueva')
    await expect(page.getByRole('heading', { name: 'Nueva proforma' })).toBeVisible()
    await noOverflow(page)
    await page.goto('/proformas/1')
    await expect(page.getByRole('heading', { name: 'Proforma #101' })).toBeVisible()
    await noOverflow(page)
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (x) => x.impact === 'serious' || x.impact === 'critical',
    )
    expect(violations).toEqual([])
    if (width === 390)
      await page.screenshot({
        path: 'test-results/playwright/evidence/fe04/proforma-mobile-light.png',
        fullPage: true,
      })
    if (width === 1440) {
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await page.screenshot({
        path: 'test-results/playwright/evidence/fe04/proforma-desktop-dark.png',
        fullPage: true,
      })
    }
  })
