import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Producto, ValorCatalogoPublico } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { galleryService } from '@/shared/media/gallery'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { productosService } from '@/modules/productos/services/productosService'
import { movimientosStockService } from '@/modules/movimientos-stock/services/movimientosStockService'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'
import ProductosListView from '@/modules/productos/views/ProductosListView.vue'
import ProductoDetailView from '@/modules/productos/views/ProductoDetailView.vue'
import DetalleForm from '@/modules/proformas/components/DetalleForm.vue'

const opt = (id: number, codigo: string, nombre: string, concepto = 'CATEGORIA_PRODUCTO') =>
  ({ id, codigo, nombre, concepto_codigo: concepto }) satisfies ValorCatalogoPublico

const sillaSample: Producto = {
  id: 50,
  revision: 'rev-50',
  categoria: 1,
  categoria_info: opt(1, 'SILLA', 'Silla de oficina'),
  familia: 20,
  familia_info: { id: 20, codigo: 'EJEC', nombre: 'Ejecutivas' },
  sku: 'SILLA-EJEC-01',
  nombre: 'Silla ejecutiva ergonómica Mesh',
  precio_lista: '1250.00',
  precio_vigente: '1250.00',
  stock: '21.0000',
  stock_minimo: '5.0000',
  estado_stock: 'NORMAL',
  demanda_pendiente: '2.0000',
  disponibilidad_referencial: '19.0000',
  unidad_stock: 3,
  unidad_stock_info: opt(3, 'PIEZA', 'Pieza', 'UNIDAD_MEDIDA'),
  activo: true,
  observaciones: 'Respaldo ergonómico.',
  imagen_principal: null,
  silla: {
    producto: 50,
    marca: 10,
    marca_nombre: 'ErgoTech',
    modelo: 'NF-850',
    color_primario: 11,
    color_primario_nombre: 'Negro',
    color_secundario_nombre: null,
    especificaciones: {
      Giro: '360°',
      Ruedas: '5 ruedas de nylon',
      Asiento: 'Espuma inyectada',
    },
  },
  created_by: 1,
  creado_por_resumen: { id: 1, username: 'admin', display_name: 'Admin Homex' },
  updated_by: 1,
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.body.replaceChildren()
})

