import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const states = [
  { id: 1, codigo: 'CONFIRMADO', nombre: 'Confirmado', concepto_codigo: 'ESTADO_PEDIDO' },
  {
    id: 2,
    codigo: 'LISTO_ENTREGA',
    nombre: 'Listo para entrega',
    concepto_codigo: 'ESTADO_PEDIDO',
  },
  { id: 3, codigo: 'CANCELADO', nombre: 'Cancelado', concepto_codigo: 'ESTADO_PEDIDO' },
]
const payment = [{ id: 7, codigo: 'EFECTIVO', nombre: 'Efectivo', concepto_codigo: 'TIPO_PAGO' }]
const movementTypes = [
  { id: 12, codigo: 'VENTA', nombre: 'Venta', concepto_codigo: 'TIPO_MOVIMIENTO' },
  {
    id: 13,
    codigo: 'REVERSA_VENTA',
    nombre: 'Reversa de venta',
    concepto_codigo: 'TIPO_MOVIMIENTO',
  },
]
const pedido = {
  id: 9,
  fecha_confirmacion: '2026-09-26T12:00:00Z',
  proforma: 4,
  estado: 1,
  created_by: 7,
  updated_by: 7,
}
const detalleOt = {
  id: 21,
  proforma: 4,
  tipo_item: 1,
  tipo_item_info: { id: 1, codigo: 'SILLA', nombre: 'Silla' },
  producto: 8,
  nombre: 'Silla ejecutiva',
  descripcion: null,
  cantidad: 1,
  unidad: 2,
  unidad_info: { id: 2, codigo: 'PIEZA', nombre: 'Pieza' },
  modo_calculo: 'PRECIO_UNITARIO',
  precio_unitario: '300.00',
  importe_negociado: null,
  descuento: '0.00',
  precio_antes_snapshot: null,
  precio_ahora_snapshot: null,
  total: '300.00',
  especificacion: null,
}
const orden = {
  id: 3,
  pedido: 9,
  proforma_numero: 4,
  jefe_taller: null,
  numero: 40,
  fecha: '2026-09-26',
  fecha_inicio: null,
  fecha_fin: null,
  responsable_recepcion: null,
  fecha_entrega: null,
  lugar_entrega: null,
  estado_saldo: null,
  estado_saldo_info: null,
  estado: 20,
  estado_info: { id: 20, codigo: 'PENDIENTE', nombre: 'Pendiente' },
  created_by: 7,
  updated_by: 7,
  detalles: [detalleOt],
}
const recibo = {
  id: 5,
  numero: 18,
  nombre_completo: 'Ana Pérez',
  monto_en_letras: 'Cien bolivianos',
  concepto: 'Anticipo',
  numero_cheque: null,
  banco: null,
  total: '300.00',
  pago_actual: '100.00',
  a_cuenta: '100.00',
  saldo: '200.00',
  estado: 'EMITIDO',
  fecha: '2026-09-26',
  pedido: 9,
  tipo_pago: 7,
  created_by: 7,
  updated_by: 7,
}

