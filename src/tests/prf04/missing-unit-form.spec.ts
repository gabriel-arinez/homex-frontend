import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { captura24 } from '../fixtures/captura24'

afterEach(() => vi.restoreAllMocks())
describe('PRF04 MISSING_UNIT contextual', () => {
  it.each([false, true])(
    'no filtra el pendiente por alto/profundidad completos (ancho ausente: %s)',
    async (ausente) => {
      vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
        atributos: [],
        limites: { max_conjuntos: 10, max_componentes: 40 },
      })
      const especificacion = structuredClone(captura24.propuesta_configurador!.especificacion)
      if (ausente)
        especificacion.datos_tecnicos = {
          caracteristicas_generales: {
            dimensiones: {
              alto: { valor: '75', unidad: 'cm' },
              profundidad: { valor: '60', unidad: 'cm' },
            },
          },
        }
      const wrapper = mount(EspecificacionForm, {
        attachTo: document.body,
        props: {
          tipos: [],
          pendientesAsistencia: captura24.pendientes,
          especificacion: { ...especificacion, id: 0, proforma_detalle: 0, tipo_mueble_info: null },
        },
      })
      await flushPromises()
      expect(wrapper.get('aside').text()).toContain('unidad del ancho')
      const unidad = wrapper.get('select[aria-label="Unidad de ancho"]')
      expect((unidad.element as HTMLSelectElement).value).toBe('')
      expect(unidad.attributes('aria-describedby')).toBe('pendiente-ancho')
      expect(wrapper.get('#pendiente-ancho').text()).toContain('Revisar ancho')
      await wrapper.get('aside button').trigger('click')
      expect(document.activeElement).toBe(unidad.element)
      await wrapper.get('input[name="ancho"]').setValue('120')
      expect(wrapper.find('aside').exists()).toBe(true)
      await unidad.setValue('cm')
      expect(wrapper.find('aside').exists()).toBe(false)
      expect(unidad.attributes('aria-invalid')).toBeUndefined()
      await unidad.setValue('')
      expect(wrapper.find('aside').exists()).toBe(true)
      wrapper.unmount()
    },
  )
})
