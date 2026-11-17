import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import CapturaCatalogo from '@/modules/productos/components/CapturaCatalogo.vue'
import { readAudioDuration } from '@/modules/capturas/audioLimits'
const { create, get } = vi.hoisted(() => ({
  create: vi.fn<(data: Record<string, unknown>, signal: AbortSignal) => Promise<{ id: number }>>(),
  get: vi.fn<(id: number) => Promise<Record<string, unknown>>>(),
}))
vi.mock('@/modules/productos/services/catalogoCapturaService', () => ({
  catalogoCapturaService: { create, get },
}))
vi.mock('@/modules/capturas/audioLimits', async (original) => ({
  ...(await original<typeof import('@/modules/capturas/audioLimits')>()),
  readAudioDuration: vi.fn<() => Promise<number | null>>().mockResolvedValue(30),
}))
const proposal = (id: number, text: string) => ({
  id,
  estado: 'COMPLETADA',
  texto_transcrito_original: text,
  propuesta: { fields: { nombre: text }, evidence: [], warnings: [] },
})
const button = (w: ReturnType<typeof mount>, name: string) =>
  w.findAll('button').find((b) => b.text() === name)!
async function interpret(w: ReturnType<typeof mount>, text: string) {
  await w.get('textarea').setValue(text)
  await button(w, 'Procesar texto').trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(readAudioDuration).mockResolvedValue(30)
  create.mockResolvedValue({ id: 1 })
  get.mockResolvedValue(proposal(1, 'Silla plegable'))
})
it('links three successive corrected interpretations to one stable ASR origin', async () => {
  let id = 0
  create.mockImplementation(async () => ({ id: ++id }))
  get.mockImplementation(async (current) =>
    current === 1
      ? {
          id: 1,
          estado: 'COMPLETADA',
          solo_transcribir: true,
          propuesta: null,
          texto_transcrito_original: 'Silla original',
        }
      : proposal(current, `Silla ${current}`),
  )
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  const input = w.get('input[type=file]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['audio'], 'silla.wav', { type: 'audio/wav' })],
  })
  await input.trigger('change')
  await flushPromises()
  for (const text of ['Silla corregida uno', 'Silla corregida dos', 'Silla corregida tres'])
    await interpret(w, text)
  expect(create.mock.calls.slice(1).map((call) => call[0].captura_origen)).toEqual([1, 1, 1])
  expect(create.mock.calls.slice(1).map((call) => call[0].texto)).toEqual([
    'Silla corregida uno',
    'Silla corregida dos',
    'Silla corregida tres',
  ])
  expect(create.mock.calls.filter((call) => call[0].audio)).toHaveLength(1)
  expect(w.text()).toContain('Silla original')
  w.unmount()
})
it('invalidates a previous proposal immediately while a new microphone request is pending', async () => {
  let grant!: () => void
  const recorder = defineComponent({
    setup(_, { expose }) {
      expose({
        startRecording: () =>
          new Promise<boolean>((resolve) => {
            grant = () => resolve(true)
          }),
        cancelRecording: () => undefined,
      })
      return () => h('div')
    },
  })
  const w = mount(CapturaCatalogo, {
    props: { categoria: 'SILLA' },
    global: { stubs: { AudioRecorder: recorder } },
  })
  await interpret(w, 'Silla plegable')
  const oldApply = button(w, 'Aplicar propuesta')
  expect(oldApply).toBeDefined()
  await w.get('.source-record').trigger('click')
  await flushPromises()
  expect(button(w, 'Aplicar propuesta')).toBeUndefined()
  await oldApply.trigger('click')
  expect(w.emitted('applied')).toBeUndefined()
  await w.get('button[aria-label="Cancelar grabación"]').trigger('click')
  grant()
  await flushPromises()
  expect(button(w, 'Aplicar propuesta')).toBeUndefined()
  expect(w.get('textarea').element.value).toBe('Silla plegable')
  w.unmount()
})
it('invalidates on opening a new file chooser even when selection is cancelled', async () => {
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  await interpret(w, 'Silla plegable')
  await w.get('.voice-upload').trigger('click')
  expect(button(w, 'Aplicar propuesta')).toBeUndefined()
  expect(w.get('textarea').element.value).toBe('Silla plegable')
  expect(w.emitted('applied')).toBeUndefined()
  w.unmount()
})
it('does not apply an old proposal during slow file validation or after a failed replacement', async () => {
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  await interpret(w, 'Silla plegable')
  let validate!: (seconds: number) => void
  vi.mocked(readAudioDuration).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        validate = resolve
      }),
  )
  const input = w.get('input[type=file]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['audio'], 'nuevo.wav', { type: 'audio/wav' })],
  })
  await input.trigger('change')
  expect(button(w, 'Aplicar propuesta')).toBeUndefined()
  validate(301)
  await flushPromises()
  expect(button(w, 'Aplicar propuesta')).toBeUndefined()
  expect(w.get('textarea').element.value).toBe('Silla plegable')
  w.unmount()
})
it('does not let a cancelled ASR overwrite a newer audio transcript', async () => {
  let oldResponse!: (value: Record<string, unknown>) => void
  let id = 0
  create.mockImplementation(async () => ({ id: ++id }))
  get
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResponse = resolve
        }),
    )
    .mockResolvedValue({
      id: 2,
      estado: 'COMPLETADA',
      solo_transcribir: true,
      texto_transcrito_original: 'Audio nuevo',
      propuesta: null,
    })
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  const input = w.get('input[type=file]')
  const choose = async (name: string) => {
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['audio'], name, { type: 'audio/wav' })],
    })
    await input.trigger('change')
    await flushPromises()
  }
  await choose('primero.wav')
  await button(w, 'Cancelar').trigger('click')
  await choose('segundo.wav')
  expect(w.get('textarea').element.value).toBe('Audio nuevo')
  oldResponse({
    id: 1,
    estado: 'COMPLETADA',
    texto_transcrito_original: 'Audio antiguo',
    propuesta: null,
  })
  await flushPromises()
  expect(w.get('textarea').element.value).toBe('Audio nuevo')
  expect(w.text()).not.toContain('Audio antiguo')
  expect(w.emitted('applied')).toBeUndefined()
  w.unmount()
})
it('keeps an obtained ASR transcript editable after a terminal validation error without losing its origin', async () => {
  get
    .mockResolvedValueOnce({
      id: 7,
      estado: 'ERROR',
      error_codigo: 'TRANSCRIPT_TOO_LONG',
      texto_transcrito_original: 'Silla original extensa',
      texto_asr_original: 'Silla original extensa',
      propuesta: null,
    })
    .mockResolvedValue(proposal(8, 'Silla corregida'))
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  const input = w.get('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [new File(['audio'], 'voz.wav')] })
  await input.trigger('change')
  await flushPromises()
  expect(w.get('textarea').element.value).toBe('Silla original extensa')
  expect(button(w, 'Aplicar propuesta')).toBeUndefined()
  await interpret(w, 'Silla corregida')
  expect(create.mock.calls[1]![0].captura_origen).toBe(7)
  expect(create.mock.calls[1]![0].audio).toBeUndefined()
  w.unmount()
})
it('preserves the previous text-only lineage when no original ASR capture exists', async () => {
  let id = 0
  create.mockImplementation(async () => ({ id: ++id }))
  get.mockImplementation(async (current) => proposal(current, `Texto ${current}`))
  const w = mount(CapturaCatalogo, { props: { categoria: 'SILLA' } })
  for (const text of ['Silla uno', 'Silla dos', 'Silla tres']) await interpret(w, text)
  expect(create.mock.calls.map((call) => call[0].captura_origen)).toEqual([undefined, 1, 2])
  expect(create.mock.calls.every((call) => !call[0].audio)).toBe(true)
  w.unmount()
})
