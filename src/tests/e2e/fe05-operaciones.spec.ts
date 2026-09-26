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
const pedido = {
  id: 9,
  fecha_confirmacion: '2026-09-26T12:00:00Z',
  proforma: 4,
  estado: 1,
  created_by: 7,
  updated_by: 7,
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
  await page.route('**/api/v1/auth/token/refresh/', (r) =>
    r.fulfill({ json: { access, refresh: 'refresh' } }),
  )
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({
      json: {
        id: 7,
        username: 'vendedor',
        display_name: 'María Vendedora',
        capabilities: ['comercial.operar'],
      },
    }),
  )
  await page.route('**/api/v1/catalogo/opciones/**', (r) =>
    r.fulfill({
      json:
        new URL(r.request().url()).searchParams.get('concepto') === 'TIPO_PAGO' ? payment : states,
    }),
  )
  await page.route('**/api/v1/pedidos/', (r) => r.fulfill({ json: [pedido] }))
  await page.route('**/api/v1/pedidos/9/', (r) => r.fulfill({ json: pedido }))
  await page.route('**/api/v1/ordenes-trabajo/', (r) =>
    r.fulfill({
      json: [
        {
          id: 3,
          numero: 40,
          fecha: '2026-09-26',
          fecha_inicio: null,
          fecha_fin: null,
          responsable_recepcion: null,
          fecha_entrega: null,
          lugar_entrega: null,
          pedido: 9,
          jefe_taller: null,
          estado_saldo: null,
          estado: 1,
          created_by: 7,
          updated_by: 7,
        },
      ],
    }),
  )
  await page.route('**/api/v1/recibos/', (r) => r.fulfill({ json: [recibo] }))
  await page.route('**/api/v1/recibos/5/', (r) => r.fulfill({ json: recibo }))
  await page.route('**/api/v1/notas-entrega/', (r) => r.fulfill({ json: [] }))
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
test('FE05 navegación expone OT, notas y recibos como módulos reales', async ({ page }) => {
  await mock(page)
  await page.goto('/ordenes-trabajo')
  await expect(page.getByRole('heading', { name: 'Órdenes de trabajo' })).toBeVisible()
  await page.goto('/recibos')
  await expect(page.getByText('Bs 100,00')).toBeVisible()
  await page.goto('/notas-entrega')
  await expect(page.getByText('Sin notas de entrega')).toBeVisible()
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
