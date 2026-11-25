import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Producto, ValorCatalogoPublico } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import ProductosListView from '@/modules/productos/views/ProductosListView.vue'
import ProductoDetailView from '@/modules/productos/views/ProductoDetailView.vue'
import { productosService } from '@/modules/productos/services/productosService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { galleryService } from '@/shared/media/gallery'

const catalog = (id: number, codigo: string, nombre: string, concepto = 'CATEGORIA_PRODUCTO') =>
  ({ id, codigo, nombre, concepto_codigo: concepto }) satisfies ValorCatalogoPublico

const sample: Producto = {
  id: 13,
  revision: 'a'.repeat(64),
  categoria: 1,
  categoria_info: catalog(1, 'SILLA', 'Silla'),
  familia_info: { id: 22, codigo: 'SILLAS', nombre: 'Sillas' },
  sku: 'SILLA-0001',
  nombre: 'Silla de visita azul',
  precio_vigente: '590.00',
  stock: '27.0000',
  estado_stock: 'SIN_MINIMO',
  demanda_pendiente: '1.0000',
  disponibilidad_referencial: '26.0000',
  unidad_stock: 3,
  unidad_stock_info: catalog(3, 'PIEZA', 'Pieza', 'UNIDAD_MEDIDA'),
  activo: true,
  imagen_principal: null,
  created_by: 7,
  creado_por_resumen: null,
  updated_by: 7,
}

