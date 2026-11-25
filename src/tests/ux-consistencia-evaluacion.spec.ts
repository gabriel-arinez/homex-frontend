import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useFormChanges } from '@/shared/forms/useFormChanges'
import { diffProformaDetalles } from '@/modules/proformas/utils/diffProformaDetalles'
import CreatorTag from '@/shared/ui/CreatorTag.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import { workOrderTone } from '@/modules/ordenes-trabajo/utils/workOrderPresentation'
import NotasEntregaListView from '@/modules/notas-entrega/views/NotasEntregaListView.vue'
import ProductosListView from '@/modules/productos/views/ProductosListView.vue'
import { notasEntregaService } from '@/modules/notas-entrega/services/notasEntregaService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { productosService } from '@/modules/productos/services/productosService'
import { useSessionStore } from '@/app/stores/useSessionStore'

vi.mock('@/modules/notas-entrega/services/notasEntregaService', () => ({
  notasEntregaService: {
    list: vi.fn<() => Promise<unknown[]>>(),
    documentPdf: vi.fn<() => Promise<Blob>>(),
  },
}))

vi.mock('@/modules/proformas/services/proformasService', () => ({
  proformasService: {
    options: vi.fn<() => Promise<unknown[]>>(),
    families: vi.fn<() => Promise<{ results: unknown[] }>>(),
    list: vi.fn<() => Promise<{ results: unknown[] }>>(),
  },
}))

vi.mock('@/modules/productos/services/productosService', () => ({
  productosService: {
    list: vi.fn<() => Promise<{ count: number; results: unknown[] }>>(),
    update: vi.fn<() => Promise<unknown>>(),
  },
}))

