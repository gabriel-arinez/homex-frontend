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
    failure = '' as string | ((state: string) => boolean),
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
    const shouldFail = typeof failure === 'function' ? failure(state) : state === failure
    return shouldFail
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
test('FE07 conserva datos parciales y recupera el total al actualizar', async ({ page }) => {
  let failing = true
  await mock(page, { failure: (state) => failing && state === 'ENVIADA' })
  await page.goto('/resumen')
  await expect(page.getByRole('status')).toContainText('1 indicador no pudo actualizarse')
  await expect(page.getByText('No disponible')).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Subtotal disponible3')

  failing = false
  await page.getByRole('button', { name: 'Actualizar' }).click()

  await expect(page.getByText(/indicador no pudo actualizarse/)).toHaveCount(0)
  await expect(page.getByRole('table')).toContainText('Total consultado6')
})
test('FE07 representa cero sin fabricar actividad', async ({ page }) => {
  await mock(page, { counts: {} })
  await page.goto('/resumen')
  await expect(page.getByRole('table')).toContainText('Total consultado0')
  await expect(page.locator('.bar-row i')).toHaveCount(3)
  for (const bar of await page.locator('.bar-row i').all())
    await expect(bar).toHaveCSS('width', '0px')
  await expect(page.getByText('Revisar proformas')).toBeVisible()
})
test('FE07 presenta dashboard analítico para administrador sin alterar tienda/taller', async ({
  page,
}) => {
  await page.route('**/api/v1/dashboard/administrador/**', (r) =>
    r.fulfill({
      json: {
        fecha_referencia: '2026-11-27',
        comercial: {
          total_proformas: 10,
          borradores: 2,
          proformas_formalizadas: 8,
          pedidos_generados: 2,
          pedidos_derivados_cohorte: 2,
          pedidos_no_cancelados_cohorte: 2,
          pedidos_confirmados_periodo: 2,
          pedidos_no_cancelados: 2,
          tasa_conversion_cohorte: '25.00',
          cobertura_formalizacion: {
            con_marca_temporal: 8,
            aproximadas_por_fecha: 0,
            anuladas_sin_evidencia_formalizacion: 0,
          },
          distribucion_proformas_estado: [],
          distribucion_pedidos_estado: [],
          comparaciones_periodo_anterior: null,
          limitaciones: [],
        },
        finanzas: { por_moneda: [], cobros_pedidos_cancelados: [] },
        produccion: {
          ordenes_fabricacion_total: 0,
          ordenes_fabricacion_por_estado: [],
          ordenes_tecnicas_total: 0,
          ordenes_tecnicas_por_estado: [],
          fabricaciones_activas: 0,
          entregas_proximas: 0,
          entregas_retrasadas: 0,
          entregas_efectivas: 0,
          entregas_evaluables_plazo: 0,
          entregas_en_plazo: 0,
          cumplimiento_entregas_porcentaje: null,
        },
        inventario: {
          total_activos: 0,
          con_stock: 0,
          bajo_pedido: 0,
          stock_bajo: 0,
          agotados: 0,
          sin_stock_minimo: 0,
        },
        alertas: {
          totales: {
            proformas_proximas_vencer: 0,
            pedidos_retrasados: 0,
            fabricaciones_retrasadas: 0,
            saldos_pedidos_entregados: 0,
            productos_stock_bajo: 0,
            productos_sin_stock_minimo: 0,
          },
          proformas_proximas_vencer: [],
          pedidos_retrasados: [],
          fabricaciones_retrasadas: [],
          saldos_pedidos_entregados_por_moneda: [],
          productos_stock_bajo: [],
          productos_sin_stock_minimo: [],
        },
        indicadores: {
          total_proformas: 10,
          borradores: 2,
          proformas_formalizadas: 8,
          pedidos_generados: 2,
          pedidos_derivados_cohorte: 2,
          pedidos_no_cancelados_cohorte: 2,
          pedidos_confirmados_periodo: 2,
          pedidos_no_cancelados: 2,
          tasa_conversion_cohorte: '25.00',
          cobertura_formalizacion: {
            con_marca_temporal: 8,
            aproximadas_por_fecha: 0,
            anuladas_sin_evidencia_formalizacion: 0,
          },
          distribucion_proformas_estado: [],
          distribucion_pedidos_estado: [],
          comparaciones_periodo_anterior: null,
          limitaciones: [],
        },
        evolucion: { granularidad: 'mensual', puntos_conteo: [], series_monetarias: [] },
        vendedores: [],
        por_moneda: [],
        cobros_pedidos_cancelados: [],
        pedidos_entregados_con_saldo: { total: 0, page: 1, page_size: 10, results: [] },
        clientes_mayores_saldos_por_moneda: [],
        evolucion_cobros: [],
        resumen: {
          total_activos: 0,
          con_stock: 0,
          bajo_pedido: 0,
          stock_bajo: 0,
          agotados: 0,
          sin_stock_minimo: 0,
        },
        por_categoria: [],
        existencias_por_unidad: [],
        movimientos_por_unidad: [],
        mas_vendidos: { total: 0, page: 1, page_size: 20, results: [] },
      },
    }),
  )
  await mock(page, { capabilities: ['comercial.operar', 'comercial.administrar'] })
  await page.goto('/resumen')
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible()
  await expect(page.getByText('Supervisión administrativa global de María HOMEX.')).toBeVisible()
})
test('FE07 presenta visión operativa de taller para JEFE_TALLER', async ({ page }) => {
  await mock(page, { capabilities: ['taller.operar'] })
  await page.route('**/api/v1/ordenes-trabajo/', (r) =>
    r.fulfill({
      json: [
        {
          id: 1,
          pedido: 9,
          proforma_numero: 4,
          proforma_titulo: 'Escritorio gerencial',
          cliente_resumen: { id: 10, nombre: 'Constructora Norte', empresa: null, celular: null },
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
          created_by: 2,
          updated_by: 2,
          detalles: [
            {
              id: 88,
              tipo_item_info: { id: 9, codigo: 'MUEBLE_MEDIDA', nombre: 'A medida' },
              producto: null,
              familia_producto: null,
              nombre: 'Escritorio a medida',
              descripcion: 'Melamina',
              cantidad: '1.0000',
              unidad_info: { id: 2, codigo: 'PIEZA', nombre: 'Pieza' },
              especificacion: null,
            },
          ],
        },
      ],
    }),
  )
  await page.goto('/resumen')
  await expect(page.getByText('Operación y seguimiento de taller.')).toBeVisible()
  await expect(page.getByText('Con fabricación a medida')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Consultar órdenes de trabajo' })).toBeVisible()
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
