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
    solo_transcribir: false,
    captura_origen: null,
    texto_asr_original: null,
    texto_corregido: null,
    texto_transcrito_original: 'nombre: Zócalo',
    error_codigo: null,
    propuesta: {
      category,
      fields: { nombre: 'Zócalo' },
      warnings: ['Revisar'],
      evidence: [],
      unrecognized: [],
      version: 'catalog-0.1.21',
    },
  })
}

function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find((b) => b.text() === label)!
}

describe('Voz en creación de catálogo', () => {
  it.each(['SILLA', 'PISO_FLOTANTE', 'OTRO'] as const)(
    'sube audio, conserva categoría y revisa y confirma propuesta: %s',
    async (category) => {
      mockResult(category)
      const w = mount(CapturaCatalogo, { props: { categoria: category } })
      const file = new File(['audio'], 'homex.wav', { type: 'audio/wav' })
      const input = w.get('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file] })
      await input.trigger('change')
      await flushPromises()
      expect(catalogoCapturaService.create).not.toHaveBeenCalled()
      await button(w, 'Transcribir audio').trigger('click')
      await flushPromises()
      expect(catalogoCapturaService.create).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: category, audio: file }),
        expect.anything(),
      )
      expect(w.emitted('apply')).toBeUndefined()
      expect(w.emitted('applied')).toBeUndefined()
      await w.get('textarea').setValue('nombre: Zócalo')
      await button(w, 'Procesar texto').trigger('click')
      await flushPromises()
      await button(w, 'Aplicar propuesta').trigger('click')
      expect(w.emitted('applied')).toEqual([
        [
          {
            fields: { nombre: 'Zócalo' },
            text: 'nombre: Zócalo',
            warnings: ['Revisar'],
            evidence: [],
          },
        ],
      ])
      w.unmount()
    },
  )

  it('detener la grabación permite escuchar antes de transcribir', async () => {
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
    expect(w.findAll('.source-record')).toHaveLength(0)
    expect(w.text()).toContain('Finalizar')
    expect(w.text()).toContain('Pausar')
    expect(w.text()).toContain('Cancelar')
    await w.get('button[aria-label="Finalizar grabación"]').trigger('click')
    await flushPromises()
    expect(catalogoCapturaService.create).not.toHaveBeenCalled()
    await button(w, 'Transcribir audio').trigger('click')
    await flushPromises()
    expect(catalogoCapturaService.create).toHaveBeenCalledTimes(1)
    expect(catalogoCapturaService.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoria: 'SILLA', audio: expect.any(Blob) }),
      expect.anything(),
    )
    expect(w.emitted('apply')).toBeUndefined()
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
    expect(w.text()).toContain('supera 20 MB')
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
    await assistant.get('textarea').setValue('Silla plegable corregida')
    await flushPromises()
    await w.get('button[aria-label="Cerrar asistente de voz"]').trigger('click')
    expect(w.findComponent(CapturaCatalogo).exists()).toBe(true)
    await w.get('.voice-trigger').trigger('click')
    expect(assistant.get('textarea').element.value).toBe('Silla plegable corregida')
    expect(w.findComponent(CapturaCatalogo).exists()).toBe(true)
    w.unmount()
  })

  it('notifica error cuando el procesamiento falla y permite reintentar', async () => {
    mockResult('OTRO')
    vi.mocked(catalogoCapturaService.get).mockResolvedValue({
      id: 1,
      estado: 'ERROR',
      categoria: 'OTRO',
      solo_transcribir: false,
      captura_origen: null,
      texto_asr_original: null,
      texto_corregido: null,
      texto_transcrito_original: 'texto original',
      propuesta: null,
      error_codigo: 'PIPELINE_ERROR',
    })
    const w = mount(CapturaCatalogo, { props: { categoria: 'OTRO' } })
    const file = new File(['audio'], 'homex.wav', { type: 'audio/wav' })
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()
    await button(w, 'Transcribir audio').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('No se pudo procesar')
    expect(w.emitted('apply')).toBeUndefined()
    w.unmount()
  })

  it('cancela la espera del procesamiento en curso al pulsar cancelar', async () => {
    mockResult('SILLA')
    vi.mocked(catalogoCapturaService.get).mockImplementation(() => new Promise(() => {}))
    const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
    const file = new File(['audio'], 'homex.wav', { type: 'audio/wav' })
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()
    await button(w, 'Transcribir audio').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Transcribiendo audio')
    await button(w, 'Cancelar').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Transcribiendo audio')
    expect(w.emitted('apply')).toBeUndefined()
    w.unmount()
  })

  it('aplica propuesta de voz directamente al formulario y muestra transcripción conservada en la barra lateral', async () => {
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

    // Abrir asistente y emitir resultado con texto y warnings
    await button(w, 'Completar por voz').trigger('click')
    const assistant = w.findComponent({ name: 'CapturaCatalogo' })
    assistant.vm.$emit('applied', {
      fields: { nombre: 'Silla Ergonómica Pro', precio_lista: '4500.00' },
      text: 'Nombre Silla Ergonómica Pro precio 4500',
      warnings: ['Complete manualmente: SKU'],
    })
    await flushPromises()

    // Los datos se aplican de inmediato en los campos editables
    expect((w.get('input[name="nombre"]').element as HTMLInputElement).value).toBe(
      'Silla Ergonómica Pro',
    )
    expect((w.get('input[name="precio"]').element as HTMLInputElement).value).toBe('4500.00')

    // La barra lateral muestra la transcripción conservada y sus avisos
    expect(w.text()).not.toContain('Descripción original por voz')
    expect(w.text()).not.toContain('Nombre Silla Ergonómica Pro precio 4500')
    expect(w.text()).toContain('Sugerido por voz')
    expect(w.emitted('save')).toBeUndefined()
    w.unmount()
  })

  it('aplica color secundario y características de silla directamente sin bloqueos modales', async () => {
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

    await button(w, 'Completar por voz').trigger('click')
    const assistant = w.findComponent({ name: 'CapturaCatalogo' })
    assistant.vm.$emit('applied', {
      fields: {
        color_secundario: 12,
        especificaciones: { apoyo_lumbar: 'Ajustable', material_respaldo: 'Malla' },
      },
      text: 'Silla con color secundario azul y apoyo lumbar ajustable',
      warnings: [],
    })
    await flushPromises()

    expect((w.get('select[name="color2"]').element as HTMLSelectElement).value).toBe('12')
    expect(w.text()).toContain('Apoyo lumbar')
    expect(w.text()).toContain('Material del respaldo')
    w.unmount()
  })
})
