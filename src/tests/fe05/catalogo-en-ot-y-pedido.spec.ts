import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { notasEntregaService } from '@/modules/notas-entrega/services/notasEntregaService'
import { ordenesTrabajoService } from '@/modules/ordenes-trabajo/services/ordenesTrabajoService'
import OrdenTrabajoDetailView from '@/modules/ordenes-trabajo/views/OrdenTrabajoDetailView.vue'
import { pedidosService } from '@/modules/pedidos/services/pedidosService'
import PedidoDetailView from '@/modules/pedidos/views/PedidoDetailView.vue'
import { productosService } from '@/modules/productos/services/productosService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { recibosService } from '@/modules/recibos/services/recibosService'
import { galleryService } from '@/shared/media/gallery'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ params: { id: '9' }, query: {} }),
    useRouter: () => ({ push: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) }),
    RouterLink: { template: '<a><slot /></a>' },
  }
})

function makeMixedOt() {
  return {
    id: 9,
    pedido: 9,
    pedido_estado_codigo: 'EN_PRODUCCION',
    pedido_estado_nombre: 'En producción',
    proforma_numero: 101,
    proforma_titulo: 'Proyecto mixto',
    cliente_resumen: { id: 1, nombre: 'Ana López', empresa: null, celular: null },
    jefe_taller: null,
    numero: 40,
    fecha: '2026-11-22',
    fecha_inicio: '2026-11-22',
    fecha_fin: null,
    responsable_recepcion: null,
    fecha_entrega: null,
    lugar_entrega: null,
    estado_saldo: null,
    estado_saldo_info: null,
    estado: 2,
    estado_info: { id: 2, codigo: 'EN_PROCESO', nombre: 'En proceso' },
    created_by: 1,
    updated_by: 1,
    detalles: [
      {
        id: 1,
        tipo_item_info: { id: 1, codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble a medida' },
        producto: null,
        familia_producto: null,
        nombre: 'Escritorio a medida',
        descripcion: 'Melamina roble',
        cantidad: '1.0000',
        unidad_info: { id: 1, codigo: 'PIEZA', nombre: 'Pieza' },
        especificacion: {
          tipo_mueble_info: { id: 1, codigo: 'ESCRITORIO', nombre: 'Escritorio' },
          datos_tecnicos: { componentes: [{ nombre: 'Tablero', material: 'Melamina' }] },
        },
      },
      {
        id: 2,
        tipo_item_info: { id: 2, codigo: 'PISO_FLOTANTE', nombre: 'Piso flotante' },
        producto: 55,
        familia_producto: null,
        nombre: 'Piso Roble Alemán',
        descripcion: null,
        cantidad: '12.5000',
        unidad_info: { id: 2, codigo: 'M2', nombre: 'm²' },
        especificacion: null,
      },
    ],
  }
}

describe('Flujo de catálogo en Pedidos y Órdenes de Trabajo por rol', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('oculta "En producción" en PedidoDetailView cuando el pedido tiene solo productos de catálogo', async () => {
    const session = useSessionStore()
    session.accessToken = 'token'
    session.identity = { id: 1, username: 'vend', display_name: 'Vendedor' }
    session.capabilities = ['comercial.operar']
    session.initialized = true

    vi.spyOn(pedidosService, 'get').mockResolvedValue({
      id: 9,
      fecha_confirmacion: '2026-11-22T10:00:00Z',
      proforma: 101,
      proforma_numero: 101,
      proforma_titulo: null,
      cliente_resumen: null,
      vendedor_resumen: null,
      estado: 1,
      created_by: 1,
      updated_by: 1,
    })
    vi.spyOn(pedidosService, 'options').mockImplementation(async (concepto) => {
      if (concepto === 'ESTADO_PEDIDO') {
        return [
          { id: 1, codigo: 'CONFIRMADO', nombre: 'Confirmado' },
          { id: 2, codigo: 'EN_PRODUCCION', nombre: 'En producción' },
          { id: 3, codigo: 'LISTO_ENTREGA', nombre: 'Listo para entrega' },
          { id: 4, codigo: 'ENTREGADO', nombre: 'Entregado' },
        ] as never
      }
      return []
    })
    vi.spyOn(proformasService, 'get').mockResolvedValue({
      id: 101,
      numero: 101,
      total: '500.00',
      moneda_info: { id: 1, codigo: 'BOB', nombre: 'Bolivianos' },
      cliente_resumen: { id: 1, nombre: 'Cliente Catálogo', empresa: null, celular: null },
      detalles: [
        {
          id: 2,
          tipo_item_info: { id: 2, codigo: 'SILLA', nombre: 'Silla' },
          especificacion: null,
        },
      ],
    } as never)
    vi.spyOn(recibosService, 'list').mockResolvedValue([])
    vi.spyOn(notasEntregaService, 'list').mockResolvedValue([])

    const wrapper = mount(PedidoDetailView, {
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()

    const stepperText = wrapper.find('.stepper').text()
    expect(stepperText).toContain('Confirmado')
    expect(stepperText).toContain('Listo para entrega')
    expect(stepperText).toContain('Entregado')
    expect(stepperText).not.toContain('En producción')
    expect(wrapper.find('.split-action__main').text()).toContain('Listo para entrega')
  })

  it('muestra catálogo superficial para Jefe de Taller y ficha técnica completa para Admin/Vendedor', async () => {
    vi.spyOn(ordenesTrabajoService, 'get').mockResolvedValue(makeMixedOt() as never)
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })

    // 1. Jefe de Taller
    const session = useSessionStore()
    session.accessToken = 'token'
    session.identity = { id: 7, username: 'taller', display_name: 'Carlos Taller' }
    session.capabilities = ['taller.operar']
    session.initialized = true

    const prodSpy = vi.spyOn(productosService, 'get')
    const tallerWrapper = mount(OrdenTrabajoDetailView, {
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(tallerWrapper.text()).toContain('Escritorio a medida')
    expect(tallerWrapper.text()).toContain('Productos de catálogo incluidos (referencia)')
    expect(tallerWrapper.text()).toContain('Piso Roble Alemán')
    expect(tallerWrapper.text()).not.toContain('Medidas y rendimiento')
    expect(prodSpy).not.toHaveBeenCalled()

    // 2. Vendedor / Admin
    setActivePinia(createPinia())
    const adminSession = useSessionStore()
    adminSession.accessToken = 'token'
    adminSession.identity = { id: 1, username: 'admin', display_name: 'Admin' }
    adminSession.capabilities = ['comercial.operar', 'comercial.administrar']
    adminSession.initialized = true

    vi.spyOn(proformasService, 'options').mockResolvedValue([
      { id: 10, codigo: 'KRONO', nombre: 'Kronoflooring' },
    ] as never)
    vi.spyOn(productosService, 'get').mockResolvedValue({
      id: 55,
      sku: 'PISO-ROBLE-08',
      nombre: 'Piso Roble Alemán',
      observaciones: 'Dejar aclimatando 48h antes de instalar.',
      categoria_info: { id: 2, codigo: 'PISO_FLOTANTE', nombre: 'Piso flotante' },
      familia_info: { id: 3, codigo: 'ROBLE', nombre: 'Línea Roble' },
      piso: {
        marca: 10,
        modelo: 'AC4 8mm',
        espesor_mm: '8.00',
        ancho_mm: '192.00',
        largo_mm: '1285.00',
        m2_por_caja: '2.2200',
      },
    } as never)

    const adminWrapper = mount(OrdenTrabajoDetailView, {
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(adminWrapper.text()).toContain('Medidas y rendimiento')
    expect(adminWrapper.text()).toContain('8.00 mm')
    expect(adminWrapper.text()).toContain('PISO-ROBLE-08')
    expect(adminWrapper.text()).toContain('Kronoflooring')
    expect(adminWrapper.text()).toContain('Dejar aclimatando 48h antes de instalar.')
    expect(adminWrapper.text()).not.toContain('Productos de catálogo incluidos (referencia)')
  })
})
