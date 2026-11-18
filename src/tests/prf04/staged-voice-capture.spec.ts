import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import CapturaCatalogo from '@/modules/productos/components/CapturaCatalogo.vue'
import CapturaAsistida from '@/modules/proformas/components/CapturaAsistida.vue'
const { create, get } = vi.hoisted(() => ({
  create: vi.fn<(data: Record<string, unknown>, signal: AbortSignal) => Promise<{ id: number }>>(),
  get: vi.fn<() => Promise<Record<string, unknown>>>(),
}))
vi.mock('@/modules/productos/services/catalogoCapturaService', () => ({
  catalogoCapturaService: { create, get },
}))
vi.mock('@/modules/capturas/services/asistidasService', () => ({
  asistidasService: { create, get },
}))
vi.mock('@/modules/capturas/audioLimits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/capturas/audioLimits')>()),
  readAudioDuration: vi.fn<() => Promise<number>>().mockResolvedValue(30),
}))
beforeEach(() => {
  vi.clearAllMocks()
  create.mockResolvedValue({ id: 1 })
})
it('catalog text is interpreted only explicitly and applied only after confirmation', async () => {
  get.mockResolvedValue({
    id: 1,
    estado: 'COMPLETADA',
    texto_transcrito_original:
      'silla plegable para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
    propuesta: {
      fields: {
        nombre:
          'Silla plegable para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
      },
      evidence: [],
      warnings: [],
    },
  })
  const wrapper = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  expect(wrapper.get('input[type=file]').attributes('aria-label')).toBe(
    'Archivo de audio para transcribir',
  )
  expect(create).not.toHaveBeenCalled()
  await wrapper
    .get('textarea')
    .setValue(
      'silla plegable para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
    )
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Procesar texto')!
    .trigger('click')
  await flushPromises()
  expect(create.mock.calls[0]![0].texto).toBe(
    'silla plegable para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
  )
  expect(wrapper.emitted('applied')).toBeUndefined()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Aplicar propuesta')!
    .trigger('click')
  expect(wrapper.emitted('applied')).toHaveLength(1)
  expect(wrapper.emitted('apply')).toBeUndefined()
  expect(wrapper.find('textarea').exists()).toBe(false)
})
it('furniture keeps abstained text editable without emitting an application', async () => {
  get.mockResolvedValue({
    id: 1,
    estado: 'COMPLETADA',
    resultado: 'NO_PROPOSAL',
    texto_transcrito_original: 'hola buenas '.repeat(15),
    propuesta_configurador: null,
    candidatos: [],
    pendientes: [],
  })
  const wrapper = mount(CapturaAsistida, { props: { dirty: false, sesion: 'test', moneda: 'BOB' } })
  await wrapper.get('textarea').setValue('hola buenas '.repeat(15))
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Procesar texto')!
    .trigger('click')
  await flushPromises()
  expect(wrapper.get('textarea').element.value).toBe('hola buenas '.repeat(15))
  expect(wrapper.text()).toContain('No se identificó')
  expect(wrapper.emitted('applied')).toBeUndefined()
  expect(wrapper.emitted('proposed')).toBeUndefined()
})

