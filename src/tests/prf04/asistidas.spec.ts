import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
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
  it('con cambios pide un único modal y cancelar no aplica ni procesa', async () => {
    const wrapper = mount(CapturaAsistida, {
      props: { dirty: true, sesion: crypto.randomUUID(), moneda: 'BOB' },
      global: { stubs: { Teleport: true, AudioRecorder: true } },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('reemplazará toda la información')
    const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancelar')!
    await cancel.trigger('click')
    expect(wrapper.emitted('applied')).toBeUndefined()
    expect(wrapper.text()).not.toContain('reemplazará toda la información')
    wrapper.unmount()
  })
  it('sin cambios permite grabar sin modal', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const wrapper = mount(CapturaAsistida, {
      props: { dirty: false, sesion: crypto.randomUUID(), moneda: 'BOB' },
      global: { stubs: { AudioRecorder: true, Teleport: true } },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.findComponent({ name: 'AudioRecorder' }).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('reemplazará toda la información')
    wrapper.unmount()
    vi.unstubAllGlobals()
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
        texto_transcrito_original: 'Un escritorio con cajones',
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
      await wrapper.get('button').trigger('click')
      wrapper.findComponent({ name: 'AudioRecorder' }).vm.$emit('ready', new Blob(['audio']))
      await flushPromises()
      expect(wrapper.emitted('applied')).toHaveLength(1)
    } finally {
      wrapper.unmount()
      vi.restoreAllMocks()
    }
  })
})
