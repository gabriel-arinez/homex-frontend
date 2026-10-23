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
          cantidad: '',
          unidad: 10,
          precio_unitario: '',
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
    } finally {
      wrapper.unmount()
    }
  })
})
