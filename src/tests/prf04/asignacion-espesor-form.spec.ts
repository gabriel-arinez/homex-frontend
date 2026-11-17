import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'

afterEach(() => vi.restoreAllMocks())

describe('PRF-04: resolución de espesor en el configurador', () => {
  it('requiere selección explícita y no sobrescribe espesores existentes', async () => {
    vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
      atributos: [],
      limites: { max_conjuntos: 10, max_componentes: 40 },
    })

    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [
          {
            id: 28537,
            codigo: 'MESA_REUNION',
            nombre: 'Mesa de reunión',
            concepto_codigo: 'TIPO_MUEBLE',
          },
        ],
        unidades: [
          {
            id: 10,
            codigo: 'PIEZA',
            nombre: 'Pieza',
            concepto_codigo: 'UNIDAD_MEDIDA',
          },
        ],
        moneda: 'BOB',
        voiceCaptureId: 7,
        especificacion: {
          id: 0,
          proforma_detalle: 0,
          tipo_mueble: 28537,
          tipo_mueble_info: null,
          datos_tecnicos: {
            componentes: [
              { uid: 'tablero', nombre: 'Tablero', espesor: '18 mm' },
              { uid: 'estructura', nombre: 'Estructura' },
            ],
            accesorios: [],
          },
          observaciones: 'Color a elección',
        },
        detalle: {
          nombre: 'Mesa de reunión para 10 personas',
          cantidad: '1',
          unidad: 10,
          precio_unitario: '100',
          descuento: '0.00',
        },
        pendientesAsistencia: [
          {
            codigo: 'ESPESOR_SIN_COMPONENTE',
            ruta: 'especificacion.datos_tecnicos.componentes',
            mensaje: 'El espesor 27 milímetros requiere asociación.',
            resolucion: {
              tipo: 'ESPESOR_SIN_COMPONENTE',
              valor: '27 mm',
            },
          },
        ],
      },
    })

    try {
      await flushPromises()

      const aviso = wrapper.get('aside[aria-label="Información pendiente"]')
      expect(aviso.text()).toContain('27 milímetros')

      await aviso.get('select').setValue('tablero')
      await aviso.get('button').trigger('click')

      const tablero = wrapper.get('input[name="componente-espesor-0"]').element as HTMLInputElement

      expect(tablero.value).toBe('18 mm')
      expect(wrapper.find('aside[aria-label="Información pendiente"]').exists()).toBe(true)

      await aviso.get('select').setValue('estructura')
      await aviso.get('button').trigger('click')

      const estructura = wrapper.get('input[name="componente-espesor-1"]')

      expect((estructura.element as HTMLInputElement).value).toBe('27 mm')
      expect(wrapper.find('aside[aria-label="Información pendiente"]').exists()).toBe(false)

      await estructura.setValue('25 mm')

      expect(wrapper.find('aside[aria-label="Información pendiente"]').exists()).toBe(true)
      const reopened = wrapper.get('aside[aria-label="Información pendiente"]')
      await reopened.get('select').setValue('estructura')
      const correction = reopened
        .findAll('button')
        .find((button) => button.text() === 'Confirmar corrección de espesor')!
      expect(correction).toBeDefined()
      await correction.trigger('click')
      expect(wrapper.find('aside[aria-label="Información pendiente"]').exists()).toBe(false)
      await wrapper.get('form').trigger('submit')
      const saved = wrapper.emitted('save')?.[0]?.[0] as {
        datos_tecnicos: { revision_humana_voz: Array<{ decisiones: unknown[] }> }
      }
      expect(saved.datos_tecnicos.revision_humana_voz[0]!.decisiones).toContainEqual(
        expect.objectContaining({
          review_id: 'pending:0',
          field: 'componentes.estructura.espesor',
          estado: 'corregido',
          valor_original: '27 mm',
          valor_final: '25 mm',
        }),
      )
      await estructura.setValue('27 mm')
      expect(wrapper.find('aside[aria-label="Información pendiente"]').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
