import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import type { Producto, ProductoWritable } from '@/generated/api'
import { galleryService } from '@/shared/media/gallery'
import { productosService } from '../services/productosService'
import ProductoCreateView from './ProductoCreateView.vue'
describe('Reintentos de creación con galería', () => {
  it('sincroniza eliminaciones tras una carga interrumpida sin registrar otro producto', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/productos/nuevo', component: { template: '<div />' } },
        { path: '/productos', component: { template: '<div />' } },
      ],
    })
    await router.push('/productos/nuevo')
    const product = { id: 10, revision: 'v1' } as Producto
    const body = {
      categoria: 1,
      sku: 'RETRY',
      nombre: 'Producto',
      precio_lista: '100.00',
      unidad_stock: 1,
    } satisfies ProductoWritable
    const create = vi.spyOn(productosService, 'create').mockResolvedValue(product)
    vi.spyOn(productosService, 'get').mockResolvedValue(product)
    vi.spyOn(productosService, 'update').mockResolvedValue(product)
    vi.spyOn(galleryService, 'list')
      .mockResolvedValueOnce({ imagenes: [], limite: 8 })
      .mockResolvedValueOnce({
        imagenes: [
          {
            id: 5,
            nombre: 'red.png',
            sha256: 'digest',
            url: '/media/red.webp',
            principal: true,
            posicion: 0,
          },
        ],
        limite: 8,
      })
    vi.spyOn(galleryService, 'upload').mockRejectedValueOnce(
      new Error('Respuesta de carga interrumpida'),
    )
    const remove = vi.spyOn(galleryService, 'change').mockResolvedValue({ imagenes: [], limite: 8 })
    const wrapper = mount(ProductoCreateView, {
      global: {
        plugins: [createPinia(), router],
        stubs: { ProductoForm: { name: 'ProductoForm', template: '<div />' }, Teleport: true },
      },
    })
    wrapper.findComponent({ name: 'ProductoForm' }).vm.$emit('save', body, [
      {
        file: new File(['x'], 'red.png', { type: 'image/png' }),
        digest: 'digest',
        url: 'blob:preview',
        principal: true,
      },
    ])
    await flushPromises()
    wrapper.findComponent({ name: 'ProductoForm' }).vm.$emit('save', body, [])
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('/api/v1/catalogo/productos/10/imagenes/', { eliminar: 5 })
    expect(router.currentRoute.value.path).toBe('/productos')
    wrapper.unmount()
    vi.restoreAllMocks()
  })
  it('advierte que el producto existe si falla la galería y lleva a su ficha al cancelar', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/productos/nuevo', component: { template: '<div />' } },
        { path: '/productos/:id', name: 'producto-detail', component: { template: '<div />' } },
      ],
    })
    await router.push('/productos/nuevo')
    const product = { id: 42, revision: 'v1' } as Producto
    const body = {
      categoria: 1,
      sku: 'PARCIAL',
      nombre: 'Producto',
      precio_lista: '100.00',
      unidad_stock: 1,
    } satisfies ProductoWritable
    const create = vi.spyOn(productosService, 'create').mockResolvedValue(product)
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
    vi.spyOn(galleryService, 'upload').mockRejectedValue(new Error('Fallo de carga'))
    const wrapper = mount(ProductoCreateView, {
      global: {
        plugins: [createPinia(), router],
        stubs: {
          ProductoForm: { name: 'ProductoForm', template: '<div />' },
          ConfirmDialog: {
            name: 'ConfirmDialog',
            props: ['open', 'title', 'description', 'confirmLabel'],
            template: '<div />',
          },
          Teleport: true,
        },
      },
    })
    wrapper.findComponent({ name: 'ProductoForm' }).vm.$emit('save', body, [
      {
        file: new File(['x'], 'red.png', { type: 'image/png' }),
        digest: 'digest',
        url: 'blob:preview',
        principal: true,
      },
    ])
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('El producto #42 ya está registrado')
    expect(router.currentRoute.value.path).toBe('/productos/nuevo')
    wrapper.findComponent({ name: 'ProductoForm' }).vm.$emit('cancel')
    await flushPromises()
    const dialog = wrapper.findAllComponents({ name: 'ConfirmDialog' })[0]!
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('title')).toBe('Producto ya registrado')
    expect(dialog.props('description')).toContain('Salir no lo elimina')
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/productos/42')
    expect(create).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    vi.restoreAllMocks()
  })
})
