import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const access = ['eyJhbGciOiJub25lIn0', 'eyJ1c2VyX2lkIjoyfQ', 'signature'].join('.')

const resumenMock = {
  fecha_referencia: '2026-11-27',
  vendedor_id: 2,
  indicadores: {
    total_proformas: 145,
    borradores: 13,
    proformas_formalizadas: 124,
    pedidos_generados: 26,
    pedidos_derivados_cohorte: 26,
    pedidos_no_cancelados_cohorte: 25,
    pedidos_confirmados_periodo: 26,
    pedidos_no_cancelados: 25,
    tasa_conversion_cohorte: '20.97',
    cobertura_formalizacion: {
      con_marca_temporal: 0,
      aproximadas_por_fecha: 124,
      anuladas_sin_evidencia_formalizacion: 8,
    },
    distribucion_proformas_estado: [
      { codigo: 'VENCIDA', nombre: 'Vencida', cantidad: 50 },
      { codigo: 'APROBADA', nombre: 'Aprobada', cantidad: 26 },
      { codigo: 'EN_REVISION', nombre: 'En revisión', cantidad: 11 },
    ],
    distribucion_pedidos_estado: [
      { codigo: 'ENTREGADO', nombre: 'Entregado', cantidad: 11 },
      { codigo: 'EN_PRODUCCION', nombre: 'En producción', cantidad: 6 },
      { codigo: 'LISTO_ENTREGA', nombre: 'Listo para entrega', cantidad: 4 },
    ],
    comparaciones_periodo_anterior: null,
    limitaciones: ['Aproximación histórica por proformas.fecha.'],
  },
  finanzas: {
    por_moneda: [
      {
        moneda: 'BOB',
        importe_pedidos_no_cancelados: '170717.37',
        cobros_validos_periodo: '108585.01',
        cobros_acumulados_cartera_vigente: '108585.01',
        saldo_pendiente: '62132.36',
        porcentaje_cobrado: '63.61',
      },
    ],
    cobros_pedidos_cancelados: [],
  },
  evolucion: {
    granularidad: 'mensual',
    puntos_conteo: [
      { periodo: '2026-10-01', proformas_formalizadas: 48, pedidos_generados: 10 },
      { periodo: '2026-11-01', proformas_formalizadas: 76, pedidos_generados: 16 },
    ],
    series_monetarias: [
      {
        moneda: 'BOB',
        puntos: [
          {
            periodo: '2026-10-01',
            importe_pedidos_no_cancelados: '70000.00',
            cobros_registrados: '50000.00',
          },
          {
            periodo: '2026-11-01',
            importe_pedidos_no_cancelados: '100717.37',
            cobros_registrados: '58585.01',
          },
        ],
      },
    ],
  },
}

