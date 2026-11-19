import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import PedidoDetailView from '@/modules/pedidos/views/PedidoDetailView.vue'
import PedidosListView from '@/modules/pedidos/views/PedidosListView.vue'
import OrdenTrabajoDetailView from '@/modules/ordenes-trabajo/views/OrdenTrabajoDetailView.vue'
import OrdenesTrabajoListView from '@/modules/ordenes-trabajo/views/OrdenesTrabajoListView.vue'
import NotaEntregaDetailView from '@/modules/notas-entrega/views/NotaEntregaDetailView.vue'
import NotasEntregaListView from '@/modules/notas-entrega/views/NotasEntregaListView.vue'
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
      { path: '/ordenes-trabajo/:id', component: component as never },
      { path: '/notas-entrega/:id', component: component as never },
      { path: '/recibos/:id', component: component as never },
      { path: '/pedidos', component: { template: '<div/>' } },
      { path: '/ordenes-trabajo', component: { template: '<div/>' } },
      { path: '/notas-entrega', component: { template: '<div/>' } },
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
              producto_resumen: {
                id: 8,
                sku: 'SILLA-01',
                nombre: 'Silla',
                unidad_stock_info: { id: 1, codigo: 'PIEZA', nombre: 'Pieza' },
              },
              pedido: 9,
              pedido_relacionado: 9,
              movimiento_referencia: null,
              observaciones: null,
              created_by: 2,
              responsable: { id: 2, username: 'vendedor', display_name: 'Vendedor' },
            },
          ],
        })
      }),
      http.get(
        'http://localhost:8000/api/v1/recibos/5/documento/',
        () =>
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

  it('muestra bandeja de pedidos con menú de acciones y filtros', async () => {
    options()
    server.use(
      http.get('http://localhost:8000/api/v1/pedidos/', () => HttpResponse.json([pedido(1)])),
      http.get('http://localhost:8000/api/v1/proformas/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 4,
              numero: 4,
              titulo: 'Oficina directorio',
              total: '3500.00',
              estado_info: { id: 1, codigo: 'APROBADA', nombre: 'Aprobada' },
              moneda_info: { id: 1, codigo: 'BOB', nombre: 'Bolivianos' },
              cliente_resumen: { id: 10, nombre: 'Constructora Norte' },
            },
          ],
        }),
      ),
    )
    const w = await mountAt(PedidosListView, '/pedidos')
    await flushPromises()
    expect(w.text()).toContain('Pedido #9')
    expect(w.text()).toContain('Constructora Norte')
    expect(w.text()).toContain('Oficina directorio')
    const trigger = w.find('[aria-label="Acciones del pedido #9"]')
    expect(trigger.exists()).toBe(true)
  })

  it('lista recibos emitidos vinculados en la ficha del pedido', async () => {
    options()
    server.use(
      http.get('http://localhost:8000/api/v1/pedidos/9/', () => HttpResponse.json(pedido(1))),
      http.get('http://localhost:8000/api/v1/recibos/', () => HttpResponse.json([recibo()])),
      http.get('http://localhost:8000/api/v1/notas-entrega/', () => HttpResponse.json([])),
    )
    const w = await mountAt(PedidoDetailView, '/pedidos/9')
    await flushPromises()
    expect(w.text()).toContain('Recibo #18')
    expect(w.text()).toContain('Anticipo')
  })

  it('muestra stepper interactivo sin tecnicismos y avanza al siguiente estado en un clic', async () => {
    options()
    let postedBody: unknown = null
    server.use(
      http.get('http://localhost:8000/api/v1/pedidos/9/', () => HttpResponse.json(pedido(1))),
      http.post('http://localhost:8000/api/v1/pedidos/9/cambiar-estado/', async ({ request }) => {
        postedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(pedido(2))
      }),
    )
    const w = await mountAt(PedidoDetailView, '/pedidos/9')
    await flushPromises()
    expect(w.text().toLowerCase()).not.toContain('backend')
    const mainAdvanceBtn = w.find('button.split-action__main')
    expect(mainAdvanceBtn.exists()).toBe(true)
    expect(mainAdvanceBtn.text()).toContain('En producción')
    await mainAdvanceBtn.trigger('click')
    await flushPromises()
    expect(postedBody).toEqual({ estado_codigo: 'EN_PRODUCCION' })
  })

  it('muestra bandeja de órdenes de trabajo con contexto de cliente y menú de acciones', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/ordenes-trabajo/', () =>
        HttpResponse.json([
          {
            id: 3,
            pedido: 9,
            proforma_numero: 4,
            jefe_taller: null,
            numero: 40,
            fecha: '2026-09-26',
            fecha_inicio: null,
            fecha_fin: null,
            responsable_recepcion: null,
            fecha_entrega: '2026-10-05',
            lugar_entrega: 'Obra Norte',
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
                descripcion: null,
                cantidad: '1.0000',
                unidad_info: { id: 2, codigo: 'PIEZA', nombre: 'Pieza' },
                especificacion: {
                  tipo_mueble_info: null,
                  observaciones: 'Conservar pieza original',
                  datos_tecnicos: { componentes: [{ nombre: 'Mesón', color: 'Nogal' }] },
                },
              },
            ],
          },
        ]),
      ),
      http.get('http://localhost:8000/api/v1/proformas/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 4,
              numero: 4,
              titulo: 'Oficina directorio',
              total: '3500.00',
              estado_info: { id: 1, codigo: 'APROBADA', nombre: 'Aprobada' },
              moneda_info: { id: 1, codigo: 'BOB', nombre: 'Bolivianos' },
              cliente_resumen: { id: 10, nombre: 'Constructora Norte' },
            },
          ],
        }),
      ),
    )
    const w = await mountAt(OrdenesTrabajoListView, '/ordenes-trabajo')
    await flushPromises()
    expect(w.text()).toContain('OT #40')
    expect(w.text()).toContain('Constructora Norte')
    expect(w.text()).toContain('Oficina directorio')
    expect(w.text()).toContain('Pedido #9')
    expect(w.find('[aria-label="Acciones de la orden de trabajo #40"]').exists()).toBe(true)
  })

  it('muestra detalle de OT con ficha técnica estructurada sin JSON crudo', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/ordenes-trabajo/3/', () =>
        HttpResponse.json({
          id: 3,
          pedido: 9,
          proforma_numero: 4,
          jefe_taller: null,
          numero: 40,
          fecha: '2026-09-26',
          fecha_inicio: null,
          fecha_fin: null,
          responsable_recepcion: 'Carlos Méndez',
          fecha_entrega: '2026-10-05',
          lugar_entrega: 'Av. Banzer Km 6',
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
              descripcion: 'Módulo gerencial',
              cantidad: '1.0000',
              unidad_info: { id: 2, codigo: 'PIEZA', nombre: 'Pieza' },
              especificacion: {
                tipo_mueble_info: null,
                observaciones: 'Conservar pieza original',
                datos_tecnicos: {
                  componentes: [
                    { nombre: 'Mesón', color: 'Nogal', espesor: '25 mm' },
                    { nombre: 'Estructura', material: 'Melamina' },
                  ],
                  advertencias: ['color a elección'],
                },
              },
            },
          ],
        }),
      ),
      http.get('http://localhost:8000/api/v1/imagenes-privadas/', () => HttpResponse.json([])),
    )
    const w = await mountAt(OrdenTrabajoDetailView, '/ordenes-trabajo/3')
    await flushPromises()
    expect(w.text()).toContain('Orden de trabajo #40')
    expect(w.text()).toContain('Carlos Méndez')
    expect(w.text()).toContain('Av. Banzer Km 6')
    expect(w.text()).toContain('2 componentes')
    expect(w.text()).toContain('Mesón')
    expect(w.text()).toContain('Nogal')
    expect(w.text()).toContain('Conservar pieza original')
    expect(w.text()).toContain('color a elección')
    expect(w.find('pre').exists()).toBe(false)
    expect(w.text()).not.toContain('precio_unitario')
  })

  it('muestra bandeja de notas de entrega con contexto de cliente y menú de acciones', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/notas-entrega/', () =>
        HttpResponse.json([
          {
            id: 7,
            numero: 12,
            fecha: '2026-10-15',
            pedido: 9,
            vendedor: 2,
            created_by: 2,
            updated_by: 2,
          },
        ]),
      ),
      http.get('http://localhost:8000/api/v1/pedidos/', () => HttpResponse.json([pedido(2)])),
      http.get('http://localhost:8000/api/v1/proformas/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 4,
              numero: 4,
              titulo: 'Oficina directorio',
              total: '3500.00',
              estado_info: { id: 1, codigo: 'APROBADA', nombre: 'Aprobada' },
              moneda_info: { id: 1, codigo: 'BOB', nombre: 'Bolivianos' },
              cliente_resumen: { id: 10, nombre: 'Constructora Norte' },
            },
          ],
        }),
      ),
    )
    const w = await mountAt(NotasEntregaListView, '/notas-entrega')
    await flushPromises()
    expect(w.text()).toContain('Nota #12')
    expect(w.text()).toContain('Constructora Norte')
    expect(w.text()).toContain('Oficina directorio')
    expect(w.text()).toContain('Pedido #9')
    expect(w.find('[aria-label="Acciones de la nota de entrega #12"]').exists()).toBe(true)
  })

  it('muestra detalle de nota de entrega con ítems entregados sin exponer precios', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/notas-entrega/7/', () =>
        HttpResponse.json({
          id: 7,
          numero: 12,
          fecha: '2026-10-15',
          pedido: 9,
          vendedor: 2,
          created_by: 2,
          updated_by: 2,
        }),
      ),
      http.get('http://localhost:8000/api/v1/pedidos/9/', () => HttpResponse.json(pedido(2))),
      http.get('http://localhost:8000/api/v1/proformas/4/', () =>
        HttpResponse.json({
          id: 4,
          numero: 4,
          titulo: 'Oficina directorio',
          fecha: '2026-09-20',
          total: '3500.00',
          subtotal: '3500.00',
          descuento_total: '0.00',
          estado_info: { id: 1, codigo: 'APROBADA', nombre: 'Aprobada' },
          moneda_info: { id: 1, codigo: 'BOB', nombre: 'Bolivianos' },
          cliente_resumen: {
            id: 10,
            nombre: 'Constructora Norte',
            empresa: 'Constructora Norte S.R.L.',
          },
          detalles: [
            {
              id: 21,
              proforma: 4,
              tipo_item: 1,
              tipo_item_info: { id: 1, codigo: 'SILLA', nombre: 'Silla' },
              producto: null,
              familia_producto: null,
              nombre: 'Silla ejecutiva',
              descripcion: 'Respaldo alto',
              cantidad: '4.0000',
              unidad: 2,
              unidad_info: { id: 2, codigo: 'PIEZA', nombre: 'Pieza' },
              precio_unitario: '875.00',
              total: '3500.00',
              especificacion: null,
            },
          ],
        }),
      ),
    )
    const w = await mountAt(NotaEntregaDetailView, '/notas-entrega/7')
    await flushPromises()
    expect(w.text()).toContain('Nota de entrega #12')
    expect(w.text()).toContain('Constructora Norte S.R.L.')
    expect(w.text()).toContain('Silla ejecutiva')
    expect(w.text()).toContain('Pieza')
    expect(w.text()).not.toContain('3500.00')
    expect(w.text()).not.toContain('875.00')
  })
})
