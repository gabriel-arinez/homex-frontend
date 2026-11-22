import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import AlertCenterDrawer from '@/app/components/AlertCenterDrawer.vue'
import { useAlertsStore } from '@/app/stores/useAlertsStore'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ordenesTrabajoService } from '@/modules/ordenes-trabajo/services/ordenesTrabajoService'
import { pedidosService } from '@/modules/pedidos/services/pedidosService'
import { productosService } from '@/modules/productos/services/productosService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { recibosService } from '@/modules/recibos/services/recibosService'

const pushMock = vi.fn<(to: string) => Promise<void>>().mockResolvedValue(undefined)

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: pushMock }),
  }
})

function makeOt(overrides: Record<string, unknown> = {}) {
  return {
    id: 40,
    pedido: 9,
    pedido_estado_codigo: 'EN_PRODUCCION',
    pedido_estado_nombre: 'En producción',
    proforma_numero: 101,
    proforma_titulo: 'Escritorio gerencial',
    cliente_resumen: null,
    jefe_taller: null,
    numero: 40,
    fecha: '2026-11-20',
    fecha_inicio: '2026-11-21',
    fecha_fin: '2026-11-28',
    responsable_recepcion: null,
    fecha_entrega: null,
    lugar_entrega: null,
    estado_saldo: null,
    estado_saldo_info: null,
    estado: 1,
    estado_info: { id: 1, codigo: 'PENDIENTE', nombre: 'Pendiente' },
    created_by: 1,
    updated_by: 1,
    detalles: [
      {
        id: 1,
        tipo_item_info: { id: 1, codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble a medida' },
        especificacion: {
          datos_tecnicos: { advertencias: ['color_pendiente'] },
        },
      },
    ],
    ...overrides,
  }
}

describe('Alertas dinámicas entre roles', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    pushMock.mockClear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('genera alertas de nuevas órdenes y advertencias técnicas para Jefe de Taller', async () => {
    const session = useSessionStore()
    session.accessToken = 'test-token'
    session.identity = { id: 7, username: 'taller', display_name: 'Carlos Taller' }
    session.capabilities = ['taller.operar']
    session.initialized = true

    vi.spyOn(ordenesTrabajoService, 'list').mockResolvedValue([makeOt() as never])

    const alerts = useAlertsStore()
    await alerts.refresh()

    expect(alerts.items.some((a) => a.title.includes('Nueva orden de trabajo'))).toBe(true)
    expect(alerts.items.some((a) => a.title.includes('Advertencias técnicas'))).toBe(true)
    expect(alerts.unseenCount).toBe(2)

    alerts.markAllSeen()
    expect(alerts.unseenCount).toBe(0)
  })

  it('alerta al Vendedor cuando Taller completa una OT o actualiza planificación y emite Toast en vivo', async () => {
    const session = useSessionStore()
    session.accessToken = 'test-token'
    session.identity = { id: 12, username: 'vendedor', display_name: 'Ana Ventas' }
    session.capabilities = ['comercial.operar']
    session.initialized = true

    const listOt = vi.spyOn(ordenesTrabajoService, 'list').mockResolvedValue([
      makeOt({
        estado_info: { id: 2, codigo: 'EN_PROCESO', nombre: 'En proceso' },
        fecha_entrega: '2026-11-29',
      }) as never,
    ])
    vi.spyOn(pedidosService, 'list').mockResolvedValue([
      {
        id: 9,
        fecha_confirmacion: '2026-11-20T10:00:00Z',
        proforma: 101,
        estado: 10,
        created_by: 12,
        updated_by: 12,
      },
    ])
    vi.spyOn(pedidosService, 'options').mockResolvedValue([
      { id: 10, codigo: 'CONFIRMADO', nombre: 'Confirmado', orden: 1 },
      { id: 11, codigo: 'LISTO_ENTREGA', nombre: 'Listo para entrega', orden: 2 },
    ] as never)
    vi.spyOn(proformasService, 'list').mockResolvedValue({
      count: 0,
      results: [],
    } as never)

    const alerts = useAlertsStore()
    await alerts.refresh()
    expect(alerts.liveToast).toBeNull()
    expect(alerts.items.some((a) => a.title.includes('Planificación actualizada'))).toBe(true)
    expect(alerts.items.some((a) => a.title.includes('Pedido pendiente de envío'))).toBe(true)

    alerts.markAllSeen()
    expect(alerts.unseenCount).toBe(0)

    listOt.mockResolvedValue([
      makeOt({
        estado_info: { id: 3, codigo: 'TERMINADA', nombre: 'Terminada' },
        pedido_estado_codigo: 'LISTO_ENTREGA',
      }) as never,
    ])
    await alerts.refresh()

    const completed = alerts.items.find((a) => a.title.includes('Orden completada por taller'))
    expect(completed).toBeDefined()
    expect(completed?.isNew).toBe(true)
    expect(alerts.liveToast?.tone).toBe('success')
  })

  it('genera alertas de stock crítico y recibos anulados para Admin y navega desde el panel', async () => {
    const session = useSessionStore()
    session.accessToken = 'test-token'
    session.identity = { id: 1, username: 'admin', display_name: 'Admin Homex' }
    session.capabilities = ['comercial.operar', 'comercial.administrar', 'taller.operar']
    session.initialized = true

    vi.spyOn(ordenesTrabajoService, 'list').mockResolvedValue([])
    vi.spyOn(pedidosService, 'list').mockResolvedValue([])
    vi.spyOn(pedidosService, 'options').mockResolvedValue([])
    vi.spyOn(proformasService, 'list').mockResolvedValue({ count: 0, results: [] } as never)
    vi.spyOn(productosService, 'list').mockImplementation(async (query) => {
      if (query?.estado_stock === 'SIN_EXISTENCIAS') {
        return {
          count: 1,
          results: [{ id: 55, nombre: 'Piso Roble', sku: 'PISO-01', stock: 0 }],
        } as never
      }
      return { count: 0, results: [] } as never
    })
    vi.spyOn(recibosService, 'list').mockResolvedValue([
      { id: 88, numero: 15, nombre_completo: 'Cliente Test', estado: 'ANULADO' } as never,
    ])

    const alerts = useAlertsStore()
    await alerts.refresh()

    expect(alerts.items.some((a) => a.title === 'Producto sin existencias')).toBe(true)
    expect(alerts.items.some((a) => a.title === 'Recibo anulado')).toBe(true)

    const wrapper = mount(AlertCenterDrawer, {
      props: { open: true },
      global: { stubs: { Teleport: true } },
    })

    const stockBtn = wrapper
      .findAll('button.alert-card')
      .find((b) => b.text().includes('Piso Roble'))
    expect(stockBtn).toBeDefined()
    await stockBtn!.trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/productos/55')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
