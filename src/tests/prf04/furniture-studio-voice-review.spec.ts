import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CapturaAsistida from '@/modules/proformas/components/CapturaAsistida.vue'
vi.mock('@/modules/capturas/audioLimits', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules/capturas/audioLimits')>()
  return { ...original, readAudioDuration: vi.fn<() => Promise<number>>().mockResolvedValue(30) }
})
import { asistidasService } from '@/modules/capturas/services/asistidasService'
import { captura24 } from '../fixtures/captura24'

afterEach(() => vi.restoreAllMocks())

describe('Furniture Studio: consentimiento antes de aplicar propuesta PRF04', () => {
  it('deja la interpretación como propuesta pendiente sin reemplazar directamente el mueble', async () => {
    const crear = vi.spyOn(asistidasService, 'create').mockResolvedValue({
      id: 24,
      estado: 'PENDIENTE',
      intento_id: 24,
      numero_intento: 1,
      reutilizada: false,
    })
    vi.spyOn(asistidasService, 'get').mockResolvedValue(captura24)
    const wrapper = mount(CapturaAsistida, {
      props: { dirty: true, reviewBeforeApply: true, sesion: crypto.randomUUID(), moneda: 'BOB' },
      global: { stubs: { AudioRecorder: true, Teleport: true } },
    })
    try {
      expect(wrapper.text()).toContain('Descripción por voz')
      expect(wrapper.text()).toContain(
        'Dicta nombre, medidas, materiales o características del mueble.',
      )
      expect(wrapper.text()).toContain('Revisar transcripción')
      expect(wrapper.text()).toContain('Corrige las palabras o códigos antes de aplicar los datos.')
      const transcript = wrapper.get('textarea#transcripcion-corregida')
      expect((transcript.element as HTMLTextAreaElement).value).toBe('')
      expect(wrapper.get('label[for="transcripcion-corregida"]').text()).toBe(
        'Transcripción / texto corregido',
      )
      expect(wrapper.find('details.voice-original').exists()).toBe(false)
      expect(
        wrapper
          .findAll('button')
          .find((b) => b.text().includes('Reinterpretar texto'))
          ?.attributes('disabled'),
      ).toBeDefined()
      const upload = wrapper
        .findAll('button')
        .find((button) => button.text().includes('Seleccionar archivo'))
      expect(upload).toBeDefined()
      await upload!.trigger('click')
      expect(wrapper.text()).not.toContain('reemplazará toda la información')
      const input = wrapper.get('input[type="file"]')
      expect(input.attributes('disabled')).toBeUndefined()
      const audio = new File(['audio'], 'mueble.wav', { type: 'audio/wav' })
      Object.defineProperty(input.element, 'files', { configurable: true, value: [audio] })
      await input.trigger('change')
      await flushPromises()
      expect(crear).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('proposed')).toHaveLength(1)
      expect(wrapper.emitted('applied')).toBeUndefined()
      expect(wrapper.text()).toContain(captura24.texto_transcrito_original)
      expect((wrapper.get('textarea#transcripcion-corregida').element as HTMLTextAreaElement).value).toBe(
        captura24.texto_transcrito_original,
      )
      expect(wrapper.find('details.voice-original').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