describe('Rediseño integral del apartado de Productos', () => {
  it('ProductImage usa icono acorde a la categoría cuando no hay imagen', () => {
    const sillaWrap = mount(ProductImage, {
      props: { image: null, alt: 'Silla X', categoryCode: 'SILLA' },
    })
    const pisoWrap = mount(ProductImage, {
      props: { image: null, alt: 'Piso Y', categoryCode: 'PISO_FLOTANTE' },
    })
    expect(sillaWrap.find('.fallback-icon-box svg').attributes('class')).toContain('armchair')
    expect(pisoWrap.find('.fallback-icon-box svg').attributes('class')).toContain('layers')
  })

  it('ProductosListView recuerda vista cuadrícula/lista, filtra por existencias y registra ajuste directo', async () => {
    localStorage.setItem('homex.catalogo.vista-preferida.v1', 'grid')
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
    const listSpy = vi.spyOn(productosService, 'list').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [sillaSample],
    })
    vi.spyOn(proformasService, 'options').mockResolvedValue([
      opt(1, 'SILLA', 'Silla de oficina'),
      opt(2, 'PISO_FLOTANTE', 'Piso flotante'),
    ])
    vi.spyOn(movimientosStockService, 'motivosAjuste').mockResolvedValue({
      ENTRADA: [{ codigo: 'REPOSICION', nombre: 'Reposición', requiere_observaciones: false }],
      SALIDA: [{ codigo: 'MERMA', nombre: 'Merma', requiere_observaciones: false }],
    })

    const pinia = createPinia()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/productos', component: ProductosListView },
        { path: '/productos/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/productos')
    await router.isReady()

    const session = useSessionStore(pinia)
    session.capabilities = ['catalogo.crear_producto', 'comercial.administrar', 'comercial.operar']

    const wrapper = mount(ProductosListView, {
      attachTo: document.body,
      global: { plugins: [pinia, router], stubs: { Teleport: true } },
    })
    await flushPromises()

    // Mantiene vista cuadrícula guardada sin ?vista=grid
    expect(wrapper.find('.product-grid').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Demanda pendiente')
    expect(wrapper.text()).toContain('21 piezas')

    // Filtra por existencias (estado_stock)
    await wrapper.get('#existencias-producto-filtro').setValue('STOCK_BAJO')
    await flushPromises()
    expect(listSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado_stock: 'STOCK_BAJO' }),
    )

    // Abre menú ⋮ en tarjeta y registra entrada de stock
    await wrapper.get('[aria-label="Acciones de Silla ejecutiva ergonómica Mesh"]').trigger('click')
    await flushPromises()
    const entryBtn = wrapper
      .findAll('.menu-dropdown button')
      .find((b) => b.text().includes('Registrar entrada'))!
    await entryBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Registrar movimiento de inventario')
    expect(wrapper.text()).toContain('21 piezas')

    wrapper.unmount()
  })

  it('ProductoForm permite gestionar imágenes en edición y advierte productos similares / SKU duplicado', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
    vi.spyOn(proformasService, 'families').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(proformasService, 'options').mockImplementation(async (c) => {
      if (c === 'CATEGORIA_PRODUCTO') return [opt(1, 'SILLA', 'Silla')]
      if (c === 'UNIDAD_MEDIDA') return [opt(3, 'PIEZA', 'Pieza', 'UNIDAD_MEDIDA')]
      return []
    })
    vi.spyOn(productosService, 'verificarSimilares').mockResolvedValue({
      sku_duplicado: {
        id: 99,
        sku: 'SILLA-EJEC-01',
        nombre: 'Silla Existente',
        categoria_nombre: 'Silla',
        precio_vigente: '900.00',
        stock: '5',
        unidad_nombre: 'Pieza',
        activo: true,
        coincidencia: 'SKU_EXACTO',
        motivo: 'Ya existe el producto con SKU SILLA-EJEC-01.',
      },
      similares: [
        {
          id: 88,
          sku: 'SILLA-OTRA',
          nombre: 'Silla ejecutiva ergonómica Mesh Pro',
          categoria_nombre: 'Silla',
          precio_vigente: '1300.00',
          stock: '8',
          unidad_nombre: 'Pieza',
          activo: true,
          coincidencia: 'SIMILAR',
          motivo: 'Nombre o modelo muy similar a este registro.',
        },
      ],
    })

    const wrapper = mount(ProductoForm, {
      props: { initial: sillaSample, canUploadImage: true },
    })
    await flushPromises()

    // Ahora ImageGallery sí es editable en modo edición y usa streamlined
    expect(wrapper.find('input[type="file"][aria-label="Agregar imágenes"]').exists()).toBe(true)

    await wrapper.get('input[name="sku"]').setValue('SILLA-EJEC-99')
    await new Promise((r) => setTimeout(r, 420))
    await flushPromises()

    expect(wrapper.text()).toContain('Posible producto duplicado o similar encontrado')
    expect(wrapper.text()).toContain('Silla ejecutiva ergonómica Mesh Pro')
    expect(wrapper.text()).toContain('El código SKU ya pertenece a «Silla Existente»')
  })

  it('DetalleForm muestra ficha completa sin JSON crudo al seleccionar producto en proforma', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
    vi.spyOn(productosService, 'list').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [sillaSample],
    })
    vi.spyOn(productosService, 'get').mockResolvedValue(sillaSample)

    const wrapper = mount(DetalleForm, {
      props: {
        tipos: [opt(1, 'SILLA', 'Silla de oficina', 'TIPO_ITEM')],
        categorias: [opt(1, 'SILLA', 'Silla de oficina')],
        unidades: [opt(3, 'PIEZA', 'Pieza', 'UNIDAD_MEDIDA')],
        moneda: 'BOB',
        initialProductId: 50,
      },
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(wrapper.find('.master-sheet').exists()).toBe(true)
    expect(wrapper.text()).toContain('ErgoTech')
    expect(wrapper.text()).toContain('NF-850')
    expect(wrapper.text()).toContain('360°')
    expect(wrapper.text()).toContain('5 ruedas de nylon')
    expect(wrapper.text()).not.toContain('{"Giro"')
    expect(wrapper.text()).not.toContain('21.0000')
    expect(wrapper.text()).toContain('21 piezas')
  })

  it('ProductoDetailView permite abrir entrada/salida directa de stock', async () => {
    vi.spyOn(galleryService, 'list').mockResolvedValue({ imagenes: [], limite: 8 })
    vi.spyOn(proformasService, 'options').mockResolvedValue([])
    vi.spyOn(productosService, 'get').mockResolvedValue(sillaSample)
    vi.spyOn(movimientosStockService, 'motivosAjuste').mockResolvedValue({
      ENTRADA: [{ codigo: 'REPOSICION', nombre: 'Reposición', requiere_observaciones: false }],
      SALIDA: [{ codigo: 'MERMA', nombre: 'Merma', requiere_observaciones: false }],
    })

    const pinia = createPinia()
    const session = useSessionStore(pinia)
    session.capabilities = ['comercial.administrar', 'comercial.operar', 'catalogo.crear_producto']

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/productos', component: { template: '<div />' } },
        { path: '/productos/:id', component: ProductoDetailView },
      ],
    })
    await router.push('/productos/50')
    await router.isReady()

    const wrapper = mount(ProductoDetailView, {
      global: { plugins: [pinia, router], stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Admin Homex')
    const salidaBtn = wrapper.findAll('button').find((b) => b.text().includes('Salida stock'))!
    await salidaBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Registrar movimiento de inventario')
  })
})
