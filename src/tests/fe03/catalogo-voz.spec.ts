import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CapturaCatalogo from '@/modules/productos/components/CapturaCatalogo.vue'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'
import { catalogoCapturaService } from '@/modules/productos/services/catalogoCapturaService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import type { CategoriaEnum } from '@/generated/api'

afterEach(() => vi.restoreAllMocks())
function mockResult(category: CategoriaEnum) {
  vi.spyOn(catalogoCapturaService, 'create').mockResolvedValue({
    id: 1,
    estado: 'PENDIENTE',
    intento_id: 1,
    numero_intento: 1,
    reutilizada: false,
  })
  vi.spyOn(catalogoCapturaService, 'get').mockResolvedValue({
    id: 1,
    estado: 'COMPLETADA',
    categoria: category,
    texto_transcrito_original: 'nombre: Zócalo',
    error_codigo: null,
    propuesta: {
      category,
      fields: { nombre: 'Zócalo' },
      warnings: ['Revisar'],
      evidence: [],
      unrecognized: [],
      version: 'catalog-0.1.20',
    },
  })
}
function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find((b) => b.text() === label)!
}
describe('Voz en creación de catálogo', () => {
  it.each(['SILLA', 'PISO_FLOTANTE', 'OTRO'] as const)(
    'sube audio, conserva categoría y sólo aplica por acción explícita: %s',
    async (category) => {
      mockResult(category)
      const w = mount(CapturaCatalogo, { props: { categoria: category } })
      const file = new File(['audio'], 'homex.wav', { type: 'audio/wav' })
      const input = w.get('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file] })
      await input.trigger('change')
      await button(w, 'Procesar audio').trigger('click')
      await flushPromises()
      expect(catalogoCapturaService.create).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: category, audio: file }),
        expect.anything(),
      )
      expect(w.get('textarea').element.value).toBe('nombre: Zócalo')
      expect(w.emitted('apply')).toBeUndefined()
      await button(w, 'Aplicar al formulario').trigger('click')
      expect(w.emitted('apply')).toEqual([[{ nombre: 'Zócalo' }]])
      await w.get('textarea').setValue('nombre: corregido')
      expect(button(w, 'Aplicar al formulario').attributes('disabled')).toBeDefined()
      await button(w, 'Reinterpretar texto').trigger('click')
      await flushPromises()
      expect(catalogoCapturaService.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ texto: 'nombre: corregido', captura_origen: 1 }),
        expect.anything(),
      )
      w.unmount()
    },
  )
  it('conserva transcripción cuando no hay propuesta y permite corregir', async () => {
    mockResult('OTRO')
    vi.mocked(catalogoCapturaService.get).mockResolvedValue({
      id: 1,
      estado: 'ERROR',
      categoria: 'OTRO',
      texto_transcrito_original: 'texto original',
      propuesta: null,
      error_codigo: 'PIPELINE_ERROR',
    })
    const w = mount(CapturaCatalogo, { props: { categoria: 'OTRO' } })
    await w.get('textarea').setValue('texto')
    await button(w, 'Reinterpretar texto').trigger('click')
    await flushPromises()
    expect(w.get('textarea').element.value).toBe('texto original')
    expect(w.emitted('apply')).toBeUndefined()
    w.unmount()
  })
  it('cancela la espera y descarta respuestas tardías', async () => {
    mockResult('SILLA')
    vi.mocked(catalogoCapturaService.get).mockImplementation(() => new Promise(() => {}))
    const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
    await w.get('textarea').setValue('texto')
    await button(w, 'Reinterpretar texto').trigger('click')
    await flushPromises()
    await button(w, 'Cancelar procesamiento').trigger('click')
    expect(w.text()).not.toContain('Transcribiendo e interpretando')
    expect(w.emitted('apply')).toBeUndefined()
    w.unmount()
  })
  it('conserva campos manuales al rechazar confirmación y nunca guarda al aplicar', async () => {
    vi.spyOn(proformasService, 'families').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(proformasService, 'options').mockImplementation(async (key) =>
      key === 'CATEGORIA_PRODUCTO'
        ? [{ id: 10, codigo: 'OTRO', nombre: 'Otro', concepto_codigo: key }]
        : [],
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = mount(ProductoForm, {
      props: { preselectCategory: 'OTRO' },
      global: { stubs: { CapturaCatalogo: true } },
    })
    await flushPromises()
    const input = w.get('input[name="nombre"]')
    await input.setValue('Manual')
    w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('apply', { nombre: 'Propuesto' })
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect((input.element as HTMLInputElement).value).toBe('Manual')
    expect(w.emitted('save')).toBeUndefined()
    confirm.mockReturnValue(true)
    w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('apply', {
      nombre: 'Propuesto',
      sku: 'NO',
      stock: 99,
    })
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('Propuesto')
    expect(w.emitted('save')).toBeUndefined()
    expect((w.get('input[name="sku"]').element as HTMLInputElement).value).toBe('')
    w.unmount()
  })
})
