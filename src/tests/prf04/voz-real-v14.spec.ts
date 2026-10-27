import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { captura24 } from '../fixtures/captura24'

afterEach(() => vi.restoreAllMocks())

describe('voz real v14, contrato PRF04_2', () => {
  it('mantiene ancho sin unidad aunque el alto tenga centímetros', async () => {
    vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
      atributos: [],
      limites: { max_conjuntos: 10, max_componentes: 40 },
    })
    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [],
        pendientesAsistencia: captura24.pendientes,
        especificacion: {
          id: 0,
          proforma_detalle: 0,
          tipo_mueble_info: null,
          datos_tecnicos: {
            descripcion_original: 'Quiero un escritorio de 120 de ancho y 75 centímetros de alto',
            caracteristicas_generales: { dimensiones: { alto: { valor: '75', unidad: 'cm' } } },
            componentes: [],
          },
        },
      },
    })
    try {
      await flushPromises()
      expect(
        (wrapper.get('select[aria-label="Unidad de ancho"]').element as HTMLSelectElement).value,
      ).toBe('')
      expect((wrapper.get('input[name="alto"]').element as HTMLInputElement).value).toBe('75')
      expect(wrapper.get('aside').text()).toContain('unidad del ancho')
    } finally {
      wrapper.unmount()
    }
  })

  it('exige asociación explícita de 18 mm y no fabrica tapa ni espesor en cajones', async () => {
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
          tipo_mueble_info: null,
          datos_tecnicos: {
            descripcion_original:
              'Necesito un escritorio de melamine a blanca de 120 centímetros de ancho con 2 cajones y una etapa de 18 milímetros de espesor',
            caracteristicas_generales: { dimensiones: { ancho: { valor: '120', unidad: 'cm' } } },
            componentes: [{ uid: 'pieza-1', nombre: 'cajones', cantidad_interna: 2 }],
          },
        },
        pendientesAsistencia: [
          {
            codigo: 'ESPESOR_SIN_COMPONENTE',
            ruta: 'especificacion.datos_tecnicos.componentes',
            mensaje: 'El espesor 18 milímetros no tiene una pieza identificada de forma confiable.',
            resolucion: { tipo: 'ESPESOR_SIN_COMPONENTE', valor: '18 mm' },
          },
        ],
      },
    })
    try {
      await flushPromises()
      const aviso = wrapper.get('aside[aria-label="Información pendiente"]')
      expect(aviso.text()).toContain('18 milímetros')
      expect((aviso.get('select').element as HTMLSelectElement).value).toBe('')
      await aviso.get('button').trigger('click')
      expect(
        (wrapper.get('input[name="componente-espesor-0"]').element as HTMLInputElement).value,
      ).toBe('')
      expect(wrapper.findAll('input[name^="componente-espesor-"]')).toHaveLength(1)
      expect(wrapper.find('aside').exists()).toBe(true)
      await aviso.get('select').setValue('pieza-1')
      await aviso.get('button').trigger('click')
      expect(
        (wrapper.get('input[name="componente-espesor-0"]').element as HTMLInputElement).value,
      ).toBe('18 mm')
      expect(wrapper.find('aside').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
