import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const access = ['eyJhbGciOiJub25lIn0', 'eyJ1c2VyX2lkIjo0fQ', 'signature'].join('.')

const tallerMock = {
  fecha_referencia: '2026-11-27',
  indicadores: {
    pendientes: 2,
    en_proceso: 12,
    terminadas: 16,
    canceladas: 2,
    carga_activa_fabricacion: 14,
    fabricaciones_iniciadas_periodo: 28,
    fabricaciones_terminadas_periodo: 16,
    tiempo_promedio_fabricacion_horas: 135.53,
    tiempo_promedio_fabricacion_dias: 5.65,
    ordenes_con_duracion_medible: 16,
    antiguedad_promedio_activas_dias: 14.08,
    antiguedad_maxima_activas_dias: 37,
    ordenes_con_antiguedad_medible: 12,
    entregas_proximas: 2,
    entregas_retrasadas: 0,
    entregas_efectivas: 13,
    entregas_evaluables_plazo: 13,
    entregas_en_plazo: 13,
    cumplimiento_entregas_porcentaje: '100.00',
  },
  cola_prioridades: {
    total: 2,
    page: 1,
    page_size: 50,
    results: [
      {
        orden_trabajo_id: 31,
        numero_ot: 31,
        cliente_nombre: 'Mauricio Zamora',
        vendedor_nombre: 'Alvaro Huallpa',
        muebles_solicitados: [
          { nombre: 'Credenza ejecutiva', tipo_mueble: 'CREDENZA', cantidad: '2.0000' },
        ],
        estado_codigo: 'EN_PROCESO',
        estado_nombre: 'En proceso',
        pedido_estado_codigo: 'EN_PRODUCCION',
        fecha_prevista: '2026-12-01',
        dias_diferencia: 4,
        categoria_prioridad: 'ENTREGA_PROXIMA',
      },
      {
        orden_trabajo_id: 35,
        numero_ot: 35,
        cliente_nombre: 'Lucía Paredes',
        vendedor_nombre: 'Rodrigo Ramos',
        muebles_solicitados: [
          { nombre: 'Escritorio en L', tipo_mueble: 'ESCRITORIO', cantidad: '1.0000' },
        ],
        estado_codigo: 'PENDIENTE',
        estado_nombre: 'Pendiente',
        pedido_estado_codigo: 'CONFIRMADO',
        fecha_prevista: '2026-12-05',
        dias_diferencia: 8,
        categoria_prioridad: 'PENDIENTE_INICIAR',
      },
    ],
  },
}

const planificacionMock = {
  fecha_referencia: '2026-11-27',
  calendario_eventos: {
    total: 1,
    page: 1,
    page_size: 50,
    results: [
      {
        orden_trabajo_id: 31,
        numero_ot: 31,
        tipo_evento: 'ENTREGA_PREVISTA',
        naturaleza: 'PLANIFICADA',
        fecha: '2026-12-01',
        fecha_hora: null,
        cliente_nombre: 'Mauricio Zamora',
        estado_codigo: 'EN_PROCESO',
      },
    ],
  },
  analisis_fabricacion: {
    granularidad: 'mensual',
    evolucion_fabricaciones: [
      { periodo: '2026-10-01', iniciadas: 11, terminadas: 8 },
      { periodo: '2026-11-01', iniciadas: 17, terminadas: 8 },
    ],
    duracion_promedio_horas: 135.53,
    duracion_promedio_dias: 5.65,
    ordenes_con_duracion_medible: 16,
    muebles_fabricados_por_tipo: [
      {
        tipo_mueble_codigo: 'CREDENZA',
        tipo_mueble_nombre: 'Credenza',
        cantidad_fabricada: '12.0000',
        ordenes_count: 7,
      },
      {
        tipo_mueble_codigo: 'MESA_REUNION',
        tipo_mueble_nombre: 'Mesa de reunión',
        cantidad_fabricada: '7.0000',
        ordenes_count: 4,
      },
    ],
    distribucion_ordenes_estado: [
      { codigo: 'PENDIENTE', nombre: 'Pendiente', cantidad: 2 },
      { codigo: 'EN_PROCESO', nombre: 'En proceso', cantidad: 12 },
      { codigo: 'TERMINADA', nombre: 'Terminada', cantidad: 16 },
    ],
  },
}

async function setupTallerRoutes(page: Page) {
  await page.addInitScript(
    ({ token }) =>
      sessionStorage.setItem(
        'homex.session.v1',
        JSON.stringify({ access: token, refresh: 'refresh' }),
      ),
    { token: access },
  )
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: {} }))
  await page.route('**/api/v1/auth/token/refresh/', (r) =>
    r.fulfill({ json: { access, refresh: 'refresh' } }),
  )
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({
      json: {
        id: 4,
        username: 'antonio.flores',
        display_name: 'Antonio Flores',
        capabilities: ['taller.operar'],
        entorno_evaluacion: true,
      },
    }),
  )
  await page.route('**/api/v1/dashboard/taller/planificacion/**', (r) =>
    r.fulfill({ json: planificacionMock }),
  )
  await page.route(/\/api\/v1\/dashboard\/taller\/(?:\?.*)?$/, (r) =>
    r.fulfill({ json: tallerMock }),
  )
}

async function assertAllVisibleChartsRendered(page: Page, expectedCount: number) {
  const charts = page.locator('.echart-box__canvas')
  await expect(charts).toHaveCount(expectedCount)
  for (let i = 0; i < expectedCount; i += 1) {
    const chart = charts.nth(i)
    await expect(chart).toHaveAttribute('data-rendered', 'true', { timeout: 10000 })
    await expect(chart).toHaveAttribute('data-finished', 'true', { timeout: 10000 })
    const seriesCount = Number(await chart.getAttribute('data-series-count'))
    expect(seriesCount).toBeGreaterThan(0)
    const hasDrawnPixels = await chart.evaluate((el) => {
      const canvas = el.querySelector('canvas')
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false
      const ctx = canvas.getContext('2d')
      if (!ctx) return false
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let p = 3; p < data.length; p += 16) {
        if ((data[p] ?? 0) > 0) return true
      }
      return false
    })
    expect(hasDrawnPixels).toBe(true)
  }
}

test('@a11y Fase 4 TallerDashboard cumple accesibilidad, renderiza gráficos y responsive', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  await setupTallerRoutes(page)
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/resumen')
    await expect(page.getByRole('heading', { name: 'Operación de taller' })).toBeVisible()
    await expect(page.getByText(/Corte:/)).toHaveCount(0)
    await assertAllVisibleChartsRendered(page, 1)
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    )
    expect(noOverflow).toBe(true)
    if (width === 1440 || width === 390) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  const mainTabs = page.getByRole('tablist', { name: 'Secciones de operación de taller' })
  await mainTabs.getByRole('tab', { name: /Producción y tiempos/i }).click()
  await assertAllVisibleChartsRendered(page, 1)

  await mainTabs.getByRole('tab', { name: /Planificación y entregas/i }).click()
  await expect(page.getByRole('link', { name: 'OT #31' })).toHaveAttribute(
    'href',
    '/ordenes-trabajo/31',
  )

  await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
  await page.goto('/resumen')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await assertAllVisibleChartsRendered(page, 1)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(consoleErrors).toEqual([])
})
