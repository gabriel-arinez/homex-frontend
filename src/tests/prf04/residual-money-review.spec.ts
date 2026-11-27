import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'

afterEach(() => vi.restoreAllMocks())

it.each([
  ['500.00', 'confirmado'],
  ['550.00', 'corregido'],
])('requires explicit price validation and audits %s as %s', async (final, state) => {
  vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
    atributos: [],
    limites: { max_conjuntos: 10, max_componentes: 40 },
  })
  const wrapper = mount(EspecificacionForm, {
    props: {
      unidades: [{ id: 1, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' }],
      tipos: [],
      studio: true,
      activeSection: 'comercial',
      voiceCaptureId: 24,
      detalle: { nombre: 'Mesa', cantidad: '1', precio_unitario: '500.00', descuento: '0.00' },
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
          codigo: 'PRECIO_AMBIGUO',
          ruta: 'comercial.precio_unitario',
          mensaje: 'Importe sugerido por equivalencia; confirme modalidad.',
        },
      ],
    },
  })
  try {
    await flushPromises()
    expect(wrapper.text()).toContain('Importe sugerido')
    expect(wrapper.findAll('button').some((b) => b.text().includes('Validar'))).toBe(true)
    const input = wrapper.get('#mueble-precio')
    expect((input.element as HTMLInputElement).value).toBe('500.00')
    await input.setValue(final)
    expect(wrapper.text()).toContain('Importe sugerido')
    const vm = wrapper.vm as unknown as { submit: () => boolean }
    expect(vm.submit()).toBe(false)
    expect(wrapper.emitted('save')).toBeUndefined()
    const validate = wrapper.findAll('button').find((b) => b.text().includes('Validar'))!
    await validate.trigger('click')
    await flushPromises()
    const statuses = wrapper.emitted('voiceReviewChange')?.slice(-1)[0]?.[0] as Array<{
      state: string
    }>
    expect(statuses).toBeDefined()
    expect(JSON.stringify(statuses)).toContain('reviewed')
    expect(vm.submit()).toBe(true)
    const saved = wrapper.emitted('save')?.slice(-1)[0]?.[0]
    expect(JSON.stringify(saved)).toContain(`"estado":"${state}"`)
    expect(JSON.stringify(saved)).toContain('"valor_original":"500.00"')
    expect(JSON.stringify(saved)).toContain(`"valor_final":"${final}"`)
  } finally {
    wrapper.unmount()
  }
})
