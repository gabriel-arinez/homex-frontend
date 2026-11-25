import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjoxfQ.signature'

const resumenMock = {
  fecha_referencia: '2026-11-27',
  comercial: {
    total_proformas: 286,
    borradores: 26,
    proformas_formalizadas: 248,
    pedidos_generados: 52,
    pedidos_derivados_cohorte: 52,
    pedidos_no_cancelados_cohorte: 49,
    pedidos_confirmados_periodo: 52,
    pedidos_no_cancelados: 49,
    tasa_conversion_cohorte: '20.97',
    cobertura_formalizacion: {
      con_marca_temporal: 0,
      aproximadas_por_fecha: 248,
      anuladas_sin_evidencia_formalizacion: 12,
    },
    distribucion_proformas_estado: [
      { codigo: 'VENCIDA', nombre: 'Vencida', cantidad: 100 },
      { codigo: 'APROBADA', nombre: 'Aprobada', cantidad: 52 },
    ],
    distribucion_pedidos_estado: [
      { codigo: 'ENTREGADO', nombre: 'Entregado', cantidad: 23 },
      { codigo: 'EN_PRODUCCION', nombre: 'En producción', cantidad: 12 },
    ],
    comparaciones_periodo_anterior: null,
    limitaciones: ['Aproximación histórica por proformas.fecha.'],
  },
  finanzas: {
    por_moneda: [
      {
        moneda: 'BOB',
        importe_pedidos_no_cancelados: '299468.87',
        cobros_validos_periodo: '184927.01',
        cobros_acumulados_cartera_vigente: '184927.01',
        saldo_pendiente: '114541.86',
        porcentaje_cobrado: '61.75',
      },
    ],
    cobros_pedidos_cancelados: [],
  },
  produccion: {
    ordenes_fabricacion_total: 31,
    ordenes_fabricacion_por_estado: [{ codigo: 'EN_PROCESO', nombre: 'En proceso', cantidad: 12 }],
    ordenes_tecnicas_total: 21,
    ordenes_tecnicas_por_estado: [{ codigo: 'TERMINADA', nombre: 'Terminada', cantidad: 15 }],
    fabricaciones_activas: 12,
    entregas_proximas: 7,
    entregas_retrasadas: 0,
    entregas_efectivas: 23,
    entregas_evaluables_plazo: 23,
    entregas_en_plazo: 23,
    cumplimiento_entregas_porcentaje: '100.00',
  },
  inventario: {
    total_activos: 37,
    con_stock: 31,
    bajo_pedido: 6,
    stock_bajo: 0,
    agotados: 3,
    sin_stock_minimo: 31,
  },
  alertas: {
    totales: {
      proformas_proximas_vencer: 1,
      pedidos_retrasados: 0,
      fabricaciones_retrasadas: 0,
      saldos_pedidos_entregados: 0,
      productos_stock_bajo: 3,
      productos_sin_stock_minimo: 31,
    },
    proformas_proximas_vencer: [
      {
        proforma_id: 10,
        numero: 101,
        cliente_nombre: 'Cliente Demo',
        vendedor_nombre: 'Alvaro Huallpa',
        fecha_vencimiento: '2026-11-29',
        dias_restantes: 2,
        moneda: 'BOB',
        total: '1500.00',
      },
    ],
    pedidos_retrasados: [],
    fabricaciones_retrasadas: [],
    saldos_pedidos_entregados_por_moneda: [],
    productos_stock_bajo: [],
    productos_sin_stock_minimo: [],
  },
}

const comercialMock = {
  fecha_referencia: '2026-11-27',
  indicadores: resumenMock.comercial,
  evolucion: {
    granularidad: 'mensual',
    puntos_conteo: [
      { periodo: '2026-10-01', proformas_formalizadas: 96, pedidos_generados: 20 },
      { periodo: '2026-11-01', proformas_formalizadas: 152, pedidos_generados: 32 },
    ],
    series_monetarias: [
      {
        moneda: 'BOB',
        puntos: [
          {
            periodo: '2026-10-01',
            importe_pedidos_no_cancelados: '120000.00',
            cobros_registrados: '85000.00',
          },
          {
            periodo: '2026-11-01',
            importe_pedidos_no_cancelados: '179468.87',
            cobros_registrados: '99927.01',
          },
        ],
      },
    ],
  },
  vendedores: [
    {
      vendedor_id: 2,
      vendedor_nombre: 'Alvaro Huallpa',
      proformas_formalizadas: 124,
      pedidos_generados: 26,
      conversion_comercial: '20.97',
      vencidas_no_concretadas: 40,
      vencidas: 25,
      no_concretadas: 15,
      montos_por_moneda: [
        {
          moneda: 'BOB',
          importe_pedidos_no_cancelados: '170717.37',
          cobros_validos: '108585.01',
          saldo_pendiente: '62132.36',
        },
      ],
    },
  ],
}

