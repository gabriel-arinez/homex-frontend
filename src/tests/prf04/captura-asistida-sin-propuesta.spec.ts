import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CapturaAsistida from '@/modules/proformas/components/CapturaAsistida.vue'
vi.mock('@/modules/capturas/audioLimits', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules/capturas/audioLimits')>()
  return { ...original, readAudioDuration: vi.fn<() => Promise<number>>().mockResolvedValue(30) }
})
import { asistidasService } from '@/modules/capturas/services/asistidasService'

vi.mock('@/modules/capturas/services/asistidasService', () => ({
  asistidasService: {
    create: vi.fn<() => Promise<unknown>>(),
    get: vi.fn<() => Promise<unknown>>(),
  },
}))

async function enviarArchivo() {
  const wrapper = mount(CapturaAsistida, {
    props: { dirty: false, sesion: 'piloto-v13', moneda: 'BOB' },
    global: { stubs: { AudioRecorder: true, Modal: true } },
  })
  await wrapper
    .get('textarea')
    .setValue(
      'Un escritorio para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
    )
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Procesar texto')!
    .trigger('click')
  await flushPromises()
  return wrapper
}

describe('PRF-04 transcripción visible tras respuesta terminal NLP', () => {
  beforeEach(() => {
    vi.mocked(asistidasService.create).mockReset()
    vi.mocked(asistidasService.get).mockReset()
    vi.mocked(asistidasService.create).mockResolvedValue({ id: 50 } as never)
  })

  it('muestra aviso tras NO_PROPOSAL pero no reemplaza el mueble', async () => {
    vi.mocked(asistidasService.get).mockResolvedValue({
      id: 50,
      estado: 'COMPLETADA',
      pendientes: [],
      resultado: 'NO_PROPOSAL',
      texto_transcrito_original: 'Necesito un atril con una puerta',
      propuesta_configurador: null,
      version_proyeccion: null,
    } as never)
    const wrapper = await enviarArchivo()
    expect(wrapper.text()).toContain('No se identificó una propuesta comercial')
    expect(wrapper.emitted('applied')).toBeUndefined()
    wrapper.unmount()
  })

  it('aplica la propuesta únicamente cuando requiere revisión y tiene versión válida', async () => {
    vi.mocked(asistidasService.get).mockResolvedValue({
      id: 50,
      estado: 'COMPLETADA',
      pendientes: [],
      resultado: 'REQUIRES_REVIEW',
      texto_transcrito_original:
        'Un escritorio para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
      propuesta_configurador: { comercial: { nombre: 'Escritorio' } },
      version_proyeccion: 'PRF04_2',
    } as never)
    const wrapper = await enviarArchivo()
    expect(wrapper.emitted('applied')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Aplicar propuesta')!
      .trigger('click')
    expect(wrapper.emitted('applied')).toHaveLength(1)
    wrapper.unmount()
  })

  it('no aplica la proyección de una versión no compatible', async () => {
    vi.mocked(asistidasService.get).mockResolvedValue({
      id: 50,
      estado: 'COMPLETADA',
      pendientes: [],
      resultado: 'REQUIRES_REVIEW',
      texto_transcrito_original:
        'Un escritorio para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
      propuesta_configurador: { comercial: { nombre: 'Escritorio' } },
      version_proyeccion: 'PRF04_1',
    } as never)
    const wrapper = await enviarArchivo()
    expect(wrapper.emitted('applied')).toBeUndefined()
    wrapper.unmount()
  })
})