async function mock(page: Page) {
  await page.addInitScript(
    ({ access }) =>
      sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'refresh' })),
    { access },
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
  await page.route('**/api/v1/catalogo/opciones/**', (route) => {
    const concepto = new URL(route.request().url()).searchParams.get('concepto')
    const json =
      concepto === 'TIPO_PAGO' ? payment : concepto === 'TIPO_MOVIMIENTO' ? movementTypes : states
    return route.fulfill({ json })
  })
  await page.route('**/api/v1/pedidos/', (route) => route.fulfill({ json: [pedido] }))
  await page.route('**/api/v1/pedidos/9/', (route) => route.fulfill({ json: pedido }))
  await page.route('**/api/v1/ordenes-trabajo/', (route) => route.fulfill({ json: [orden] }))
  await page.route('**/api/v1/ordenes-trabajo/3/', (route) => route.fulfill({ json: orden }))
  await page.route('**/api/v1/ordenes-trabajo/3/documento/', (route) =>
    route.fulfill({
      body: '<html><body>Orden 40</body></html>',
      contentType: 'text/html',
      headers: { 'Content-Disposition': 'attachment; filename="orden-trabajo-40.html"' },
    }),
  )
  await page.route(/\/api\/v1\/movimientos-stock\/(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 31,
            fecha: '2026-09-26T12:10:00Z',
            tipo_movimiento: 12,
            tipo_movimiento_info: { id: 12, codigo: 'VENTA', nombre: 'Venta' },
            cantidad: -1,
            producto: 8,
            producto_resumen: {
              id: 8,
              sku: 'SILLA-01',
              nombre: 'Silla ejecutiva',
              unidad_stock_info: { id: 1, codigo: 'PIEZA', nombre: 'Pieza' },
            },
            pedido: 9,
            pedido_relacionado: 9,
            movimiento_referencia: null,
            observaciones: 'Salida por pedido',
            created_by: 7,
            responsable: { id: 7, username: 'vendedor', display_name: 'Ana Vendedora' },
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/recibos/', (route) => route.fulfill({ json: [recibo] }))
  await page.route('**/api/v1/recibos/5/', (route) => route.fulfill({ json: recibo }))
  await page.route('**/api/v1/notas-entrega/', (route) => route.fulfill({ json: [] }))
}

test('FE05 recorre módulos operativos sin porcentajes inventados', async ({ page }) => {
  await mock(page)
  await page.goto('/pedidos')
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible()
  await expect(page.getByText('72%')).toHaveCount(0)
  await page.getByRole('link', { name: 'Ver detalle' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido #9' })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: 'Confirmado' })).toBeVisible()
})

test('FE05 navegación expone OT, notas, recibos y stock como módulos reales', async ({ page }) => {
  await mock(page)
  await page.goto('/ordenes-trabajo')
  await expect(page.getByRole('heading', { name: 'Órdenes de trabajo' })).toBeVisible()
  await expect(page.getByText('Pendiente')).toBeVisible()

  await page.goto('/recibos')
  await expect(page.getByText('Bs 100,00')).toBeVisible()

  await page.goto('/notas-entrega')
  await expect(page.getByText('Sin notas de entrega')).toBeVisible()

  await page.goto('/movimientos-stock')
  await expect(page.getByRole('heading', { name: 'Movimientos de stock' })).toBeVisible()
  await expect(page.getByText('Silla ejecutiva')).toBeVisible()
  await expect(page.getByText('-1')).toBeVisible()
  await expect(page.getByText('Pieza')).toBeVisible()
  await expect(page.getByText('Ana Vendedora')).toBeVisible()
  await expect(page.getByText('#9')).toBeVisible()
})

test('AP6.1 conserva reversa M2, CAJA histórica y actor sistema', async ({ page }) => {
  await mock(page)
  await page.route(/\/api\/v1\/movimientos-stock\/(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        count: 3,
        next: null,
        previous: null,
        results: [
          {
            id: 32,
            fecha: '2026-09-26T12:20:00Z',
            tipo_movimiento: 13,
            tipo_movimiento_info: {
              id: 13,
              codigo: 'REVERSA_VENTA',
              nombre: 'Reversa de venta',
            },
            cantidad: '2.5000',
            producto: 80,
            producto_resumen: {
              id: 80,
              sku: 'PISO-M2',
              nombre: 'Piso decimal',
              unidad_stock_info: { id: 24, codigo: 'M2', nombre: 'Metro cuadrado' },
            },
            pedido: null,
            pedido_relacionado: 9,
            movimiento_referencia: 31,
            observaciones: 'Reversa de venta original',
            created_by: null,
            responsable: null,
          },
          {
            id: 33,
            fecha: '2026-09-26T12:15:00Z',
            tipo_movimiento: 14,
            tipo_movimiento_info: { id: 14, codigo: 'AJUSTE', nombre: 'Ajuste' },
            cantidad: '1.0000',
            producto: 80,
            producto_resumen: {
              id: 80,
              sku: 'PISO-M2',
              nombre: 'Ajuste independiente',
              unidad_stock_info: { id: 24, codigo: 'M2', nombre: 'Metro cuadrado' },
            },
            pedido: null,
            pedido_relacionado: null,
            movimiento_referencia: 31,
            observaciones: 'Recuento',
            created_by: 7,
            responsable: { id: 7, username: 'vendedor', display_name: 'Vendedor' },
          },
          {
            id: 34,
            fecha: '2026-09-26T12:10:00Z',
            tipo_movimiento: 15,
            tipo_movimiento_info: { id: 15, codigo: 'CARGA_INICIAL', nombre: 'Carga inicial' },
            cantidad: '3.0000',
            producto: 81,
            producto_resumen: {
              id: 81,
              sku: 'PISO-HISTORICO',
              nombre: 'Piso histórico',
              unidad_stock_info: { id: 25, codigo: 'CAJA', nombre: 'Caja' },
            },
            pedido: null,
            pedido_relacionado: null,
            movimiento_referencia: null,
            observaciones: 'Existencias heredadas',
            created_by: 7,
            responsable: { id: 7, username: 'vendedor', display_name: 'Vendedor' },
          },
        ],
      },
    }),
  )
  await page.goto('/movimientos-stock')
  const reversa = page.getByRole('row').filter({ hasText: 'Piso decimal' })
  await expect(reversa).toContainText('2.5000')
  await expect(reversa).toContainText('Metro cuadrado')
  await expect(reversa).toContainText('#9')
  await expect(reversa).toContainText('#31')
  await expect(reversa).toContainText('Sistema')

  const ajuste = page.getByRole('row').filter({ hasText: 'Ajuste independiente' })
  await expect(ajuste).toContainText('Sin pedido')
  await expect(ajuste).toContainText('#31')
  await expect(ajuste).not.toContainText('#9')

  const historico = page.getByRole('row').filter({ hasText: 'Piso histórico' })
  await expect(historico).toContainText('3.0000')
  await expect(historico).toContainText('Caja')
  await expect(historico).not.toContainText('Metro cuadrado')
})

test('FE05 OT muestra líneas reales y permite descargar su documento', async ({ page }) => {
  await mock(page)
  await page.goto('/ordenes-trabajo/3')
  await expect(page.getByRole('heading', { name: 'Orden de trabajo #40' })).toBeVisible()
  await expect(page.getByText('Silla ejecutiva')).toBeVisible()
  await expect(page.getByText('Pieza')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('orden-trabajo-40.html')
})

test('AP6.0.21 OT muestra ficha técnica autorizada', async ({ page }) => {
  await mock(page)
  await page.route('**/api/v1/auth/me/', (route) =>
    route.fulfill({
      json: {
        id: 7,
        username: 'jefe',
        display_name: 'Jefe de taller',
        capabilities: ['taller.operar'],
      },
    }),
  )
  await page.route('**/api/v1/ordenes-trabajo/3/', (route) =>
    route.fulfill({
      json: {
        ...orden,
        detalles: [
          detalleOt,
          {
            id: 88,
            nombre: 'Escritorio a medida',
            descripcion: 'Color pendiente',
            cantidad: '1.0000',
            unidad_info: { id: 2, codigo: 'PIEZA', nombre: 'Pieza' },
            tipo_item_info: { id: 9, codigo: 'MUEBLE_MEDIDA', nombre: 'A medida' },
            producto: null,
            familia_producto: null,
            especificacion: {
              tipo_mueble_info: null,
              observaciones: 'Conservar pieza original',
              datos_tecnicos: {
                componentes: [
                  { nombre: 'Mesón', color: 'Nogal' },
                  { nombre: 'Estructura', espesor: '18 mm' },
                ],
                advertencias: ['color a elección'],
              },
            },
          },
        ],
      },
    }),
  )
  await page.goto('/ordenes-trabajo/3')
  await expect(page.getByText('Escritorio a medida')).toBeVisible()
  await page.getByText('2 componentes').click()
  await expect(page.getByText('Conservar pieza original')).toBeVisible()
  await expect(page.getByText(/color a elección/)).toBeVisible()
  await expect(page.getByText('Silla ejecutiva')).toBeVisible()
  await expect(page.getByText('precio_unitario')).toHaveCount(0)
})

for (const width of [360, 390, 768, 1024, 1440])
  test(`@a11y FE05 responsive ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mock(page)
    await page.goto('/pedidos/9')
    await expect(page.getByRole('heading', { name: 'Pedido #9' })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  })