const finanzasMock = {
  por_moneda: resumenMock.finanzas.por_moneda,
  cobros_pedidos_cancelados: [],
  pedidos_entregados_con_saldo: { total: 0, page: 1, page_size: 10, results: [] },
  clientes_mayores_saldos_por_moneda: [
    {
      moneda: 'BOB',
      clientes: [
        {
          cliente_id: 5,
          cliente_nombre: 'Empresa Ejemplo SRL',
          moneda: 'BOB',
          cantidad_pedidos: 2,
          saldo_pendiente: '12500.00',
        },
      ],
    },
  ],
  evolucion_cobros: [
    {
      moneda: 'BOB',
      puntos: [
        { periodo: '2026-10-01', cantidad_recibos: 25, monto_cobrado: '85000.00' },
        { periodo: '2026-11-01', cantidad_recibos: 34, monto_cobrado: '99927.01' },
      ],
    },
  ],
}

const inventarioMock = {
  resumen: resumenMock.inventario,
  por_categoria: [
    {
      categoria_codigo: 'SILLA',
      categoria_nombre: 'Silla',
      total_activos: 25,
      con_stock: 25,
      bajo_pedido: 0,
      stock_bajo: 0,
      agotados: 3,
      sin_stock_minimo: 25,
    },
  ],
  existencias_por_unidad: [],
  movimientos_por_unidad: [],
  mas_vendidos: {
    total: 1,
    page: 1,
    page_size: 20,
    results: [
      {
        producto_id: 1,
        sku: 'S-1',
        nombre: 'Silla Ejecutiva',
        categoria_codigo: 'SILLA',
        categoria_nombre: 'Silla',
        unidad_codigo: 'PIEZA',
        unidad_nombre: 'Pieza',
        moneda: 'BOB',
        cantidad_vendida: '18.0000',
        importe_total: '12600.00',
        pedidos_count: 6,
      },
    ],
  },
}

async function setupAdminRoutes(page: Page) {
  await page.addInitScript(
    ({ access }) =>
      sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'refresh' })),
    { access },
  )
  await page.route('**/api/v1/auth/token/refresh/', (r) =>
    r.fulfill({ json: { access, refresh: 'refresh' } }),
  )
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({
      json: {
        id: 1,
        username: 'ana.huallpara',
        display_name: 'Ana Maria Huallpara',
        capabilities: ['comercial.operar', 'comercial.administrar', 'taller.operar'],
        entorno_evaluacion: true,
      },
    }),
  )
  await page.route('**/api/v1/dashboard/administrador/comercial/**', (r) =>
    r.fulfill({ json: comercialMock }),
  )
  await page.route('**/api/v1/dashboard/administrador/finanzas/**', (r) =>
    r.fulfill({ json: finanzasMock }),
  )
  await page.route('**/api/v1/dashboard/administrador/inventario/**', (r) =>
    r.fulfill({ json: inventarioMock }),
  )
  await page.route(/\/api\/v1\/dashboard\/administrador\/(?:\?.*)?$/, (r) =>
    r.fulfill({ json: resumenMock }),
  )
}

test('@a11y Fase 2 AdminDashboard cumple accesibilidad en claro, oscuro y responsive', async ({
  page,
}) => {
  await setupAdminRoutes(page)
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/resumen')
    await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible()
    await expect(page.getByTestId('demo-mode-indicator')).toBeVisible()
    await expect(page.getByText('Empresa Ejemplo SRL')).toBeVisible()
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    )
    expect(noOverflow).toBe(true)
    if (width === 1440 || width === 390) {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    }
  }

  await page.addInitScript(() => localStorage.setItem('homex.theme', 'dark'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/resumen')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('Fase 2 AdminDashboard actualiza filtros y permite alternar tabla accesible', async ({
  page,
}) => {
  const requestedUrls: string[] = []
  await setupAdminRoutes(page)
  await page.route('**/api/v1/dashboard/administrador/**', async (route) => {
    requestedUrls.push(route.request().url())
    await route.fallback()
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/resumen')
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible()

  await page.getByLabel('Selector de período').selectOption('este_mes')
  await expect
    .poll(() => requestedUrls.some((u) => u.includes('fecha_desde=2026-11-01')))
    .toBe(true)

  await page.getByRole('button', { name: 'Ver tabla de datos' }).first().click()
  await expect(page.getByRole('button', { name: 'Ocultar tabla de datos' })).toBeVisible()
})
