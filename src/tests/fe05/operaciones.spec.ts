import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import PedidoDetailView from '@/modules/pedidos/views/PedidoDetailView.vue'
import ReciboDetailView from '@/modules/recibos/views/ReciboDetailView.vue'
import { pedidosService } from '@/modules/pedidos/services/pedidosService'
import { recibosService } from '@/modules/recibos/services/recibosService'
import { movimientosStockService } from '@/modules/movimientos-stock/services/movimientosStockService'
import { server } from '@/tests/msw/server'
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
const payments = [{ id: 7, codigo: 'EFECTIVO', nombre: 'Efectivo', concepto_codigo: 'TIPO_PAGO' }]
const pedido = (estado = 1) => ({
  id: 9,
  fecha_confirmacion: '2026-09-26T12:00:00Z',
  proforma: 4,
  estado,
  created_by: 2,
  updated_by: 2,
})
const recibo = (estado = 'EMITIDO') => ({
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
  estado,
  fecha: '2026-09-26',
  pedido: 9,
  tipo_pago: 7,
  created_by: 2,
  updated_by: 2,
})
function options() {
  server.use(
    http.get('http://localhost:8000/api/v1/catalogo/opciones/', ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get('concepto') === 'TIPO_PAGO' ? payments : states,
      ),
    ),
  )
}
async function mountAt(component: unknown, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pedidos/:id', component: component as never },
      { path: '/recibos/:id', component: component as never },
      { path: '/pedidos', component: { template: '<div/>' } },
      { path: '/recibos', component: { template: '<div/>' } },
      { path: '/proformas/:id', component: { template: '<div/>' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return mount(component as never, { global: { plugins: [router], stubs: { Teleport: true } } })
}
describe('FE05 operaciones', () => {
  it('envía el código semántico de estado y conserva autoridad backend', async () => {
    let body: unknown
    server.use(
      http.post('http://localhost:8000/api/v1/pedidos/9/cambiar-estado/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(pedido(2))
      }),
    )
    await pedidosService.changeState(9, { estado_codigo: 'LISTO_ENTREGA' })
    expect(body).toEqual({ estado_codigo: 'LISTO_ENTREGA' })
  })
  it('muestra conflicto de cancelación por recibo emitido y recarga pedido', async () => {
    options()
    let reads = 0
    server.use(
      http.get('http://localhost:8000/api/v1/pedidos/9/', () => {
        reads++
        return HttpResponse.json(pedido())
      }),
      http.post('http://localhost:8000/api/v1/pedidos/9/cancelar/', () =>
        HttpResponse.json(
          { detail: 'No puede cancelar mientras existan recibos EMITIDOS.' },
          { status: 409 },
        ),
      ),
    )
    const w = await mountAt(PedidoDetailView, '/pedidos/9')
    await flushPromises()
    await w.get('button.button--danger').trigger('click')
    const cancelButtons = w.findAll('button').filter((x) => x.text() === 'Cancelar pedido')
    await cancelButtons[cancelButtons.length - 1]!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('No puede cancelar mientras existan recibos EMITIDOS.')
    expect(reads).toBeGreaterThan(1)
  })
  it('ofrece nota únicamente cuando backend reporta LISTO_ENTREGA', async () => {
    options()
    server.use(
      http.get('http://localhost:8000/api/v1/pedidos/9/', () => HttpResponse.json(pedido(2))),
    )
    const w = await mountAt(PedidoDetailView, '/pedidos/9')
    await flushPromises()
    expect(w.text()).toContain('Emitir nota de entrega')
    expect(w.text()).not.toContain('Emitir recibo')
  })
  it('anula recibo sin DELETE y actualiza evidencia a ANULADO', async () => {
    options()
    let method = ''
    server.use(
      http.get('http://localhost:8000/api/v1/recibos/5/', () => HttpResponse.json(recibo())),
      http.post('http://localhost:8000/api/v1/recibos/5/anular/', ({ request }) => {
        method = request.method
        return HttpResponse.json(recibo('ANULADO'))
      }),
    )
    const w = await mountAt(ReciboDetailView, '/recibos/5')
    await flushPromises()
    await w.get('button.button--danger').trigger('click')
    await w
      .findAll('button')
      .find((x) => x.text() === 'Anular')
      ?.trigger('click')
    await flushPromises()
    expect(method).toBe('POST')
    expect(w.text()).toContain('ANULADO')
    expect(w.text()).not.toContain('Anular recibo')
  })
  it('emite recibo con decimal como string y tipo publicado', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('http://localhost:8000/api/v1/pedidos/9/emitir_recibo/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(recibo(), { status: 201 })
      }),
    )
    await pedidosService.emitReceipt(9, {
      nombre_completo: 'Ana Pérez',
      monto_en_letras: 'Cien bolivianos',
      concepto: 'Anticipo',
      tipo_pago: 7,
      numero_cheque: null,
      banco: null,
      pago_actual: '100.00',
    })
    expect(body.pago_actual).toBe('100.00')
    expect(body.tipo_pago).toBe(7)
  })
  it('consume el historial read-only de stock y documentos publicados', async () => {
    let query = ''
    server.use(
      http.get('http://localhost:8000/api/v1/movimientos-stock/', ({ request }) => {
        query = new URL(request.url).search
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 11,
              fecha: '2026-09-26T12:00:00Z',
              tipo_movimiento: 4,
              tipo_movimiento_info: { id: 4, codigo: 'VENTA', nombre: 'Venta' },
              cantidad: -1,
              producto: 8,
              producto_resumen: { id: 8, sku: 'SILLA-01', nombre: 'Silla' },
              pedido: 9,
              movimiento_referencia: null,
              observaciones: null,
              created_by: 2,
            },
          ],
        })
      }),
      http.get('http://localhost:8000/api/v1/recibos/5/documento/', () =>
        new HttpResponse('<html>Recibo 18</html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      ),
    )

    const stock = await movimientosStockService.list({
      tipo_movimiento: 'VENTA',
      pedido: 9,
      page: 2,
      page_size: 20,
    })
    const documento = await recibosService.document(5)

    expect(stock.results[0]?.tipo_movimiento_info.codigo).toBe('VENTA')
    expect(query).toContain('tipo_movimiento=VENTA')
    expect(query).toContain('pedido=9')
    expect(query).toContain('page=2')
    expect(documento).toBeInstanceOf(Blob)
    expect(Object.keys(movimientosStockService)).not.toContain('create')
    expect(Object.keys(movimientosStockService)).not.toContain('update')
    expect(Object.keys(movimientosStockService)).not.toContain('remove')
  })
})
