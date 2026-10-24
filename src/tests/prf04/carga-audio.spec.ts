import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CapturaAsistida from '@/modules/proformas/components/CapturaAsistida.vue'
import { asistidasService } from '@/modules/capturas/services/asistidasService'

afterEach(() => vi.restoreAllMocks())

function montar(dirty = false) {
  return mount(CapturaAsistida, {
    props: {
      dirty,
      sesion: crypto.randomUUID(),
      moneda: 'BOB',
    },
    global: { stubs: { AudioRecorder: true, Teleport: true } },
  })
}

function seleccionar(wrapper: ReturnType<typeof montar>, archivo: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [archivo],
  })
  return input.trigger('change')
}

describe('PRF-04 carga de grabaciones', () => {
  it('admite M4A y obtiene una propuesta del mismo flujo', async () => {
    const crear = vi.spyOn(asistidasService, 'create').mockResolvedValue({
      id: 41,
      estado: 'PENDIENTE',
      intento_id: 41,
      numero_intento: 1,
      reutilizada: false,
    })

    vi.spyOn(asistidasService, 'get').mockResolvedValue({
      id: 41,
      estado: 'COMPLETADA',
      intento_id: 41,
      texto_transcrito_original: 'Un escritorio con mesón engrosado',
      resultado: 'REQUIRES_REVIEW',
      propuesta_configurador: {
        comercial: {
          nombre: 'Escritorio',
          cantidad: 1,
          unidad_codigo: 'PIEZA',
          precio_unitario: null,
          descuento: null,
        },
        especificacion: {
          tipo_mueble: null,
          observaciones: null,
          datos_tecnicos: {},
        },
        pendientes: [],
      },
      pendientes: [],
      version_proyeccion: 'PRF04_2',
      motor: null,
      error_codigo: null,
    })

    const wrapper = montar()

    try {
      await wrapper.get('button').trigger('click')
      const archivo = new File(['audio de prueba'], 'escritorio.m4a', {
        type: 'audio/mp4',
      })

      await seleccionar(wrapper, archivo)
      await flushPromises()

      expect(crear).toHaveBeenCalledWith(
        expect.objectContaining({ audio: archivo }),
        expect.anything(),
      )
      expect(wrapper.emitted('applied')).toHaveLength(1)
      expect(wrapper.text()).toContain('Un escritorio con mesón engrosado')
    } finally {
      wrapper.unmount()
    }
  })

  it('rechaza AAC directo y archivos vacíos', async () => {
    const crear = vi.spyOn(asistidasService, 'create')
    const wrapper = montar()

    try {
      await wrapper.get('button').trigger('click')

      await seleccionar(wrapper, new File(['audio'], 'escritorio.aac', { type: 'audio/aac' }))
      expect(wrapper.text()).toContain('Formato no admitido')

      await seleccionar(wrapper, new File([], 'vacio.m4a', { type: 'audio/mp4' }))
      expect(wrapper.text()).toContain('archivo de audio está vacío')
      expect(crear).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('mantiene la confirmación antes de reemplazar un mueble', async () => {
    const wrapper = montar(true)

    try {
      await wrapper.get('button').trigger('click')
      expect(wrapper.find('input[type="file"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('reemplazará toda la información')

      const continuar = wrapper
        .findAll('button')
        .find((button) => button.text() === 'Continuar con voz')
      expect(continuar).toBeDefined()
      await continuar!.trigger('click')
      expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
