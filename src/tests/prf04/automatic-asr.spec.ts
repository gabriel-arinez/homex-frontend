import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import StagedVoiceCapture from '@/modules/capturas/components/StagedVoiceCapture.vue'
const { create, get, prepare } = vi.hoisted(() => ({
  create: vi.fn<(data: Record<string, unknown>, signal: AbortSignal) => Promise<{ id: number }>>(),
  get: vi.fn<() => Promise<Record<string, unknown>>>(),
  prepare: vi.fn<(file: File) => Promise<Blob>>(),
}))
vi.mock('@/modules/productos/services/catalogoCapturaService', () => ({
  catalogoCapturaService: { create, get },
}))
vi.mock('@/modules/capturas/services/asistidasService', () => ({
  asistidasService: { create, get },
}))
vi.mock('@/modules/capturas/audioConversion', () => ({ prepareAudioForCapture: prepare }))
const button = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll('button').find((b) => b.text() === text)
const blob = new Blob(['valid audio'], { type: 'audio/wav' })
const recorder = defineComponent({
  emits: ['ready'],
  setup(_, { expose, emit }) {
    expose({
      startRecording: async () => true,
      stopRecording: () => emit('ready', blob),
      cancelRecording: () => undefined,
    })
    return () => h('div')
  },
})
function setup(mode: 'catalog' | 'furniture') {
  return mount(StagedVoiceCapture, {
    props: { mode, categoria: 'SILLA', sesion: 'draft', moneda: 'BOB' },
    global: { stubs: { AudioRecorder: recorder } },
  })
}
async function upload(w: ReturnType<typeof mount>, name = 'valid.wav') {
  const input = w.get('input[type=file]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File(['audio'], name)],
  })
  await input.trigger('change')
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  create.mockResolvedValue({ id: 1 })
  prepare.mockResolvedValue(blob)
  get.mockResolvedValue({
    id: 1,
    estado: 'COMPLETADA',
    solo_transcribir: true,
    texto_transcrito_original: 'Silla plegable precio 40',
    propuesta: null,
  })
})
for (const mode of ['catalog', 'furniture'] as const) {
  it(`${mode}: a validated file automatically transcribes once, retaining playback without NLP or application`, async () => {
    const w = setup(mode)
    await upload(w)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]![0]).toMatchObject({ audio: blob, solo_transcribir: true })
    expect(w.get('textarea').element.value).toBe('Silla plegable precio 40')
    expect(w.find('audio').exists()).toBe(true)
    expect(button(w, 'Transcribir audio')).toBeUndefined()
    expect(button(w, 'Aplicar propuesta')).toBeUndefined()
    expect(w.emitted('applied')).toBeUndefined()
    await w
      .get('textarea')
      .setValue(
        'Silla plegable precio 450 para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
      )
    expect(create).toHaveBeenCalledTimes(1)
    await button(w, 'Procesar texto')!.trigger('click')
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1]![0]).toMatchObject({
      texto:
        'Silla plegable precio 450 para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
      captura_origen: 1,
    })
    expect(create.mock.calls[1]![0].audio).toBeUndefined()
    w.unmount()
  })
  it(`${mode}: finishing a recording automatically starts ASR without a confirmation step`, async () => {
    const w = setup(mode)
    await w.get('.source-record').trigger('click')
    await flushPromises()
    const active = w.findComponent(recorder)
    active.vm.$emit('ready', blob)
    active.vm.$emit('ready', blob)
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]![0].solo_transcribir).toBe(true)
    expect(w.get('textarea').element.value).toContain('Silla plegable')
    expect(w.emitted('applied')).toBeUndefined()
    w.unmount()
  })
}
it('a cancelled conversion cannot auto-submit after a newer valid file', async () => {
  let resolve!: (value: Blob) => void
  prepare.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const w = setup('catalog')
  await upload(w, 'old.wav')
  await button(w, 'Cancelar')!.trigger('click')
  await upload(w, 'new.wav')
  expect(create).toHaveBeenCalledTimes(1)
  resolve(new Blob(['stale']))
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(1)
  expect(w.get('textarea').element.value).toContain('Silla plegable')
  w.unmount()
})
it('an invalid file never starts ASR and keeps previous editable text', async () => {
  const w = setup('furniture')
  await w.get('textarea').setValue('Mesa de madera')
  prepare.mockRejectedValue(new Error('Audio incompatible'))
  await upload(w)
  expect(create).not.toHaveBeenCalled()
  expect(w.get('textarea').element.value).toBe('Mesa de madera')
  expect(w.text()).toContain('incompatible')
  w.unmount()
})
it('empty ASR stays retryable and never enables NLP or an application', async () => {
  get.mockResolvedValue({
    id: 1,
    estado: 'COMPLETADA',
    texto_transcrito_original: '',
    propuesta: null,
  })
  const w = setup('catalog')
  await upload(w)
  expect(create).toHaveBeenCalledTimes(1)
  expect(w.get('[role=alert]').text()).toContain('No se reconoció texto')
  expect(button(w, 'Reintentar transcripción')).toBeDefined()
  expect(button(w, 'Procesar texto')!.attributes('disabled')).toBeDefined()
  expect(w.emitted('applied')).toBeUndefined()
  w.unmount()
})
it('failed ASR is retried only explicitly, without duplicate auto-requests', async () => {
  create.mockRejectedValueOnce(new Error('ASR temporalmente no disponible'))
  const w = setup('furniture')
  await upload(w)
  expect(create).toHaveBeenCalledTimes(1)
  expect(w.text()).toContain('temporalmente no disponible')
  await button(w, 'Reintentar transcripción')!.trigger('click')
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(2)
  expect(create.mock.calls.every((call) => call[0].solo_transcribir === true)).toBe(true)
  expect(w.get('textarea').element.value).toContain('Silla plegable')
  expect(w.emitted('applied')).toBeUndefined()
  w.unmount()
})
it('an unavailable silence analyser does not prevent automatic ASR or audio playback', async () => {
  const original = window.AudioContext
  window.AudioContext = class {
    constructor() {
      throw new Error('AudioContext unavailable')
    }
  } as unknown as typeof AudioContext
  const w = setup('catalog')
  try {
    await upload(w)
    expect(create).toHaveBeenCalledTimes(1)
    expect(w.find('audio').exists()).toBe(true)
    expect(w.get('textarea').element.value).toContain('Silla plegable')
  } finally {
    window.AudioContext = original
    w.unmount()
  }
})