it('runs ASR alone, then NLP on corrected text linked to the original capture', async () => {
  get
    .mockResolvedValueOnce({
      id: 1,
      estado: 'COMPLETADA',
      solo_transcribir: true,
      texto_transcrito_original: 'silla precio 40',
      texto_asr_original: 'silla precio 40',
      propuesta: null,
    })
    .mockResolvedValueOnce({
      id: 2,
      estado: 'COMPLETADA',
      texto_transcrito_original:
        'silla precio 450 para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
      propuesta: { fields: { nombre: 'Silla', precio_lista: '450' }, evidence: [], warnings: [] },
    })
  const wrapper = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['audio'], 'silla.wav', { type: 'audio/wav' })],
  })
  await input.trigger('change')
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(1)
  expect(create.mock.calls[0]![0]).toMatchObject({ solo_transcribir: true })
  expect(wrapper.get('textarea').element.value).toBe('silla precio 40')
  expect(wrapper.emitted('applied')).toBeUndefined()
  await wrapper
    .get('textarea')
    .setValue(
      'silla precio 450 para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
    )
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Procesar texto')!
    .trigger('click')
  await flushPromises()
  expect(create.mock.calls[1]![0]).toMatchObject({
    texto:
      'silla precio 450 para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
    captura_origen: 1,
  })
  expect(create.mock.calls[1]![0].audio).toBeUndefined()
  expect(wrapper.text()).toContain('silla precio 40')
  expect(wrapper.emitted('applied')).toBeUndefined()
  wrapper.unmount()
})
it('ignores stale NLP responses after editing or cancellation', async () => {
  let finish!: (result: Record<string, unknown>) => void
  get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const wrapper = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  await wrapper
    .get('textarea')
    .setValue(
      'silla azul para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
    )
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Procesar texto')!
    .trigger('click')
  await flushPromises()
  await wrapper
    .get('textarea')
    .setValue(
      'silla roja para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
    )
  finish({
    id: 1,
    estado: 'COMPLETADA',
    propuesta: { fields: { nombre: 'Silla azul' }, evidence: [], warnings: [] },
  })
  await flushPromises()
  expect(wrapper.get('textarea').element.value).toBe(
    'silla roja para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
  )
  expect(wrapper.findAll('button').some((b) => b.text() === 'Aplicar propuesta')).toBe(false)
  expect(wrapper.emitted('applied')).toBeUndefined()
  wrapper.unmount()
})

it('keeps an over-limit ASR output intact and requires reduction before NLP', async () => {
  const long = 'silla '.repeat(501)
  get.mockResolvedValue({
    id: 1,
    estado: 'COMPLETADA',
    texto_transcrito_original: long,
    propuesta: null,
  })
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  const input = w.get('input[type=file]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['audio'], 'voice.wav', { type: 'audio/wav' })],
  })
  await input.trigger('change')
  await flushPromises()
  expect(w.get('textarea').element.value).toBe(long)
  expect(w.text()).toContain('3000')
  const process = () => w.findAll('button').find((b) => b.text() === 'Procesar texto')!
  expect(process().attributes('disabled')).toBeDefined()
  await w.get('textarea').setValue('silla '.repeat(500))
  expect(process().attributes('disabled')).toBeUndefined()
  expect(create).toHaveBeenCalledTimes(1)
  w.unmount()
})
it('rejects oversized paste or typing without deleting existing content and allows deletion', async () => {
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  const input = w.get('textarea')
  const valid = 'silla '.repeat(499) + 'silla!'
  expect(valid.length).toBe(3000)
  await input.setValue(valid)
  input.element.setSelectionRange(valid.length, valid.length)
  const paste = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(paste, 'clipboardData', { value: { getData: () => ' texto extra' } })
  input.element.dispatchEvent(paste)
  await flushPromises()
  expect(paste.defaultPrevented).toBe(true)
  expect(input.element.value).toBe(valid)
  await input.setValue(valid + '!')
  expect(input.element.value).toBe(valid)
  await input.setValue(valid.slice(0, -1))
  expect(input.element.value).toBe(valid.slice(0, -1))
  expect(w.text()).toContain('2999 / 3000')
  w.unmount()
})

it.each(['catalog', 'furniture'] as const)(
  '%s explicitly configures the commercial recorder minimum',
  async (mode) => {
    const recorder = defineComponent({
      props: ['minDurationSeconds'],
      setup(_, { expose }) {
        expose({ startRecording: async () => true, cancelRecording: () => undefined })
        return () => null
      },
    })
    const wrapper =
      mode === 'catalog'
        ? mount(CapturaCatalogo, {
            props: { categoria: 'SILLA' },
            global: { stubs: { AudioRecorder: recorder } },
          })
        : mount(CapturaAsistida, {
            props: { dirty: false, sesion: 'test', moneda: 'BOB' },
            global: { stubs: { AudioRecorder: recorder } },
          })
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Grabar descripción'))!
      .trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(recorder).props('minDurationSeconds')).toBe(15)
    expect(create).not.toHaveBeenCalled()
    wrapper.unmount()
  },
)
