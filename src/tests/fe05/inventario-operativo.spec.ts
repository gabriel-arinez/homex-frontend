import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useSessionStore } from '@/app/stores/useSessionStore'
import type { Producto } from '@/generated/api'
import MovimientosStockListView from '@/modules/movimientos-stock/views/MovimientosStockListView.vue'
import { movimientosStockService } from '@/modules/movimientos-stock/services/movimientosStockService'
import PedidoDetailView from '@/modules/pedidos/views/PedidoDetailView.vue'
import { pedidosService } from '@/modules/pedidos/services/pedidosService'
import { recibosService } from '@/modules/recibos/services/recibosService'
import { notasEntregaService } from '@/modules/notas-entrega/services/notasEntregaService'
import { productosService } from '@/modules/productos/services/productosService'
import { disponibilidadMeta, estadoStockMeta } from '@/modules/productos/utils/presentacionCatalogo'
import ProductoDetailView from '@/modules/productos/views/ProductoDetailView.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { galleryService } from '@/shared/media/gallery'

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/productos', component: { template: '<div />' } },
      { path: '/productos/:id', component: ProductoDetailView },
      { path: '/movimientos-stock', component: MovimientosStockListView },
      { path: '/pedidos/:id', component: PedidoDetailView },
      { path: '/proformas/:id', component: { template: '<div />' } },
    ],
  })
}