describe('HOMEX — Consistencia visual, UX y detección de cambios', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('useFormChanges detecta modificaciones reales y limpia cuando se restauran los valores originales', () => {
    const state = reactive({ nombres: 'Ana', celular: '71234567' })
    const { captureOriginal, changes, hasChanges } = useFormChanges(
      () => ({ ...state }),
      [
        { key: 'nombres', label: 'Nombres', get: (s) => s.nombres },
        { key: 'celular', label: 'Celular', get: (s) => s.celular },
      ],
    )
    captureOriginal()
    expect(hasChanges.value).toBe(false)
    expect(changes.value).toEqual([])

    state.nombres = 'Ana María'
    expect(hasChanges.value).toBe(true)
    expect(changes.value).toEqual([
      { key: 'nombres', label: 'Nombres', before: 'Ana', after: 'Ana María' },
    ])

    state.nombres = 'Ana'
    expect(hasChanges.value).toBe(false)
    expect(changes.value).toEqual([])
  })

  it('CreatorTag muestra el vendedor responsable con clase destacada', () => {
    const wrapper = mount(CreatorTag, { props: { name: 'Carlos Vendedor' } })
    expect(wrapper.text()).toContain('Carlos Vendedor')
    expect(wrapper.attributes('title')).toBe('Responsable: Carlos Vendedor')
    expect(wrapper.find('.creator-tag').exists()).toBe(true)
  })

  it('StatusBadge y workOrderTone centralizan los tonos semánticos de órdenes de trabajo', () => {
    expect(workOrderTone('PENDIENTE')).toBe('info')
    expect(workOrderTone('EN_PROCESO')).toBe('warning')
    expect(workOrderTone('TERMINADA')).toBe('success')
    expect(workOrderTone('CANCELADA')).toBe('danger')

    const b1 = mount(StatusBadge, { props: { status: 'PENDIENTE' } })
    const b2 = mount(StatusBadge, { props: { status: 'EN_PROCESO' } })
    const b3 = mount(StatusBadge, { props: { status: 'TERMINADA' } })
    const b4 = mount(StatusBadge, { props: { status: 'CANCELADA' } })
    expect(b1.find('.badge--info').exists()).toBe(true)
    expect(b2.find('.badge--warning').exists()).toBe(true)
    expect(b3.find('.badge--success').exists()).toBe(true)
    expect(b4.find('.badge--danger').exists()).toBe(true)
  })

  it('NotasEntregaListView usa cliente_resumen, proforma y fecha_hora sin consultar pedidos/proformas auxiliares', async () => {
    const notes = Array.from({ length: 30 }, (_, idx) => ({
      id: idx + 1,
      pedido: 500 + idx,
      vendedor: 1,
      numero: 1000 + idx,
      fecha: '2026-10-10',
      fecha_hora: idx === 0 ? '2026-10-10T18:30:00Z' : null,
      created_by: 1,
      updated_by: 1,
      proforma_numero: 200 + idx,
      proforma_titulo: `Escritorio Ejecutivo ${idx + 1}`,
      cliente_resumen:
        idx === 1
          ? { id: 2, nombre: 'Juan Contacto', empresa: 'Muebles Andes SRL', celular: '70000001' }
          : idx === 2
            ? null
            : { id: 3, nombre: 'María Pérez', empresa: null, celular: '70000002' },
      vendedor_resumen: { id: 1, username: 'vendedor1', display_name: 'Sofía Ventas' },
      detalles: [],
    }))
    vi.mocked(notasEntregaService.list).mockResolvedValue(notes as never)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/notas-entrega', component: NotasEntregaListView },
        { path: '/notas-entrega/:id', component: { template: '<div />' } },
        { path: '/pedidos/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/notas-entrega')
    await router.isReady()

    const wrapper = mount(NotasEntregaListView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(proformasService.list).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('María Pérez')
    expect(wrapper.text()).toContain('Muebles Andes SRL')
    expect(wrapper.text()).toContain('Cliente sin especificar')
    expect(wrapper.text()).toContain('Prof. #200')
    expect(wrapper.text()).toContain('Sofía Ventas')
    expect(wrapper.text()).toContain('Mostrando 1–10 de 30')
    expect(wrapper.text()).toContain('02:30 p. m.')
    expect(wrapper.text()).toContain('Hora no registrada')
  })

  it('ProductosListView ingresa por defecto en categoría SILLA y vista cuadrícula ignorando preferencia previa de lista', async () => {
    localStorage.setItem('homex_catalog_view_mode', 'lista')
    const session = useSessionStore()
    session.identity = {
      id: 1,
      username: 'vendedor',
      first_name: 'Ana',
      last_name: 'Ventas',
      email: 'ana@homex.bo',
      permissions: ['catalogo.crear_producto', 'comercial.operar'],
      roles: ['VENDEDOR'],
    } as never

    vi.mocked(proformasService.options).mockResolvedValue([
      { id: 42, concepto_codigo: 'CATEGORIA_PRODUCTO', codigo: 'SILLA', nombre: 'Sillas' },
      { id: 43, concepto_codigo: 'CATEGORIA_PRODUCTO', codigo: 'PISO_FLOTANTE', nombre: 'Pisos' },
    ] as never)
    vi.mocked(proformasService.families).mockResolvedValue({ results: [] } as never)
    vi.mocked(productosService.list).mockResolvedValue({ count: 0, results: [] } as never)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/productos', component: ProductosListView }],
    })
    await router.push('/productos')
    await router.isReady()

    const wrapper = mount(ProductosListView, {
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(productosService.list).toHaveBeenCalledWith(expect.objectContaining({ categoria: 42 }))
    expect(
      wrapper.get('[aria-label="Vista del catálogo"] button[aria-pressed="true"]').text(),
    ).toContain('Cuadrícula')
  })

  it('diffProformaDetalles identifica líneas agregadas, eliminadas y campos modificados', () => {
    const orig = [
      {
        id: 10,
        tipo_item: 1,
        producto: 5,
        nombre: 'Silla Ergonómica',
        cantidad: '2',
        unidad: 1,
        precio_unitario: '500.00',
        descuento: '0.00',
        modo_calculo: 'POR_UNIDAD' as const,
        total: '1000.00',
        descripcion: null,
        especificacion: null,
      },
      {
        id: 11,
        tipo_item: 2,
        producto: null,
        nombre: 'Escritorio Gerencial',
        cantidad: '1',
        unidad: 1,
        precio_unitario: '1800.00',
        descuento: '0.00',
        modo_calculo: 'POR_UNIDAD' as const,
        total: '1800.00',
        descripcion: null,
        especificacion: { medidas: { ancho_cm: 160 } },
      },
    ]
    const curr = [
      {
        ...orig[0]!,
        cantidad: '4',
        especificacion: null,
      },
      {
        id: undefined,
        tipo_item: 1,
        producto: 8,
        nombre: 'Mesa Auxiliar',
        cantidad: '1',
        unidad: 1,
        precio_unitario: '350.00',
        descuento: '0.00',
        modo_calculo: 'POR_UNIDAD' as const,
        total: '350.00',
        descripcion: null,
        especificacion: null,
      },
    ]

    const changes = diffProformaDetalles(orig as never, curr as never)
    expect(changes).toEqual([
      {
        key: 'linea-10-cantidad',
        label: 'Silla Ergonómica · Cantidad',
        before: '2',
        after: '4',
      },
      {
        key: 'linea-del-11',
        label: 'Eliminado: Escritorio Gerencial',
        before: 'Cant. 1 · P.U. 1800.00',
        after: 'Eliminado',
      },
      {
        key: 'linea-add-1',
        label: 'Agregado: Mesa Auxiliar',
        before: 'No incluido',
        after: 'Cant. 1 · P.U. 350.00',
      },
    ])
    expect(diffProformaDetalles(orig as never, orig as never)).toEqual([])
  })
})
