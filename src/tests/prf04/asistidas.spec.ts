import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('@/modules/capturas/audioLimits', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules/capturas/audioLimits')>()
  return { ...original, readAudioDuration: vi.fn<() => Promise<number>>().mockResolvedValue(30) }
})
import type {
  PropuestaConfigurador,
  ResultadoAsistida,
  ValorCatalogoPublico,
} from '@/generated/api'
import { mapearCapturaAsistida } from '@/modules/proformas/services/capturaAsistidaMapper'
import CapturaAsistida from '@/modules/proformas/components/CapturaAsistida.vue'
import { asistidasService } from '@/modules/capturas/services/asistidasService'

const tipos = [{ id: 1, codigo: 'MUEBLE_MEDIDA' }] as ValorCatalogoPublico[]
const unidades = [
  { id: 10, codigo: 'PIEZA' },
  { id: 11, codigo: 'JUEGO' },
] as ValorCatalogoPublico[]
function propuesta(): PropuestaConfigurador {
  return {
    comercial: {
      nombre: 'Velador',
      cantidad: 6,
      unidad_codigo: 'PIEZA',
      precio_unitario: null,
      descuento: null,
    },
    especificacion: {
      tipo_mueble: null,
      observaciones: null,
      datos_tecnicos: {
        componentes: [{ uid: 'p1', nombre: 'cajones', cantidad_interna: 2 }],
        descripcion_original: 'seis veladores de dos cajones',
      },
    },
    pendientes: [],
  }
}
describe('PRF-04 proyección del servidor', () => {
  it('conserva cantidades por ámbito y no inventa precio', () => {
    const line = mapearCapturaAsistida(propuesta(), tipos, unidades)
    expect(line.cantidad).toBe('6')
    expect(line.precio_unitario).toBe('')
    expect(line.especificacion?.datos_tecnicos).toMatchObject({
      componentes: [{ cantidad_interna: 2 }],
    })
    expect(line).not.toHaveProperty('id')
  })
  it('no convierte un descuento desconocido en cero para repartir un total', () => {
    const p = propuesta()
    p.pendientes = [
      { codigo: 'TOTAL_NEGOCIADO', ruta: 'comercial.precio_unitario', mensaje: 'Total pendiente' },
    ]
    expect(mapearCapturaAsistida(p, tipos, unidades).descuento).toBe('')
    p.comercial.descuento = '0.00'
    expect(mapearCapturaAsistida(p, tipos, unidades).descuento).toBe('0.00')
  })
  it('usa ID real de JUEGO y clona datos técnicos', () => {
    const p = propuesta()
    p.comercial.unidad_codigo = 'JUEGO'
    const line = mapearCapturaAsistida(p, tipos, unidades)
    expect(line.unidad).toBe(11)
    expect(line.especificacion?.datos_tecnicos).not.toBe(p.especificacion.datos_tecnicos)
  })
  it('rechaza contratos incompatibles y referencias ausentes', () => {
    const p = propuesta()
    p.especificacion.datos_tecnicos = { schema_version: '1' }
    expect(() => mapearCapturaAsistida(p, tipos, unidades)).toThrow(
      'La propuesta técnica no es compatible',
    )
    expect(() => mapearCapturaAsistida(propuesta(), [], unidades)).toThrow('Faltan referencias')
  })
})
describe('PRF-04 confirmación del reemplazo', () => {
  it('no procesa ni aplica cambios existentes mientras no se haya transcrito audio', async () => {
    const wrapper = mount(CapturaAsistida, {
      props: { dirty: true, sesion: crypto.randomUUID(), moneda: 'BOB' },
    })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.emitted('applied')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('PRF-04 aplicación de capturas por voz', () => {
  it('aplica la propuesta del ASR aislando los contextos de borrador', async () => {
    let siguienteId = 0
    vi.spyOn(asistidasService, 'create').mockImplementation(async () => ({
      id: ++siguienteId,
      estado: 'PENDIENTE',
      intento_id: siguienteId,
      numero_intento: 1,
      reutilizada: false,
    }))
    vi.spyOn(asistidasService, 'get').mockImplementation(async (id) => {
      const resultado: ResultadoAsistida = {
        id,
        estado: 'COMPLETADA',
        intento_id: id,
        candidatos: [],
        advertencias: [],
        solo_transcribir: false,
        captura_origen: null,
        texto_asr_original: null,
        texto_corregido: null,
        texto_transcrito_original:
          'Un escritorio con cajones para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
        resultado: 'REQUIRES_REVIEW',
        propuesta_configurador: propuesta(),
        pendientes: [],
        version_proyeccion: 'PRF04_2',
        motor: null,
        error_codigo: null,
      }
      return resultado
    })
    const wrapper = mount(CapturaAsistida, {
      props: { dirty: false, sesion: crypto.randomUUID(), moneda: 'BOB' },
      global: { stubs: { AudioRecorder: true, Teleport: true } },
    })
    try {
      const input = wrapper.get('input[type="file"]')
      Object.defineProperty(input.element, 'files', {
        value: [new File(['audio'], 'escritorio.wav', { type: 'audio/wav' })],
      })
      await input.trigger('change')
      await flushPromises()
      await wrapper
        .get('textarea')
        .setValue(
          'Un escritorio con cajones para oficina con respaldo asiento patas base acabado material medidas cantidad precio marca modelo unidad diseño color entrega',
        )
      await wrapper
        .findAll('button')
        .find((b) => b.text().includes('Procesar y aplicar'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.emitted('applied')).toHaveLength(1)
    } finally {
      wrapper.unmount()
      vi.restoreAllMocks()
    }
  })
})
