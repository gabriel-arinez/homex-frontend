import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import CapturaCatalogo from '@/modules/productos/components/CapturaCatalogo.vue'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'
import { catalogoCapturaService } from '@/modules/productos/services/catalogoCapturaService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import type { CategoriaEnum } from '@/generated/api'
import { readAudioDuration } from '@/modules/capturas/audioLimits'

vi.mock('@/modules/capturas/audioLimits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/capturas/audioLimits')>()
  return { ...actual, readAudioDuration: vi.fn<() => Promise<number>>().mockResolvedValue(10) }
})

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
  it('detener la grabación lanza la transcripción automáticamente sin pasos extra', async () => {
    mockResult('SILLA')
    const audioRecorder = defineComponent({
      emits: ['ready'],
      setup(_, { emit, expose }) {
        expose({
          startRecording: async () => true,
          stopRecording: () => emit('ready', new Blob(['audio'], { type: 'audio/webm' })),
          getError: () => '',
        })
        return () => h('div', { class: 'fake-recorder' })
      },
    })
    const w = mount(CapturaCatalogo, {
      props: { categoria: 'SILLA' },
      global: { stubs: { AudioRecorder: audioRecorder } },
    })
    await w.get('.source-record').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Finalizar grabación')
    await w.get('.source-record').trigger('click')
    await flushPromises()
    expect(catalogoCapturaService.create).toHaveBeenCalledTimes(1)
    expect(catalogoCapturaService.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoria: 'SILLA', audio: expect.any(Blob) }),
      expect.anything(),
    )
    expect(w.text()).toContain('Campos detectados')
    w.unmount()
  })

  it('impide subir archivos de más de 20 MB y audios superiores a 5 minutos', async () => {
    mockResult('SILLA')
    const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['x'], 'demasiado.wav', { type: 'audio/wav' })],
    })
    vi.mocked(readAudioDuration).mockResolvedValueOnce(301)
    await input.trigger('change')
    await flushPromises()
    expect(w.text()).toContain('supera los 5 minutos')
    expect(catalogoCapturaService.create).not.toHaveBeenCalled()
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([new Uint8Array(20_000_001)], 'grande.wav', { type: 'audio/wav' })],
    })
    await input.trigger('change')
    await flushPromises()
    expect(w.text()).toContain('supera el límite de 20 MB')
    expect(catalogoCapturaService.create).not.toHaveBeenCalled()
    w.unmount()
  })

  it('conserva la transcripción y grabación al minimizar y reabrir el asistente', async () => {
    vi.spyOn(proformasService, 'families').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(proformasService, 'options').mockImplementation(async (code: string) =>
      code === 'CATEGORIA_PRODUCTO'
        ? [{ id: 1, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: code }]
        : code === 'UNIDAD_MEDIDA'
          ? [{ id: 2, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: code }]
          : [],
    )
    const w = mount(ProductoForm, {
      props: { preselectCategory: 'SILLA' },
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()
    await w.get('.voice-trigger').trigger('click')
    const assistant = w.getComponent(CapturaCatalogo)
    assistant.vm.$emit('recording-state', true, false, 12)
    await flushPromises()
    await w.get('button[aria-label="Cerrar asistente de voz"]').trigger('click')
    expect(w.findComponent(CapturaCatalogo).exists()).toBe(true)
    expect(w.get('.voice-mini').text()).toContain('Grabación en curso')
    await w.get('.voice-mini').trigger('click')
    expect(w.get('.voice-backdrop').isVisible()).toBe(true)
    w.unmount()
  })

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
  it('revisa conflictos sin sobrescribir valores manuales y sin guardar automáticamente', async () => {
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
    const w = mount(ProductoForm, {
      props: { preselectCategory: 'OTRO' },
      global: { stubs: { CapturaCatalogo: true } },
    })
    await flushPromises()
    const input = w.get('input[name="nombre"]')
    await input.setValue('Manual')
    // La captura se monta sólo después de abrir el panel lateral.
    await button(w, 'Completar por voz').trigger('click')
    w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('apply', { nombre: 'Propuesto' })
    await flushPromises()
    const checkbox = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Reemplazar Nombre comercial"]',
    )
    expect(checkbox).not.toBeNull()
    expect((input.element as HTMLInputElement).value).toBe('Manual')
    expect(w.emitted('save')).toBeUndefined()
    const cancel = [...document.body.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Conservar valores actuales',
    )
    cancel?.click()
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('Manual')
    await button(w, 'Completar por voz').trigger('click')
    w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('apply', {
      nombre: 'Propuesto',
      sku: 'NO',
      stock: 99,
    })
    await flushPromises()
    const confirmCheck = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Reemplazar Nombre comercial"]',
    )
    confirmCheck?.click()
    const apply = [...document.body.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Aplicar selección',
    )
    apply?.click()
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('Propuesto')
    expect((w.get('input[name="sku"]').element as HTMLInputElement).value).toBe('')
    expect(w.emitted('save')).toBeUndefined()
    w.unmount()
  })
})

it('aplica color secundario desde un catálogo activo sólo cuando se acepta el conflicto', async () => {
  vi.spyOn(proformasService, 'families').mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  })
  vi.spyOn(proformasService, 'options').mockImplementation(async (key) =>
    key === 'CATEGORIA_PRODUCTO'
      ? [{ id: 10, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: key }]
      : key === 'COLOR'
        ? [
            { id: 11, codigo: 'NEGRO', nombre: 'Negro', concepto_codigo: key },
            { id: 12, codigo: 'AZUL', nombre: 'Azul', concepto_codigo: key },
          ]
        : [],
  )
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'SILLA' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('select[name="color2"]').setValue('11')
  await button(w, 'Completar por voz').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('apply', { color_secundario: 12 })
  await flushPromises()
  expect((w.get('select[name="color2"]').element as HTMLSelectElement).value).toBe('11')
  const checkbox = document.body.querySelector<HTMLInputElement>(
    'input[aria-label="Reemplazar Color secundario"]',
  )
  expect(checkbox).not.toBeNull()
  checkbox?.click()
  const apply = [...document.body.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === 'Aplicar selección',
  )
  apply?.click()
  await flushPromises()
  expect((w.get('select[name="color2"]').element as HTMLSelectElement).value).toBe('12')
  await button(w, 'Completar por voz').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('apply', { color_secundario: 999 })
  await flushPromises()
  expect((w.get('select[name="color2"]').element as HTMLSelectElement).value).toBe('12')
  expect(w.emitted('save')).toBeUndefined()
  w.unmount()
})
