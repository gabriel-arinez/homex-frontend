import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DetalleProforma, Producto } from '@/generated/api'
import { galleryService } from '@/shared/media/gallery'
import ProductoVistaRapida from './ProductoVistaRapida.vue'

const product = {
  id: 7,
  nombre: 'Silla ejecutiva',
  sku: 'S-007',
  categoria_info: { nombre: 'Silla', codigo: 'SILLA' },
  familia_info: { nombre: 'Oficina' },
  unidad_stock_info: { nombre: 'Pieza' },
  precio_lista: '800.00',
  precio_vigente: '720.00',
  activo: true,
  stock: '2.0000',
  demanda_pendiente: '1.0000',
  disponibilidad_referencial: '1.0000',
  imagen_principal: null,
  silla: { modelo: 'Ergo', especificaciones: { respaldo: 'Malla' } },
} as unknown as Producto

const line = {
  nombre: 'Silla negociada histórica',
  tipo_item_info: { nombre: 'Mueble a pedido' },
  tipo_item: 8,
  producto: 7,
  descripcion: 'Tapizado especial',
  cantidad: '2.5000',
  unidad_info: { nombre: 'Pieza' },
  modo_calculo: 'TOTAL_NEGOCIADO',
  precio_unitario: '150.00',
  importe_negociado: '321.75',
  descuento: '10.25',
  total: '311.50',
  especificacion: {
    tipo_mueble_info: { nombre: 'Mesa auxiliar' },
    observaciones: 'Conservar tono nogal',
    datos_tecnicos: {
      caracteristicas_generales: { dimensiones: { alto: { valor: 75, unidad: 'cm' } } },
      conjuntos: [{ uid: 'g1', nombre: 'Estructura' }],
      componentes: [
        { uid: 'c1', nombre: 'Tablero', material: 'Madera', dimensiones: '80 x 40 cm' },
      ],
      atributos_legacy: { cod_antiguo: 'A-11' },
    },
  },
} as unknown as DetalleProforma

function mountViewer(props: Record<string, unknown> = {}) {
  return mount(ProductoVistaRapida, {
    props: { open: true, product, ...props },
    global: {
      stubs: {
        Modal: {
          props: ['open', 'title'],
          template:
            '<div v-if="open" role="dialog"><h2>{{ title }}</h2><slot/><slot name="footer"/></div>',
        },
        RouterLink: { props: ['to'], template: '<a class="full-detail" :href="to"><slot/></a>' },
      },
    },
  })
}

afterEach(() => vi.restoreAllMocks())