function mockServices() {
  vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
  const list = vi.spyOn(productosService, 'list').mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [sample],
  })
  vi.spyOn(proformasService, 'options').mockImplementation(async (concepto) => {
    if (concepto === 'CATEGORIA_PRODUCTO')
      return [
        catalog(1, 'SILLA', 'Silla'),
        catalog(2, 'PISO_FLOTANTE', 'Piso flotante'),
        catalog(3, 'OTRO', 'Otro producto'),
      ]
    if (concepto === 'MARCA') return [catalog(10, 'MARCA_A', 'Marca A', 'MARCA')]
    if (concepto === 'COLOR') return [catalog(11, 'AZUL', 'Azul', 'COLOR')]
    return []
  })
  vi.spyOn(proformasService, 'families').mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [{ id: 22, codigo: 'SILLAS', nombre: 'Sillas', activo: true }],
  })
  return list
}
async function makeMounted(path = '/productos', canCreate = false) {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/productos', component: ProductosListView },
      { path: '/productos/nuevo', component: { template: '<p>Nuevo producto</p>' } },
      { path: '/productos/:id', component: { template: '<p>Detalle de producto</p>' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const store = useSessionStore(pinia)
  if (canCreate) store.capabilities = ['catalogo.crear_producto']
  const wrapper = mount(ProductosListView, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return { wrapper, router }
}
afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('Bandeja administrativa de productos', () => {
  it('presenta tabla y tarjetas con estado integrado, stock actual y menú de acciones', async () => {
    mockServices()
    localStorage.removeItem('homex.catalogo.vista-preferida.v1')
    const { wrapper } = await makeMounted('/productos?vista=lista')
    try {
      expect(wrapper.get('table').attributes('class')).toContain('product-table')
      expect(wrapper.text()).toContain('Producto y estado')
      expect(wrapper.text()).toContain('Stock actual')
      expect(wrapper.text()).toContain('1 producto encontrado')
      expect(wrapper.text()).toContain('27 piezas')
      expect(wrapper.text()).not.toContain('Demanda pendiente')
      expect(wrapper.findAll('[aria-label="Acciones de Silla de visita azul"]')).toHaveLength(1)
      expect(wrapper.text()).not.toContain('Nuevo producto')

      await wrapper.get('[aria-label="Acciones de Silla de visita azul"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Ver ficha del producto')

      await wrapper.get('[aria-label="Vista del catálogo"] button:first-child').trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.product-card')).toHaveLength(1)
      expect(wrapper.get('.product-name').text()).toContain('Silla de visita azul')
      expect(wrapper.get('.product-visual').text()).toContain('Sin imagen')
      expect(wrapper.get('.product-card').text()).not.toContain('Demanda pendiente')
      await wrapper.get('[aria-label="Acciones de Silla de visita azul"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('.product-card .menu-dropdown').text()).toContain(
        'Ver ficha del producto',
      )
    } finally {
      wrapper.unmount()
      localStorage.removeItem('homex.catalogo.vista-preferida.v1')
    }
  })

  it('envía la categoría y familia al backend y las conserva en la URL sin más filtros', async () => {
    const list = mockServices()
    const { wrapper, router } = await makeMounted()
    try {
      expect(wrapper.find('.more-filters').exists()).toBe(false)
      expect(wrapper.find('#familia-producto-filtro').exists()).toBe(true)
      await wrapper.get('#categoria-producto-filtro').setValue('1')
      await flushPromises()
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoria: 1, activo: true, page: 1 }),
      )
      expect(router.currentRoute.value.query.categoria).toBe('1')
      await wrapper.get('#categoria-producto-filtro').setValue('2')
      await flushPromises()
      expect(router.currentRoute.value.query.categoria).toBe('2')
    } finally {
      wrapper.unmount()
    }
  })

  it('abre solo las categorías reales y navega al formulario correcto al crear', async () => {
    mockServices()
    const { wrapper, router } = await makeMounted('/productos', true)
    try {
      const choices = wrapper.get('[aria-label="Crear producto por categoría"]')
      expect(choices.findAll('button')).toHaveLength(3)
      expect(choices.text()).toContain('Silla')
      expect(choices.text()).toContain('Piso')
      expect(choices.text()).toContain('Otro')
      await choices.findAll('button')[1]?.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/productos/nuevo')
      expect(router.currentRoute.value.query.categoria).toBe('PISO_FLOTANTE')
    } finally {
      wrapper.unmount()
    }
  })

  it('consulta una URL filtrada sin sustituir los datos de catálogo', async () => {
    const list = mockServices()
    const { wrapper } = await makeMounted('/productos?estado=todos&categoria=1&vista=grid&pagina=2')
    try {
      expect(wrapper.find('.product-grid').exists()).toBe(true)
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          activo: undefined,
          categoria: 1,
          page: 2,
        }),
      )
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          activo: undefined,
          categoria: 1,
          page: 1,
        }),
      )
      expect(wrapper.text()).toContain('1 producto encontrado')
    } finally {
      wrapper.unmount()
    }
  })
  it('oculta las miniaturas en la tabla sin ocultar identidad, SKU o precio', async () => {
    const key = 'homex.catalogo.imagenes-visibles.v1'
    localStorage.removeItem(key)
    mockServices()
    const { wrapper } = await makeMounted('/productos?vista=lista')
    try {
      expect(wrapper.find('.thumbnail').exists()).toBe(true)
      await wrapper.get('.table-image-toggle').trigger('click')
      expect(wrapper.find('.thumbnail').exists()).toBe(false)
      expect(wrapper.text()).toContain('SILLA-0001')
      expect(wrapper.text()).toContain('590')
      expect(localStorage.getItem(key)).toBe('false')
      await wrapper.get('.table-image-toggle').trigger('click')
      expect(wrapper.find('.thumbnail').exists()).toBe(true)
    } finally {
      wrapper.unmount()
      localStorage.removeItem(key)
    }
  })

  it('presenta ficha de detalle de producto con KPIs, enlaces y especificaciones legibles', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
    vi.spyOn(proformasService, 'options').mockResolvedValue([
      catalog(10, 'MARCA_A', 'Marca A', 'MARCA'),
      catalog(11, 'AZUL', 'Azul', 'COLOR'),
    ])
    vi.spyOn(productosService, 'get').mockResolvedValue({
      ...sample,
      precio_lista: '650.00',
      promocion: { vigente: true, precio_antes: '650.00', precio_ahora: '590.00' },
      silla: {
        marca: 10,
        modelo: 'S-200',
        color_primario: 11,
        color_secundario: null,
        especificaciones: { tapizado: 'Malla', resistencia: 120 },
      },
    } as unknown as Producto)
    const pinia = createPinia()
    const store = useSessionStore(pinia)
    store.capabilities = ['comercial.operar', 'catalogo.crear_producto']
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/productos', component: { template: '<div />' } },
        { path: '/productos/:id', component: ProductoDetailView },
        { path: '/movimientos-stock', component: { template: '<div />' } },
      ],
    })
    await router.push('/productos/13')
    await router.isReady()
    const wrapper = mount(ProductoDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    try {
      expect(wrapper.text()).toContain('Silla de visita azul')
      expect(wrapper.text()).toContain('27 piezas')
      expect(wrapper.text()).toContain('Promoción vigente')
      expect(wrapper.text()).toContain('Marca A')
      expect(wrapper.text()).toContain('Azul')
      expect(wrapper.text()).toContain('Tapizado')
      expect(wrapper.text()).toContain('Malla')
      expect(wrapper.text()).not.toContain('[object Object]')
      expect(wrapper.text()).toContain('Ver movimientos')
    } finally {
      wrapper.unmount()
    }
  })
})