const seguimientoMock = {
  fecha_referencia: '2026-11-27',
  vendedor_id: 2,
  agenda: {
    resumen_conteos: {
      proformas_proximas_vencer: 1,
      proformas_pendientes_revision: 1,
      proformas_enviadas: 0,
      pedidos_listos_entrega: 1,
      pedidos_con_saldo_pendiente: 1,
      entregas_proximas: 1,
      entregas_retrasadas: 0,
    },
    elementos: {
      total: 2,
      page: 1,
      page_size: 20,
      results: [
        {
          tipo_documento: 'PROFORMA',
          documento_id: 486,
          proforma_id: 486,
          pedido_id: null,
          numero_documento: 486,
          cliente_nombre: 'Víctor Morales',
          fecha: '2026-12-02',
          estado_codigo: 'EN_REVISION',
          estado_nombre: 'En revisión',
          prioridad: 'MEDIA',
          categoria_agenda: 'PROFORMA_PROXIMA_VENCER',
          dias_diferencia: 5,
        },
        {
          tipo_documento: 'PEDIDO',
          documento_id: 88,
          proforma_id: 400,
          pedido_id: 88,
          numero_documento: 400,
          cliente_nombre: 'Elena Miranda',
          fecha: '2026-11-29',
          estado_codigo: 'LISTO_ENTREGA',
          estado_nombre: 'Listo para entrega',
          prioridad: 'ALTA',
          categoria_agenda: 'PEDIDO_LISTO_ENTREGA',
          dias_diferencia: 2,
        },
      ],
    },
  },
  disponibilidad: {
    resumen: {
      total_activos: 37,
      con_stock_disponible: 28,
      con_stock_bajo: 0,
      con_stock_agotado: 3,
      bajo_pedido: 6,
      sin_stock_minimo: 31,
    },
    productos: {
      total: 2,
      page: 1,
      page_size: 20,
      results: [
        {
          producto_id: 1,
          sku: 'S-101',
          nombre: 'Silla Ejecutiva',
          categoria_codigo: 'SILLA',
          categoria_nombre: 'Silla',
          modalidad_abastecimiento: 'CON_STOCK',
          stock: '12.0000',
          stock_minimo: null,
          unidad_codigo: 'PIEZA',
          unidad_nombre: 'Pieza',
          estado_disponibilidad: 'DISPONIBLE',
          imagen_principal: null,
        },
        {
          producto_id: 2,
          sku: 'PF-201',
          nombre: 'Piso Flotante Roble',
          categoria_codigo: 'PISO_FLOTANTE',
          categoria_nombre: 'Piso flotante',
          modalidad_abastecimiento: 'BAJO_PEDIDO',
          stock: '0.0000',
          stock_minimo: null,
          unidad_codigo: 'M2',
          unidad_nombre: 'Metro cuadrado',
          estado_disponibilidad: 'BAJO_PEDIDO',
          imagen_principal: null,
        },
      ],
    },
  },
}

async function setupTiendaRoutes(page: Page) {
  await page.addInitScript(
    ({ access }) =>
      sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'refresh' })),
    { access },
  )
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: {} }))
  await page.route('**/api/v1/auth/token/refresh/', (r) =>
    r.fulfill({ json: { access, refresh: 'refresh' } }),
  )
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({
      json: {
        id: 2,
        username: 'alvaro.huallpa',
        display_name: 'Alvaro Huallpa',
        capabilities: ['comercial.operar'],
        entorno_evaluacion: true,
      },
    }),
  )
  await page.route('**/api/v1/catalogo/opciones/**', (r) =>
    r.fulfill({
      json: [{ id: 12, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: 'CATEGORIA_PRODUCTO' }],
    }),
  )
  await page.route('**/api/v1/dashboard/tienda/seguimiento/**', (r) =>
    r.fulfill({ json: seguimientoMock }),
  )
  await page.route(/\/api\/v1\/dashboard\/tienda\/(?:\?.*)?$/, (r) =>
    r.fulfill({ json: resumenMock }),
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

test('@a11y Fase 3 TiendaDashboard cumple accesibilidad, renderiza gráficos y responsive', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  await setupTiendaRoutes(page)
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/resumen')
    await expect(page.getByRole('heading', { name: 'Mi actividad comercial' })).toBeVisible()
    await expect(page.getByTestId('demo-mode-indicator')).toBeVisible()
    await assertAllVisibleChartsRendered(page, 2)
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    )
    expect(noOverflow).toBe(true)
    if (width === 1440 || width === 390) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  const mainTabs = page.getByRole('tablist', { name: 'Secciones de mi actividad comercial' })
  await mainTabs.getByRole('tab', { name: /Proformas/i }).click()
  await assertAllVisibleChartsRendered(page, 1)

  await mainTabs.getByRole('tab', { name: /Pedidos y cobros/i }).click()
  await assertAllVisibleChartsRendered(page, 2)

  await mainTabs.getByRole('tab', { name: /Disponibilidad/i }).click()
  await assertAllVisibleChartsRendered(page, 1)

  await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
  await page.goto('/resumen')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await assertAllVisibleChartsRendered(page, 2)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(consoleErrors).toEqual([])
})
