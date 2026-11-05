import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Producto, ValorCatalogoPublico } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import ProductosListView from '@/modules/productos/views/ProductosListView.vue'
import { productosService } from '@/modules/productos/services/productosService'
import { proformasService } from '@/modules/proformas/services/proformasService'

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
  demanda_pendiente: '1.0000',
  disponibilidad_referencial: '26.0000',
  unidad_stock: 3,
  unidad_stock_info: catalog(3, 'PIEZA', 'Pieza', 'UNIDAD_MEDIDA'),
  activo: true,
  imagen_principal: null,
  created_by: 7,
  updated_by: 7,
}

function mockServices() {
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
  it('presenta una tabla por defecto, unidades comprensibles y un solo ojo de consulta', async () => {
    mockServices()
    const { wrapper } = await makeMounted()
    try {
      expect(wrapper.get('table').attributes('class')).toContain('product-table')
      expect(wrapper.text()).toContain('1 producto encontrado')
      expect(wrapper.text()).toContain('27 piezas')
      expect(wrapper.text()).toContain('Pendiente: 1')
      expect(wrapper.findAll('[aria-label="Ver producto Silla de visita azul"]')).toHaveLength(1)
      expect(wrapper.text()).not.toContain('Nuevo producto')
      await wrapper.get('[aria-label="Vista del catálogo"] button:first-child').trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.product-card')).toHaveLength(1)
      expect(wrapper.get('.product-name').text()).toContain('Silla de visita azul')
      expect(wrapper.get('.product-visual').text()).toContain('Sin imagen')
    } finally {
      wrapper.unmount()
    }
  })

  it('envía la categoría y sus atributos permitidos al backend y los conserva en la URL', async () => {
    const list = mockServices()
    const { wrapper, router } = await makeMounted()
    try {
      await wrapper.get('#categoria-producto-filtro').setValue('1')
      await flushPromises()
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoria: 1, activo: true, page: 1 }),
      )
      await wrapper.get('.more-filters').trigger('click')
      await flushPromises()
      expect(wrapper.find('#material-producto-filtro').exists()).toBe(false)
      await wrapper.get('#marca-producto-filtro').setValue('10')
      await flushPromises()
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: 1, marca: 10 }))
      expect(router.currentRoute.value.query.marca).toBe('10')
      expect(router.currentRoute.value.query.categoria).toBe('1')
      await wrapper.get('#categoria-producto-filtro').setValue('2')
      await flushPromises()
      expect(wrapper.find('#material-producto-filtro').exists()).toBe(true)
      expect(router.currentRoute.value.query.marca).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('abre solo las categorías reales y navega al formulario correcto al crear', async () => {
    mockServices()
    const { wrapper, router } = await makeMounted('/productos', true)
    try {
      await wrapper.get('button.create-trigger').trigger('click')
      await flushPromises()
      const choices = wrapper.get('[aria-label="Elegir categoría del nuevo producto"]')
      expect(choices.findAll('button')).toHaveLength(3)
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
    const { wrapper } = await makeMounted()
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
})
