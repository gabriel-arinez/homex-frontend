import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { notasEntregaService } from '@/modules/notas-entrega/services/notasEntregaService'
import PedidoDetailView from '@/modules/pedidos/views/PedidoDetailView.vue'
import { pedidosService } from '@/modules/pedidos/services/pedidosService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { recibosService } from '@/modules/recibos/services/recibosService'
import { montoEnLetras } from '@/modules/recibos/utils/montoEnLetras'
import ReciboDetailView from '@/modules/recibos/views/ReciboDetailView.vue'
import RecibosListView from '@/modules/recibos/views/RecibosListView.vue'

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pedidos', component: { template: '<div />' } },
      { path: '/pedidos/:id', component: PedidoDetailView },
      { path: '/recibos', component: RecibosListView },
      { path: '/recibos/:id', component: ReciboDetailView },
    ],
  })
}

describe('Rediseño de recibos y PDF', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('convierte montos a letras en BOB y USD correctamente', () => {
    expect(montoEnLetras('1550.50', 'BOB')).toBe('Mil quinientos cincuenta 50/100 Bolivianos')
    expect(montoEnLetras('1.00', 'USD')).toBe('Un 00/100 Dólar')
    expect(montoEnLetras('21.00', 'BOB')).toBe('Veintiún 00/100 Bolivianos')
    expect(montoEnLetras('0', 'BOB')).toBe('')
    expect(montoEnLetras('-10', 'BOB')).toBe('')
  })

  it('precarga Emitir recibo, calcula monto en letras y resumen, mantiene modal abierto si falla y reutiliza UUID en reintento', async () => {
    vi.spyOn(pedidosService, 'options').mockImplementation(async (concepto) => {
      if (concepto === 'ESTADO_PEDIDO') {
        return [
          { id: 1, concepto_codigo: 'ESTADO_PEDIDO', codigo: 'CONFIRMADO', nombre: 'Confirmado' },
        ]
      }
      return [
        { id: 10, concepto_codigo: 'TIPO_PAGO', codigo: 'EFECTIVO', nombre: 'Efectivo' },
        { id: 11, concepto_codigo: 'TIPO_PAGO', codigo: 'CHEQUE', nombre: 'Cheque' },
      ]
    })
    vi.spyOn(pedidosService, 'get').mockResolvedValue({
      id: 77,
      proforma: 30,
      proforma_numero: 5030,
      estado: 1,
      estado_info: {
        id: 1,
        concepto_codigo: 'ESTADO_PEDIDO',
        codigo: 'CONFIRMADO',
        nombre: 'Confirmado',
      },
      transiciones_permitidas: [],
      fecha_confirmacion: '2026-11-22T10:00:00Z',
      total_recibido: '200.00',
      saldo_pendiente: '800.00',
      observaciones: '',
      cliente_resumen: { id: 5, nombre: 'María Gutiérrez', tipo_cliente_codigo: 'PERSONA' },
      created_by: 1,
      updated_by: 1,
    } as never)
    vi.spyOn(proformasService, 'get').mockResolvedValue({
      id: 30,
      numero: 5030,
      total: '1000.00',
      moneda_info: { id: 2, codigo: 'USD', nombre: 'Dólar' },
      cliente_resumen: { id: 5, nombre: 'María Gutiérrez', tipo_cliente_codigo: 'PERSONA' },
      detalles: [],
    } as never)
    vi.spyOn(recibosService, 'list').mockResolvedValue([
      {
        id: 1,
        numero: 1001,
        pedido: 77,
        nombre_completo: 'María Gutiérrez',
        monto_en_letras: 'Doscientos 00/100 Dólares',
        concepto: 'Anticipo',
        tipo_pago: 10,
        tipo_pago_nombre: 'Efectivo',
        moneda_codigo: 'USD',
        vendedor_resumen: null,
        numero_cheque: null,
        banco: null,
        total: '1000.00',
        pago_actual: '200.00',
        a_cuenta: '200.00',
        saldo: '800.00',
        estado: 'EMITIDO',
        fecha: '2026-11-21',
        created_by: 1,
        updated_by: 1,
        clave_idempotencia: null,
      },
    ])
    vi.spyOn(notasEntregaService, 'list').mockResolvedValue([])

    const emitSpy = vi
      .spyOn(pedidosService, 'emitReceipt')
      .mockRejectedValueOnce(new Error('Fallo temporal de red'))
      .mockResolvedValueOnce({ id: 901 } as never)

    const router = buildRouter()
    await router.push('/pedidos/77')
    await router.isReady()

    const pinia = createPinia()
    const wrapper = mount(PedidoDetailView, {
      global: { plugins: [router, pinia], stubs: { Teleport: true } },
    })
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Emitir recibo'))!
      .trigger('click')
    await flushPromises()

    const nombreInput = wrapper.find('input[name="nombre"]')
    const conceptoInput = wrapper.find('input[name="concepto"]')

    expect((nombreInput.element as HTMLInputElement).value).toBe('María Gutiérrez')
    expect((conceptoInput.element as HTMLInputElement).value).toContain('Pedido #77')

    await wrapper.find('select[name="tipo-pago"]').setValue('10')
    await flushPromises()

    // Sobrepago muestra error y deshabilita envío
    await wrapper.find('input[name="pago"]').setValue('900')
    await wrapper.find('input[name="pago"]').trigger('input')
    await flushPromises()
    expect(wrapper.text()).toContain('supera el saldo pendiente')

    // Pago válido autogenera monto en letras en USD y actualiza resumen
    await wrapper.find('input[name="pago"]').setValue('250.50')
    await wrapper.find('input[name="pago"]').trigger('input')
    await flushPromises()
    expect((wrapper.find('input[name="letras"]').element as HTMLInputElement).value).toBe(
      'Doscientos cincuenta 50/100 Dólares',
    )
    expect(wrapper.text()).toContain('450,50') // Acumulado
    expect(wrapper.text()).toContain('549,50') // Saldo restante

    // Primer intento falla: modal sigue abierto y conserva datos
    await wrapper.find('#receipt').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Fallo temporal de red')
    expect(wrapper.find('#receipt').exists()).toBe(true)
    expect((wrapper.find('input[name="pago"]').element as HTMLInputElement).value).toBe('250.50')

    // Reintento conserva la misma Idempotency-Key y cierra el modal al confirmar
    await wrapper.find('#receipt').trigger('submit')
    await flushPromises()
    expect(emitSpy).toHaveBeenCalledTimes(2)
    const k1 = emitSpy.mock.calls[0]?.[2]
    const k2 = emitSpy.mock.calls[1]?.[2]
    expect(k1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(k2).toBe(k1)
    expect(wrapper.find('#receipt').exists()).toBe(false)
  })

  it('RecibosListView oculta "Hora no registrada" y ReciboDetailView usa "Recibido de" y PDF', async () => {
    const reciboMock = {
      id: 18,
      numero: 1018,
      pedido: 77,
      nombre_completo: 'María Gutiérrez',
      monto_en_letras: 'Doscientos cincuenta 50/100 Bolivianos',
      concepto: 'Abono por Pedido #77',
      tipo_pago: 10,
      tipo_pago_nombre: 'Efectivo',
      moneda_codigo: 'BOB',
      vendedor_resumen: null,
      numero_cheque: null,
      banco: null,
      total: '1000.00',
      pago_actual: '250.50',
      a_cuenta: '450.50',
      saldo: '549.50',
      estado: 'EMITIDO',
      fecha: '2026-11-22',
      created_by: 1,
      updated_by: 1,
      clave_idempotencia: null,
    }
    vi.spyOn(recibosService, 'list').mockResolvedValue([reciboMock])
    vi.spyOn(recibosService, 'get').mockResolvedValue(reciboMock)
    vi.spyOn(recibosService, 'paymentTypes').mockResolvedValue([
      { id: 10, concepto_codigo: 'TIPO_PAGO', codigo: 'EFECTIVO', nombre: 'Efectivo' },
    ])
    const pdfSpy = vi
      .spyOn(recibosService, 'documentPdf')
      .mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))

    const routerList = buildRouter()
    await routerList.push('/recibos')
    await routerList.isReady()
    const piniaList = createPinia()
    const wList = mount(RecibosListView, {
      global: { plugins: [routerList, piniaList], stubs: { Teleport: true } },
    })
    await flushPromises()
    expect(wList.text()).not.toContain('Hora no registrada')
    expect(wList.text()).toContain('22 de nov de 2026')
    expect(wList.text()).toContain('Cobrado')
    expect(wList.text()).toContain('A cuenta')
    expect(wList.text()).toContain('Saldo')
    expect(wList.text()).toContain('Efectivo')

    const routerDetail = buildRouter()
    await routerDetail.push('/recibos/18')
    await routerDetail.isReady()
    const piniaDetail = createPinia()
    const wDetail = mount(ReciboDetailView, {
      global: { plugins: [routerDetail, piniaDetail], stubs: { Teleport: true } },
    })
    await flushPromises()
    expect(wDetail.text()).toContain('Recibido de')
    expect(wDetail.text()).not.toContain('Cliente / receptor')
    expect(wDetail.text()).toContain('Ver e imprimir PDF')
    expect(wDetail.text()).toContain('Descargar PDF')

    await wDetail
      .findAll('button')
      .find((b) => b.text().includes('Ver e imprimir PDF'))!
      .trigger('click')
    await flushPromises()
    expect(pdfSpy).toHaveBeenCalledWith(18)
  })

  it('PedidoDetailView abre el visor PDF al presionar el icono PDF de un recibo vinculado', async () => {
    vi.spyOn(pedidosService, 'options').mockImplementation(async (concepto) => {
      if (concepto === 'ESTADO_PEDIDO') {
        return [
          { id: 1, concepto_codigo: 'ESTADO_PEDIDO', codigo: 'CONFIRMADO', nombre: 'Confirmado' },
        ]
      }
      return [{ id: 12, concepto_codigo: 'TIPO_PAGO', codigo: 'QR', nombre: 'QR' }]
    })
    vi.spyOn(pedidosService, 'get').mockResolvedValue({
      id: 77,
      proforma: 30,
      proforma_numero: 5030,
      estado: 1,
      estado_info: {
        id: 1,
        concepto_codigo: 'ESTADO_PEDIDO',
        codigo: 'CONFIRMADO',
        nombre: 'Confirmado',
      },
      transiciones_permitidas: [],
      fecha_confirmacion: '2026-11-22T10:00:00Z',
      observaciones: '',
      created_by: 1,
      updated_by: 1,
    } as never)
    vi.spyOn(proformasService, 'get').mockResolvedValue({
      id: 30,
      numero: 5030,
      total: '500.00',
      moneda_info: { id: 1, codigo: 'BOB', nombre: 'Bolivianos' },
      cliente_resumen: { id: 5, nombre: 'María Gutiérrez', tipo_cliente_codigo: 'PERSONA' },
      detalles: [],
    } as never)
    vi.spyOn(recibosService, 'list').mockResolvedValue([
      {
        id: 25,
        numero: 1025,
        pedido: 77,
        nombre_completo: 'María Gutiérrez',
        monto_en_letras: 'Cien 00/100 Bolivianos',
        concepto: 'Pago QR inicial',
        tipo_pago: 12,
        tipo_pago_nombre: 'QR',
        moneda_codigo: 'BOB',
        vendedor_resumen: null,
        numero_cheque: null,
        banco: null,
        total: '500.00',
        pago_actual: '100.00',
        a_cuenta: '100.00',
        saldo: '400.00',
        estado: 'EMITIDO',
        fecha: '2026-11-22',
        created_by: 1,
        updated_by: 1,
        clave_idempotencia: null,
      },
    ])
    vi.spyOn(notasEntregaService, 'list').mockResolvedValue([])
    const pdfSpy = vi
      .spyOn(recibosService, 'documentPdf')
      .mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))

    const router = buildRouter()
    await router.push('/pedidos/77')
    await router.isReady()
    const wrapper = mount(PedidoDetailView, {
      global: { plugins: [router, createPinia()], stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('22 de nov de 2026')
    expect(wrapper.text()).toContain('QR')
    const pdfBtn = wrapper.find('button[aria-label="Ver PDF del Recibo #1025"]')
    expect(pdfBtn.exists()).toBe(true)
    await pdfBtn.trigger('click')
    await flushPromises()
    expect(pdfSpy).toHaveBeenCalledWith(25)
  })
})
