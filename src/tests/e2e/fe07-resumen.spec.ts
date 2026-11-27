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
test('FE07 delega encargado de tienda a TiendaDashboard con accesos rápidos', async ({ page }) => {
  await mock(page)
  await page.route('**/api/v1/dashboard/tienda/**', (r) =>
    r.fulfill({
      json: {
        fecha_referencia: '2026-11-27',
        vendedor_id: 1,
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
            con_marca_temporal: 0,
            aproximadas_por_fecha: 8,
            anuladas_sin_evidencia_formalizacion: 0,
          },
          distribucion_proformas_estado: [],
          distribucion_pedidos_estado: [],
          comparaciones_periodo_anterior: null,
          limitaciones: [],
        },
        finanzas: { por_moneda: [], cobros_pedidos_cancelados: [] },
        evolucion: { granularidad: 'mensual', puntos_conteo: [], series_monetarias: [] },
        agenda: {
          resumen_conteos: {
            proformas_proximas_vencer: 0,
            proformas_pendientes_revision: 0,
            proformas_enviadas: 0,
            pedidos_listos_entrega: 0,
            pedidos_con_saldo_pendiente: 0,
            entregas_proximas: 0,
            entregas_retrasadas: 0,
          },
          elementos: { total: 0, page: 1, page_size: 20, results: [] },
        },
        disponibilidad: {
          resumen: {
            total_activos: 0,
            con_stock_disponible: 0,
            con_stock_bajo: 0,
            con_stock_agotado: 0,
            bajo_pedido: 0,
            sin_stock_minimo: 0,
          },
          productos: { total: 0, page: 1, page_size: 20, results: [] },
        },
      },
    }),
  )
  await page.goto('/resumen')
  await expect(page.getByRole('heading', { name: 'Mi actividad comercial' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nueva proforma' })).toBeVisible()
  await expect(page.getByText(/99.9|stock valorizado|eficiencia/i)).toHaveCount(0)
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
  await expect(
    page.getByText('Indicadores comerciales, financieros, operativos y de existencias.'),
  ).toBeVisible()
})
test('FE07 presenta visión operativa de taller para JEFE_TALLER', async ({ page }) => {
  await mock(page, { capabilities: ['taller.operar'] })
  const tallerMock = {
    fecha_referencia: '2026-11-27',
    indicadores: {
      pendientes: 1,
      en_proceso: 2,
      terminadas: 3,
      canceladas: 0,
      carga_activa_fabricacion: 3,
      fabricaciones_iniciadas_periodo: 2,
      fabricaciones_terminadas_periodo: 1,
      tiempo_promedio_fabricacion_horas: 48.0,
      tiempo_promedio_fabricacion_dias: 2.0,
      ordenes_con_duracion_medible: 1,
      antiguedad_promedio_activas_dias: 5.0,
      antiguedad_maxima_activas_dias: 8,
      ordenes_con_antiguedad_medible: 2,
      entregas_proximas: 1,
      entregas_retrasadas: 0,
      entregas_efectivas: 1,
      entregas_evaluables_plazo: 1,
      entregas_en_plazo: 1,
      cumplimiento_entregas_porcentaje: '100.00',
    },
    cola_prioridades: { total: 0, page: 1, page_size: 50, results: [] },
  }
  const planifMock = {
    fecha_referencia: '2026-11-27',
    calendario_eventos: { total: 0, page: 1, page_size: 50, results: [] },
    analisis_fabricacion: {
      granularidad: 'mensual',
      evolucion_fabricaciones: [],
      duracion_promedio_horas: 48.0,
      duracion_promedio_dias: 2.0,
      ordenes_con_duracion_medible: 1,
      muebles_fabricados_por_tipo: [],
      distribucion_ordenes_estado: [{ codigo: 'PENDIENTE', nombre: 'Pendiente', cantidad: 1 }],
    },
  }
  await page.route('**/api/v1/dashboard/taller/planificacion/**', (r) =>
    r.fulfill({ json: planifMock }),
  )
  await page.route(/\/api\/v1\/dashboard\/taller\/(?:\?.*)?$/, (r) =>
    r.fulfill({ json: tallerMock }),
  )
  await page.goto('/resumen')
  await expect(page.getByRole('heading', { name: 'Operación de taller' })).toBeVisible()
  await expect(page.getByText('Carga activa en taller')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Consultar órdenes de trabajo' })).toBeVisible()
})
test('@a11y FE07 funciona en tema oscuro y mantiene valores sin hover', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
  await mock(page, { capabilities: ['taller.operar'] })
  await page.route('**/api/v1/dashboard/taller/planificacion/**', (r) =>
    r.fulfill({
      json: {
        fecha_referencia: '2026-11-27',
        calendario_eventos: { total: 0, page: 1, page_size: 50, results: [] },
        analisis_fabricacion: {
          granularidad: 'mensual',
          evolucion_fabricaciones: [],
          duracion_promedio_horas: null,
          duracion_promedio_dias: null,
          ordenes_con_duracion_medible: 0,
          muebles_fabricados_por_tipo: [],
          distribucion_ordenes_estado: [],
        },
      },
    }),
  )
  await page.route(/\/api\/v1\/dashboard\/taller\/(?:\?.*)?$/, (r) =>
    r.fulfill({
      json: {
        fecha_referencia: '2026-11-27',
        indicadores: {
          pendientes: 0,
          en_proceso: 0,
          terminadas: 0,
          canceladas: 0,
          carga_activa_fabricacion: 0,
          fabricaciones_iniciadas_periodo: 0,
          fabricaciones_terminadas_periodo: 0,
          tiempo_promedio_fabricacion_horas: null,
          tiempo_promedio_fabricacion_dias: null,
          ordenes_con_duracion_medible: 0,
          antiguedad_promedio_activas_dias: null,
          antiguedad_maxima_activas_dias: null,
          ordenes_con_antiguedad_medible: 0,
          entregas_proximas: 0,
          entregas_retrasadas: 0,
          entregas_efectivas: 0,
          entregas_evaluables_plazo: 0,
          entregas_en_plazo: 0,
          cumplimiento_entregas_porcentaje: null,
        },
        cola_prioridades: { total: 0, page: 1, page_size: 50, results: [] },
      },
    }),
  )
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/resumen')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('heading', { name: 'Operación de taller' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true)
})