describe('ProductoVistaRapida', () => {
  it('muestra un resumen de cotización sin mezclar datos actuales del catálogo', () => {
    const wrapper = mountViewer({ line })
    expect(wrapper.text()).toContain('Resumen de la línea')
    expect(wrapper.text()).toContain('Importe negociado histórico')
    expect(wrapper.text()).toContain('321.75')
    expect(wrapper.text()).toContain('311.50')
    expect(wrapper.text()).not.toContain('Precio vigente del catálogo')
  })

  it('mantiene la ficha técnica detallada fuera del modal de resumen', () => {
    const wrapper = mountViewer({ line })
    expect(wrapper.text()).not.toContain('Ficha técnica')
    expect(wrapper.text()).not.toContain('Tablero')
    expect(wrapper.text()).not.toContain('A-11')
    expect(wrapper.text()).toContain('Resumen de datos')
    expect(wrapper.text()).toContain('75 cm')
    expect(wrapper.text()).toContain('Conservar tono nogal')
  })

  it('presenta los atributos de piso flotante y su promoción sin perder precisión', () => {
    const floor = {
      ...product,
      categoria_info: { nombre: 'Piso flotante', codigo: 'PISO_FLOTANTE' },
      precio_vigente: '87.1250',
      promocion: { vigente: true, precio_antes: '100.0000', precio_ahora: '87.1250' },
      piso: { modelo: 'Roble', espesor_mm: '8.50', ancho_mm: '190', largo_mm: '1200' },
    } as unknown as Producto
    const wrapper = mountViewer({ product: floor })
    expect(wrapper.text()).toContain('Piso flotante')
    expect(wrapper.text()).toContain('87.1250')
    expect(wrapper.text()).toContain('Promoción vigente')
    expect(wrapper.text()).toContain('Espesor8.50 mm')
    expect(wrapper.text()).toContain('Largo1200 mm')
  })

  it('emite cierre y acción contextual, y conserva el enlace a ficha completa', async () => {
    const wrapper = mountViewer({ actionLabel: 'Ir a línea', detailTo: '/productos/7' })
    await wrapper.get('.viewer-footer button').trigger('click')
    await wrapper.get('button.context-action').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('action')).toHaveLength(1)
    expect(wrapper.get('a.full-detail').attributes('href')).toBe('/productos/7')
  })

  it('muestra error con opción de reintento', async () => {
    const wrapper = mountViewer({ error: 'No se pudo cargar la ficha.' })
    expect(wrapper.text()).toContain('No se pudo cargar la ficha.')
    await wrapper.get('button.retry').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('permite cambiar entre miniaturas y comunica un fallo de carga de galería', async () => {
    const wrapper = mountViewer({
      gallery: [
        {
          id: 1,
          nombre: 'Frente',
          url: 'https://images.example/front.jpg',
          principal: true,
          posicion: 0,
        },
        {
          id: 2,
          nombre: 'Lateral',
          url: 'https://images.example/side.jpg',
          principal: false,
          posicion: 1,
        },
      ],
    })
    expect(wrapper.get('.gallery-image').attributes('src')).toBe('https://images.example/front.jpg')
    await wrapper.get('[aria-label="Mostrar imagen 2"]').trigger('click')
    expect(wrapper.get('.gallery-image').attributes('src')).toBe('https://images.example/side.jpg')
    await wrapper.get('.gallery-image').trigger('error')
    expect(wrapper.text()).toContain('No se pudo cargar la imagen')
  })

  it('recurre a una variante disponible cuando falla la imagen de mayor resolución', async () => {
    const wrapper = mountViewer({
      gallery: [
        {
          id: 3,
          nombre: 'Mesa',
          url: 'https://images.example/original.jpg',
          variantes: {
            '320': 'https://images.example/small.jpg',
            '1200': 'https://images.example/large-missing.jpg',
          },
          principal: true,
          posicion: 0,
        },
      ],
    })

    expect(wrapper.get('.gallery-image').attributes('src')).toBe(
      'https://images.example/large-missing.jpg',
    )
    await wrapper.get('.gallery-image').trigger('error')
    expect(wrapper.get('.gallery-image').attributes('src')).toBe('https://images.example/small.jpg')
  })

  it('permite reintentar imágenes y descarta respuestas de galería obsoletas', async () => {
    let resolveOld!: (value: { imagenes: never[]; limite: number }) => void
    const oldResponse = new Promise<{ imagenes: never[]; limite: number }>((resolve) => {
      resolveOld = resolve
    })
    const list = vi
      .spyOn(galleryService, 'list')
      .mockRejectedValueOnce(new Error('Galería temporalmente no disponible'))
      .mockReturnValueOnce(oldResponse as never)
      .mockResolvedValueOnce({
        imagenes: [
          {
            id: 9,
            nombre: 'Nueva',
            url: 'https://images.example/new.jpg',
            principal: true,
            posicion: 0,
          },
        ],
        limite: 8,
      })
    const wrapper = mountViewer({ galleryEndpoint: '/old' })
    await flushPromises()
    expect(wrapper.text()).toContain('Galería temporalmente no disponible')
    await wrapper.get('button.retry-link').trigger('click')
    await wrapper.setProps({ galleryEndpoint: '/new' })
    await flushPromises()
    resolveOld({ imagenes: [], limite: 8 })
    await flushPromises()
    expect(wrapper.get('.gallery-image').attributes('src')).toBe('https://images.example/new.jpg')
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('descarta fallos obsoletos de la ruta de respaldo al cambiar de producto', async () => {
    let rejectOldFallback!: (cause: Error) => void
    const oldFallback = new Promise<{ imagenes: never[]; limite: number }>((_, reject) => {
      rejectOldFallback = reject
    })
    const list = vi
      .spyOn(galleryService, 'list')
      .mockRejectedValueOnce(new Error('Galería primaria no disponible'))
      .mockReturnValueOnce(oldFallback as never)
      .mockResolvedValueOnce({
        imagenes: [
          {
            id: 12,
            nombre: 'Nueva',
            url: 'https://images.example/current.jpg',
            principal: true,
            posicion: 0,
          },
        ],
        limite: 8,
      })
    const wrapper = mountViewer({
      galleryEndpoint: '/old-primary',
      galleryFallbackEndpoint: '/old-fallback',
    })
    await flushPromises()
    await wrapper.setProps({ galleryEndpoint: '/current', galleryFallbackEndpoint: '' })
    await flushPromises()
    rejectOldFallback(new Error('Error de la galería antigua'))
    await flushPromises()
    expect(wrapper.get('.gallery-image').attributes('src')).toBe(
      'https://images.example/current.jpg',
    )
    expect(wrapper.text()).not.toContain('Galería primaria no disponible')
    expect(wrapper.text()).not.toContain('Error de la galería antigua')
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('no solicita la galería de respaldo si la vista se cierra durante la solicitud principal', async () => {
    let resolvePrimary!: (value: { imagenes: never[]; limite: number }) => void
    const primary = new Promise<{ imagenes: never[]; limite: number }>((resolve) => {
      resolvePrimary = resolve
    })
    const list = vi.spyOn(galleryService, 'list').mockReturnValue(primary as never)
    const wrapper = mountViewer({
      galleryEndpoint: '/primary',
      galleryFallbackEndpoint: '/fallback',
    })

    await wrapper.setProps({ open: false })
    resolvePrimary({ imagenes: [], limite: 8 })
    await flushPromises()

    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith('/primary')
  })
})
