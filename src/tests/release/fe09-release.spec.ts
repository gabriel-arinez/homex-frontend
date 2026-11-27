import { expect, test } from '@playwright/test'

const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'

test('FE09 carga el shell público sin desbordamiento horizontal', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.getByLabel('Usuario')).toBeEditable()
  await expect(page.getByLabel('Contraseña')).toBeEditable()
  const viewport = page.viewportSize()
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth }))
  expect(layout.width).toBeLessThanOrEqual(viewport?.width ?? layout.width)
})

test('FE09 restaura sesión y permite recargar una ruta SPA operativa', async ({ page }) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
  )
  await page.route('**/api/v1/dashboard/tienda/**', (route) =>
    route.fulfill({
      json: {
        fecha_referencia: '2026-11-27',
        vendedor_id: 7,
        indicadores: {
          total_proformas: 0,
          borradores: 0,
          proformas_formalizadas: 0,
          pedidos_generados: 0,
          pedidos_derivados_cohorte: 0,
          pedidos_no_cancelados_cohorte: 0,
          pedidos_confirmados_periodo: 0,
          pedidos_no_cancelados: 0,
          tasa_conversion_cohorte: null,
          cobertura_formalizacion: {
            con_marca_temporal: 0,
            aproximadas_por_fecha: 0,
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
  await page.addInitScript(
    ({ token }) =>
      sessionStorage.setItem(
        'homex.session.v1',
        JSON.stringify({ access: token, refresh: 'refresh' }),
      ),
    { token: access },
  )

  await page.goto('/resumen')
  await expect(
    page.getByRole('heading', { name: 'Mi actividad comercial', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Mi actividad comercial', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Seguimiento comercial, proformas, pedidos y cobros.')).toBeVisible()
})
