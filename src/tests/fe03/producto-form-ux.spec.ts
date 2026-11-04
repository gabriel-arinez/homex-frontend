import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'
import type { Producto } from '@/generated/api'
import { proformasService } from '@/modules/proformas/services/proformasService'

afterEach(() => vi.restoreAllMocks())

function catalog() {
  vi.spyOn(proformasService, 'families').mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  })
  vi.spyOn(proformasService, 'options').mockImplementation(async (key) => {
    const entries: Record<string, Array<{ id: number; codigo: string; nombre: string }>> = {
      CATEGORIA_PRODUCTO: [
        { id: 1, codigo: 'SILLA', nombre: 'Silla' },
        { id: 2, codigo: 'PISO_FLOTANTE', nombre: 'Piso flotante' },
        { id: 3, codigo: 'OTRO', nombre: 'Otro' },
      ],
      UNIDAD_MEDIDA: [
        { id: 4, codigo: 'PIEZA', nombre: 'Pieza' },
        { id: 5, codigo: 'M2', nombre: 'Metro cuadrado' },
        { id: 6, codigo: 'BARRA', nombre: 'Barra' },
      ],
    }
    return (entries[key] ?? []).map((item) => ({ ...item, concepto_codigo: key }))
  })
}
describe('Formulario comercial de productos', () => {
  it('presenta secciones claras, sin control de stock y con asistente contextual', async () => {
    catalog()
    const w = mount(ProductoForm, {
      props: { preselectCategory: 'SILLA', canUploadImage: true },
      global: { stubs: { CapturaCatalogo: true } },
    })
    await flushPromises()
    expect(w.text()).toContain('Información general')
    expect(w.text()).toContain('Características de la silla')
    expect(w.text()).toContain('Precio y promociones')
    expect(w.text()).toContain('Control de existencias')
    expect(w.find('input[name="stock"]').exists()).toBe(false)
    expect((w.get('select[name="unidad"]').element as HTMLSelectElement).value).toBe('4')
    expect(w.get('select[name="unidad"]').attributes('disabled')).toBeDefined()
    expect(w.find('textarea[name="observaciones"]').exists()).toBe(true)
    expect(w.find('input[type="file"]').exists()).toBe(true)
    expect(w.find('.voice-backdrop').exists()).toBe(false)
    w.unmount()
  })
  it('no guarda con datos obligatorios vacíos y valida precios promocionales', async () => {
    catalog()
    const w = mount(ProductoForm, {
      props: { preselectCategory: 'SILLA' },
      global: { stubs: { CapturaCatalogo: true } },
    })
    await flushPromises()
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Revisa los campos señalados')
    expect(w.emitted('save')).toBeUndefined()
    await w.get('input[name="nombre"]').setValue('Silla prueba')
    await w.get('input[name="sku"]').setValue('SIL-TEST')
    await w.get('input[name="precio"]').setValue('100')
    await w.get('input[type="checkbox"]').setValue(true)
    // Los errores sólo se deben a los valores promocionales obligatorios.
    await w.get('form').trigger('submit')
    expect(w.emitted('save')).toBeUndefined()
    w.unmount()
  })
  it('en edición comercial muestra la galería sin permitir acciones inmediatas', async () => {
    catalog()
    const initial = {
      id: 12,
      categoria: 3,
      unidad_stock: 4,
      nombre: 'Artículo existente',
      sku: 'TEST-12',
      precio_lista: '120.00',
      activo: true,
    } as Producto
    const w = mount(ProductoForm, {
      props: { initial, canUploadImage: true },
      global: {
        stubs: {
          CapturaCatalogo: true,
          ImageGallery: {
            name: 'ImageGallery',
            props: ['editable', 'endpoint'],
            template: '<div data-test="galeria" />',
          },
        },
      },
    })
    await flushPromises()
    expect(w.findComponent({ name: 'ImageGallery' }).props('editable')).toBe(false)
    expect(w.text()).toContain('Gestiona las imágenes desde la ficha del producto')
    w.unmount()
  })
  it('oculta la carga de imágenes cuando no existe permiso comercial', async () => {
    catalog()
    const w = mount(ProductoForm, {
      props: { preselectCategory: 'OTRO', canUploadImage: false },
      global: { stubs: { CapturaCatalogo: true } },
    })
    await flushPromises()
    expect(w.text()).toContain('requiere permiso comercial')
    expect(w.find('input[type="file"]').exists()).toBe(false)
    w.unmount()
  })
})
