import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StagedVoiceCapture from '@/modules/capturas/components/StagedVoiceCapture.vue'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { asistidasService } from '@/modules/capturas/services/asistidasService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { captura24 } from '../fixtures/captura24'
import { reviewProjection } from '@/modules/capturas/reviewProjection'

vi.mock('@/modules/capturas/audioLimits', async (original) => ({
  ...(await original<typeof import('@/modules/capturas/audioLimits')>()),
  readAudioDuration: vi.fn().mockResolvedValue(30),
}))
vi.mock('@/modules/capturas/audioConversion', () => ({
  prepareAudioForCapture: vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/wav' })),
}))
afterEach(() => vi.restoreAllMocks())

it.each(['una mesa', 'una mesa simple', 'tres escritorios blancos', 'un mueble de melamina'])(
  'allows partial text %s to be processed and applied',
  async (text) => {
    const create = vi.spyOn(asistidasService, 'create').mockResolvedValue({
      id: 24,
      estado: 'PENDIENTE',
      intento_id: 24,
      numero_intento: 1,
      reutilizada: false,
    })
    vi.spyOn(asistidasService, 'get')
      .mockResolvedValueOnce({
        ...captura24,
        solo_transcribir: true,
        propuesta_configurador: null,
        texto_transcrito_original: text,
      })
      .mockResolvedValueOnce(captura24)
    const wrapper = mount(StagedVoiceCapture, {
      props: { mode: 'furniture', sesion: crypto.randomUUID(), moneda: 'BOB' },
      global: { stubs: { AudioRecorder: true } },
    })
    try {
      const input = wrapper.get('input[type=file]')
      Object.defineProperty(input.element, 'files', {
        configurable: true,
        value: [new File(['audio'], 'voice.wav', { type: 'audio/wav' })],
      })
      await input.trigger('change')
      await flushPromises()
      expect(wrapper.get('textarea').element.value).toBe(text)
      expect(wrapper.text()).not.toContain('20 palabras')
      const apply = wrapper.findAll('button').find((b) => b.text().includes('Procesar y aplicar'))!
      expect(apply.attributes('disabled')).toBeUndefined()
      await apply.trigger('click')
      await flushPromises()
      expect(create).toHaveBeenCalledTimes(2)
      expect(create.mock.calls[1]![0]).toMatchObject({ texto: text })
      expect(wrapper.emitted('applied')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  },
)

it('keeps an inferred-unit suggestion pending until value and unit are explicitly entered', async () => {
  vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
    atributos: [],
    limites: { max_conjuntos: 10, max_componentes: 40 },
  })
  const wrapper = mount(EspecificacionForm, {
    props: {
      tipos: [],
      especificacion: {
        id: 0,
        proforma_detalle: 0,
        tipo_mueble: null,
        tipo_mueble_info: null,
        observaciones: null,
        datos_tecnicos: {},
      },
      pendientesAsistencia: [
        {
          codigo: 'MISSING_UNIT',
          ruta: 'dimensiones',
          mensaje: 'Unidad inferida: se propone 70 cm para alto; confirme valor y unidad.',
          resolucion: { tipo: 'DIMENSION', clave: 'alto' },
        },
      ],
    },
  })
  try {
    await flushPromises()
    expect(wrapper.get('aside').text()).toContain('Unidad inferida')
    expect((wrapper.get('input[name="alto"]').element as HTMLInputElement).value).toBe('')
    expect(
      (wrapper.get('select[aria-label="Unidad de alto"]').element as HTMLSelectElement).value,
    ).toBe('')
    await wrapper.get('input[name="alto"]').setValue('70')
    expect(wrapper.find('aside').exists()).toBe(true)
    await wrapper.get('select[aria-label="Unidad de alto"]').setValue('cm')
    expect(wrapper.find('aside').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})

it('preserves both explicit color roles through the existing legacy review projection', () => {
  const proposal = structuredClone(captura24.propuesta_configurador!)
  proposal.especificacion.datos_tecnicos = {
    caracteristicas_generales: {
      color_principal: 'wengué',
      color_secundario: 'negro',
      atributos: [
        { nombre: 'Color principal', valor: 'wengué' },
        { nombre: 'Color secundario', valor: 'negro' },
      ],
    },
  }
  const result = reviewProjection(proposal)
  expect(result.primaryColor).toBe('wengué')
  expect(result.secondaryColor).toBe('negro')
  expect(result.technical).toEqual(proposal.especificacion.datos_tecnicos)
})