const productoSample: Producto = {
  id: 10,
  revision: 'rev-1',
  categoria: 1,
  categoria_info: {
    id: 1,
    concepto_codigo: 'CATEGORIA_PRODUCTO',
    codigo: 'SILLA',
    nombre: 'Silla',
  },
  familia_info: { id: 1, codigo: 'SILLAS', nombre: 'Sillas' },
  sku: 'SILLA-10',
  nombre: 'Silla Ergonómica',
  precio_vigente: '350.00',
  stock: '5.0000',
  stock_minimo: '6.0000',
  estado_stock: 'STOCK_BAJO',
  demanda_pendiente: '8.0000',
  disponibilidad_referencial: '-3.0000',
  unidad_stock: 1,
  unidad_stock_info: { id: 1, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' },
  activo: true,
  imagen_principal: null,
  created_by: 1,
  creado_por_resumen: null,
  updated_by: 1,
}

describe('Inventario operativo (P1, P2, P4, P5, P6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('P1 & P5: clasifica disponibilidad referencial y estado_stock de forma independiente', () => {
    expect(disponibilidadMeta('10').tone).toBe('success')
    expect(disponibilidadMeta('0').tone).toBe('warning')
    const neg = disponibilidadMeta('-3')
    expect(neg.tone).toBe('danger')
    expect(neg.hint).toContain('no es stock físico negativo')

    expect(estadoStockMeta('SIN_EXISTENCIAS').label).toBe('Sin existencias')
    expect(estadoStockMeta('STOCK_BAJO').label).toBe('Stock bajo')
    expect(estadoStockMeta('NORMAL').label).toBe('Por encima del mínimo')
    expect(estadoStockMeta('SIN_MINIMO').showBadge).toBe(false)
  })

  it('P1: PedidoDetailView no menciona "stock reservado" en cancelaciones', async () => {
    const session = useSessionStore()
    session.capabilities = ['comercial.operar', 'comercial.administrar']
    vi.spyOn(pedidosService, 'options').mockResolvedValue([
      { id: 1, concepto_codigo: 'ESTADO_PEDIDO', codigo: 'CONFIRMADO', nombre: 'Confirmado' },
      { id: 2, concepto_codigo: 'ESTADO_PEDIDO', codigo: 'CANCELADO', nombre: 'Cancelado' },
    ])
    vi.spyOn(pedidosService, 'get').mockResolvedValue({
      id: 55,
      proforma: 22,
      proforma_numero: 1022,
      estado: 2,
      estado_info: {
        id: 2,
        concepto_codigo: 'ESTADO_PEDIDO',
        codigo: 'CANCELADO',
        nombre: 'Cancelado',
      },
      transiciones_permitidas: [],
      fecha_confirmacion: '2026-11-20T10:00:00Z',
      total_recibido: '0.00',
      saldo_pendiente: '0.00',
      observaciones: '',
      cliente_resumen: { id: 1, nombre: 'Cliente Test', tipo_cliente_codigo: 'PERSONA' },
      created_by: 1,
      updated_by: 1,
    } as never)
    vi.spyOn(proformasService, 'get').mockResolvedValue({
      id: 22,
      numero: 1022,
      total: '100.00',
      moneda_info: { id: 1, codigo: 'BOB', nombre: 'Boliviano' },
      cliente_resumen: { id: 1, nombre: 'Cliente Test', tipo_cliente_codigo: 'PERSONA' },
      detalles: [],
    } as never)
    vi.spyOn(recibosService, 'list').mockResolvedValue([])
    vi.spyOn(notasEntregaService, 'list').mockResolvedValue([])

    const router = buildRouter()
    await router.push('/pedidos/55')
    await router.isReady()

    const wrapper = mount(PedidoDetailView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('stock reservado')
    expect(wrapper.text()).toContain('restituidas al inventario mediante reversa')
  })

  it('P4 & P5: ProductoDetailView muestra origen de demanda y restringe stock mínimo a admin', async () => {
    const session = useSessionStore()
    session.capabilities = ['comercial.operar', 'comercial.administrar']

    vi.spyOn(productosService, 'get').mockResolvedValue({ ...productoSample })
    vi.spyOn(proformasService, 'options').mockResolvedValue([])
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
    const demandaSpy = vi.spyOn(productosService, 'getDemandaPendiente').mockResolvedValue({
      producto_id: 10,
      demanda_pendiente_total: '8.0000',
      cantidad_restringida: '2.0000',
      proformas: [
        {
          proforma_id: 77,
          numero: 9077,
          fecha: '2026-11-20',
          estado: { id: 1, codigo: 'EN_REVISION', nombre: 'En revisión' },
          cantidad: '6.0000',
        },
      ],
    })
    const minSpy = vi.spyOn(productosService, 'updateStockMinimo').mockResolvedValue({
      ...productoSample,
      stock_minimo: '4.0000',
      estado_stock: 'NORMAL',
    })

    const router = buildRouter()
    await router.push('/productos/10')
    await router.isReady()

    const wrapper = mount(ProductoDetailView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Stock bajo')
    expect(wrapper.text()).toContain('Déficit referencial')
    expect(wrapper.text()).toContain('Editar mínimo')
    expect(wrapper.text()).toContain('Ver reporte de stock')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Ver origen de demanda'))!
      .trigger('click')
    await flushPromises()
    expect(demandaSpy).toHaveBeenCalledWith(10)
    expect(wrapper.text()).toContain('Proforma #9077')
    expect(wrapper.text()).toContain('otros vendedores')

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Editar mínimo'))!
      .trigger('click')
    await flushPromises()
    await wrapper.find('input[name="stock-minimo"]').setValue('4')
    await wrapper.find('#stock-minimo-form').trigger('submit')
    await flushPromises()
    expect(minSpy).toHaveBeenCalledWith(10, '4')
    expect(wrapper.text()).toContain('Por encima del mínimo')
  })

  it('P2 & P6: MovimientosStockListView respeta permisos, registra ajuste con idempotencia y muestra reporte', async () => {
    const session = useSessionStore()
    session.capabilities = ['comercial.operar'] // No es admin

    vi.spyOn(movimientosStockService, 'types').mockResolvedValue([
      { id: 1, concepto_codigo: 'TIPO_MOVIMIENTO', codigo: 'AJUSTE', nombre: 'Ajuste' },
    ])
    vi.spyOn(movimientosStockService, 'list').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(productosService, 'get').mockResolvedValue({ ...productoSample })

    const router = buildRouter()
    await router.push('/movimientos-stock?producto=10')
    await router.isReady()

    const wrapperNonAdmin = mount(MovimientosStockListView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(wrapperNonAdmin.text()).toContain('Silla Ergonómica')
    expect(wrapperNonAdmin.text()).not.toContain('Registrar movimiento')

    // Ahora como administrador comercial
    session.capabilities = ['comercial.operar', 'comercial.administrar']
    const reporteSpy = vi.spyOn(movimientosStockService, 'reporte').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      saldo_reconstruible: true,
      limitacion_saldo: null,
      resumen: {
        producto_id: 10,
        unidad_codigo: 'PIEZA',
        unidad_nombre: 'Pieza',
        stock_actual: '5.0000',
        total_entradas: '5.0000',
        total_salidas: '0',
        variacion_neta: '5.0000',
        saldo_inicial_periodo: '0',
        saldo_final_periodo: '5.0000',
        cantidad_movimientos: 1,
      },
      results: [
        {
          id: 100,
          fecha: '2026-11-20T12:00:00Z',
          registrado_en: '2026-11-20T12:00:00Z',
          tipo_movimiento: 1,
          tipo_movimiento_info: { id: 1, codigo: 'AJUSTE', nombre: 'Ajuste' },
          cantidad: '5.0000',
          producto: 10,
          producto_resumen: {
            id: 10,
            sku: 'SILLA-10',
            nombre: 'Silla Ergonómica',
            unidad_stock_info: { id: 1, codigo: 'PIEZA', nombre: 'Pieza' },
          },
          pedido: null,
          pedido_relacionado: null,
          movimiento_referencia: null,
          motivo: 'REPOSICION',
          motivo_label: 'Reposición',
          observaciones: 'Reposición',
          created_by: 1,
          responsable: { id: 1, username: 'admin', display_name: 'Admin' },
          saldo_anterior: '0',
          saldo_posterior: '5.0000',
        },
      ],
    })
    vi.spyOn(movimientosStockService, 'motivosAjuste').mockResolvedValue({
      ENTRADA: [{ codigo: 'REPOSICION', nombre: 'Reposición', requiere_observaciones: false }],
      SALIDA: [{ codigo: 'MERMA', nombre: 'Merma', requiere_observaciones: false }],
    })
    vi.spyOn(productosService, 'list').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...productoSample }],
    })
    const ajusteSpy = vi
      .spyOn(movimientosStockService, 'registrarAjuste')
      .mockResolvedValue({} as never)

    const routerReport = buildRouter()
    await routerReport.push('/movimientos-stock?producto=10&vista=reporte')
    await routerReport.isReady()

    const wrapperAdmin = mount(MovimientosStockListView, {
      global: { plugins: [routerReport], stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(wrapperAdmin.text()).toContain('Registrar movimiento')
    expect(wrapperAdmin.text()).not.toContain('Reporte y saldos')
    expect(wrapperAdmin.text()).not.toContain('Vista historial')
    expect(wrapperAdmin.find('input[name="pedido-movimiento"]').exists()).toBe(false)
    expect(wrapperAdmin.find('input[name="producto-movimiento"]').exists()).toBe(false)
    expect(wrapperAdmin.text()).toContain('Volver al producto')
    expect(reporteSpy).toHaveBeenCalled()
    expect(wrapperAdmin.text()).toContain('Entradas del período')
    expect(wrapperAdmin.text()).toContain('5.0000 Pieza')

    await wrapperAdmin
      .findAll('button')
      .find((b) => b.text().includes('Registrar movimiento'))!
      .trigger('click')
    await flushPromises()
    await wrapperAdmin.find('input[name="ajuste-cantidad"]').setValue('3')
    await wrapperAdmin.find('#ajuste-stock-form').trigger('submit')
    await flushPromises()
    expect(ajusteSpy).toHaveBeenCalledTimes(1)
    expect(ajusteSpy.mock.calls[0]?.[0]).toMatchObject({
      producto: 10,
      tipo_operacion: 'ENTRADA',
      cantidad: '3',
      motivo: 'REPOSICION',
    })
    const firstKey = ajusteSpy.mock.calls[0]?.[1]
    expect(firstKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('P2 & P5: conserva UUID en reintentos, genera uno nuevo por operación y admite 4 decimales en M2', async () => {
    const session = useSessionStore()
    session.capabilities = ['comercial.operar', 'comercial.administrar']

    const pisoM2: Producto = {
      ...productoSample,
      id: 20,
      sku: 'PISO-20',
      nombre: 'Piso Flotante Roble',
      stock: '16.5000',
      stock_minimo: '2.2500',
      estado_stock: 'NORMAL',
      unidad_stock: 2,
      unidad_stock_info: { id: 2, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'M2', nombre: 'm²' },
    }

    vi.spyOn(movimientosStockService, 'types').mockResolvedValue([])
    vi.spyOn(movimientosStockService, 'list').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(movimientosStockService, 'motivosAjuste').mockResolvedValue({
      ENTRADA: [{ codigo: 'REPOSICION', nombre: 'Reposición', requiere_observaciones: false }],
      SALIDA: [{ codigo: 'MERMA', nombre: 'Merma', requiere_observaciones: false }],
    })
    vi.spyOn(productosService, 'get').mockResolvedValue(pisoM2)
    vi.spyOn(productosService, 'list').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [pisoM2],
    })

    const ajusteSpy = vi
      .spyOn(movimientosStockService, 'registrarAjuste')
      .mockRejectedValueOnce(new Error('Timeout de red'))
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)

    const router = buildRouter()
    await router.push('/movimientos-stock?producto=20')
    await router.isReady()

    const wrapper = mount(MovimientosStockListView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Registrar movimiento'))!
      .trigger('click')
    await flushPromises()

    const qtyInput = wrapper.find('input[name="ajuste-cantidad"]')
    expect(qtyInput.attributes('step')).toBe('0.0001')

    await qtyInput.setValue('1.2345')
    await wrapper.find('#ajuste-stock-form').trigger('submit')
    await flushPromises()

    // Reintento tras error incierto: conserva la misma clave UUID
    await wrapper.find('#ajuste-stock-form').trigger('submit')
    await flushPromises()

    const keyTry1 = ajusteSpy.mock.calls[0]?.[1]
    const keyTry2 = ajusteSpy.mock.calls[1]?.[1]
    expect(keyTry1).toBeTruthy()
    expect(keyTry2).toBe(keyTry1)
    expect(ajusteSpy.mock.calls[1]?.[0].cantidad).toBe('1.2345')

    // Nueva operación al reabrir el modal: genera un UUID distinto
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Registrar movimiento'))!
      .trigger('click')
    await flushPromises()
    await wrapper.find('input[name="ajuste-cantidad"]').setValue('0.5000')
    await wrapper.find('#ajuste-stock-form').trigger('submit')
    await flushPromises()

    const keyNewOp = ajusteSpy.mock.calls[2]?.[1]
    expect(keyNewOp).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(keyNewOp).not.toBe(keyTry1)
  })

  it('P6: muestra resumen y saldos del período incluso cuando no hay movimientos en el rango', async () => {
    const session = useSessionStore()
    session.capabilities = ['comercial.operar']

    vi.spyOn(movimientosStockService, 'types').mockResolvedValue([])
    vi.spyOn(movimientosStockService, 'list').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(productosService, 'get').mockResolvedValue({ ...productoSample })
    vi.spyOn(movimientosStockService, 'reporte').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      saldo_reconstruible: true,
      limitacion_saldo: null,
      resumen: {
        producto_id: 10,
        unidad_codigo: 'PIEZA',
        unidad_nombre: 'Pieza',
        stock_actual: '5.0000',
        total_entradas: '0',
        total_salidas: '0',
        variacion_neta: '0',
        saldo_inicial_periodo: '5.0000',
        saldo_final_periodo: '5.0000',
        cantidad_movimientos: 0,
      },
      results: [],
    })

    const router = buildRouter()
    await router.push(
      '/movimientos-stock?producto=10&desde=2020-01-01&hasta=2020-01-31&vista=reporte',
    )
    await router.isReady()

    const wrapper = mount(MovimientosStockListView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Sin coincidencias')
    expect(wrapper.text()).toContain('Saldo inicial del período')
    expect(wrapper.text()).toContain('Saldo final del período')
    expect(wrapper.text()).toContain('5.0000 Pieza')
  })

  it('selecciona producto desde el buscador del modal y exige rango de fechas al exportar Excel', async () => {
    const session = useSessionStore()
    session.capabilities = ['comercial.operar', 'comercial.administrar']

    vi.spyOn(movimientosStockService, 'types').mockResolvedValue([])
    vi.spyOn(movimientosStockService, 'list').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(movimientosStockService, 'motivosAjuste').mockResolvedValue({
      ENTRADA: [{ codigo: 'REPOSICION', nombre: 'Reposición', requiere_observaciones: false }],
      SALIDA: [{ codigo: 'MERMA', nombre: 'Merma', requiere_observaciones: false }],
    })
    vi.spyOn(productosService, 'list').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [productoSample],
    })
    const excelSpy = vi
      .spyOn(movimientosStockService, 'exportarExcel')
      .mockResolvedValue(new Blob(['xlsx-bytes']))

    const router = buildRouter()
    await router.push('/movimientos-stock')
    await router.isReady()

    const wrapper = mount(MovimientosStockListView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    await flushPromises()

    // Sin rango de fechas no debe llamar a exportarExcel y debe avisar
    const exportBtn = wrapper.findAll('button').find((b) => b.text().includes('Exportar Excel'))!
    await exportBtn.trigger('click')
    await flushPromises()
    expect(excelSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Debes seleccionar un rango de fechas')

    // Con rango de fechas en ruta sí llama a exportarExcel
    await router.push('/movimientos-stock?desde=2026-11-01&hasta=2026-11-22')
    await flushPromises()
    await exportBtn.trigger('click')
    await flushPromises()
    expect(excelSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha_desde: '2026-11-01',
        fecha_hasta: '2026-11-22',
      }),
    )

    // Modal sin <select name="ajuste-producto">, sin listado inicial y con búsqueda en tiempo real
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Registrar movimiento'))!
      .trigger('click')
    await flushPromises()

    expect(wrapper.find('select[name="ajuste-producto"]').exists()).toBe(false)
    expect(wrapper.find('.ajuste-product-results').exists()).toBe(false)

    const productSearchInput = wrapper.find('.ajuste-product-picker input[type="search"]')
    await productSearchInput.setValue('Silla')
    await flushPromises()

    const optionBtn = wrapper.find('.ajuste-product-option')
    expect(optionBtn.exists()).toBe(true)
    await optionBtn.trigger('click')
    await flushPromises()
    expect(wrapper.find('.ajuste-selected-card').text()).toContain('Silla Ergonómica')
  })
})
