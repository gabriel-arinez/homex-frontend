import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import type { PendienteAsistida } from '@/generated/api'

vi.mock('@/api/http', () => ({
  api: {
    get: vi.fn<() => Promise<{ data: unknown[] }>>(async () => ({ data: [] })),
    post: vi.fn<() => Promise<{ data: Record<string, unknown> }>>(async () => ({ data: {} })),
  },
}))

const baseSpec = {
  id: 1,
  proforma_detalle: 1,
  tipo_mueble: null,
  tipo_mueble_info: null,
  datos_tecnicos: {
    caracteristicas_generales: {
      atributos: [{ nombre: 'Material', codigo: 'MATERIAL', valor: 'melamina' }],
    },
    conjuntos: [],
    componentes: [{ uid: 'c1', nombre: 'Tablero', material: 'melamina', espesor: '18 mm' }],
    accesorios: [],
    descripcion_original: 'Mesa en L',
  },
  observaciones: 'madera enchapada',
}

describe('EspecificacionForm — cierre residual UX y resolución individual', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resuelve múltiples OBSERVACIONES de forma individual sin cerrar los demás al confirmar o editar uno', async () => {
    const pendientes: PendienteAsistida[] = [
      {
        codigo: 'ESPECIFICACION',
        ruta: 'especificacion.observaciones',
        mensaje: 'Detalle adicional detectado: «madera enchapada». Revísalo en Observaciones.',
        resolucion: { tipo: 'OBSERVACIONES' },
      },
      {
        codigo: 'GEOMETRIA',
        ruta: 'especificacion.observaciones',
        mensaje: 'Mueble en L: confirma la orientación y los ejes de las medidas.',
        resolucion: { tipo: 'OBSERVACIONES' },
      },
      {
        codigo: 'RANGO_DIMENSIONAL',
        ruta: 'especificacion.observaciones',
        mensaje:
          'Rango de altura detectado (de 70 a 90 cm). Confirma la medida final en Observaciones.',
        resolucion: { tipo: 'OBSERVACIONES' },
      },
    ]
    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [],
        studio: true,
        activeSection: 'revision',
        especificacion: baseSpec,
        unidades: [{ id: 1, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
        detalle: {
          nombre: 'Mesa en L',
          cantidad: '1',
          unidad: 1,
          precio_unitario: '1500.00',
          descuento: '0.00',
        },
        pendientesAsistencia: pendientes,
      },
    })
    await flushPromises()

    expect(wrapper.findAll('.pending-card')).toHaveLength(3)
    const confirmBtns = wrapper.findAll('[data-testid="confirmar-observacion"]')
    expect(confirmBtns).toHaveLength(3)

    // Confirmar solo el primero no debe resolver el segundo ni el tercero
    await confirmBtns[0]!.trigger('click')
    expect(wrapper.findAll('.pending-card')).toHaveLength(2)
    wrapper.unmount()
  })

  it('exige revisión explícita de RECUPERACION_LEXICA aunque el campo ya tenga valor sugerido', async () => {
    const pendientes: PendienteAsistida[] = [
      {
        codigo: 'RECUPERACION_LEXICA',
        ruta: 'pieza-1.material',
        mensaje: 'Se interpretó «me lamina» como «melamina» en Tablero; confirma si es correcto.',
        resolucion: { tipo: 'COMPONENTE', uid: 'c1', campo: 'material' },
      },
    ]
    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [],
        studio: true,
        activeSection: 'revision',
        especificacion: baseSpec,
        unidades: [{ id: 1, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
        detalle: {
          nombre: 'Mesa',
          cantidad: '1',
          unidad: 1,
          precio_unitario: '1500.00',
          descuento: '0.00',
        },
        pendientesAsistencia: pendientes,
      },
    })
    await flushPromises()
    expect(wrapper.findAll('.pending-card')).toHaveLength(1)
    wrapper.unmount()
  })

  it('permite guardar con SELECCION_COLOR sin inventar color ni exigir descarte artificial', async () => {
    const pendientes: PendienteAsistida[] = [
      {
        codigo: 'SELECCION_COLOR',
        ruta: 'general.color',
        mensaje: 'Color a elección: selecciona o confirma el color cuando esté definido.',
        resolucion: { tipo: 'ATRIBUTO_GENERAL', clave: 'color' },
      },
    ]
    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [],
        studio: true,
        activeSection: 'revision',
        especificacion: baseSpec,
        unidades: [{ id: 1, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
        detalle: {
          nombre: 'Mesa',
          cantidad: '1',
          unidad: 1,
          precio_unitario: '1500.00',
          descuento: '0.00',
        },
        pendientesAsistencia: pendientes,
      },
    })
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeTruthy()
    wrapper.unmount()
  })

  it('filtra ROL_MATERIAL histórico sin ocultar observaciones reales', async () => {
    const pendientes: PendienteAsistida[] = [
      {
        codigo: 'ROL_MATERIAL',
        ruta: 'especificacion.observaciones',
        mensaje:
          'Clasificación de material inferida, no pronunciada: \'melamina\' → {"value": "melamina", "role": "coating_or_board_description"}. Confirme la interpretación.',
      },
    ]
    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [],
        studio: true,
        activeSection: 'revision',
        especificacion: baseSpec,
        unidades: [{ id: 1, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
        detalle: {
          nombre: 'Mesa',
          cantidad: '1',
          unidad: 1,
          precio_unitario: '1500.00',
          descuento: '0.00',
        },
        pendientesAsistencia: pendientes,
      },
    })
    await flushPromises()
    expect(wrapper.find('.pending-summary').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reinicia confirmacionesPendientes al cambiar la identidad de la captura aunque coincidan índices y valores', async () => {
    const pendientes: PendienteAsistida[] = [
      {
        codigo: 'ESPECIFICACION',
        ruta: 'especificacion.observaciones',
        mensaje: 'Detalle adicional detectado: «madera enchapada». Revísalo en Observaciones.',
        resolucion: { tipo: 'OBSERVACIONES' },
      },
    ]
    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [],
        studio: true,
        activeSection: 'revision',
        voiceCaptureId: 101,
        especificacion: baseSpec,
        unidades: [{ id: 1, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
        detalle: {
          nombre: 'Mesa',
          cantidad: '1',
          unidad: 1,
          precio_unitario: '1500.00',
          descuento: '0.00',
        },
        pendientesAsistencia: pendientes,
      },
    })
    await flushPromises()
    await wrapper.get('[data-testid="confirmar-observacion"]').trigger('click')
    expect(wrapper.findAll('.pending-card')).toHaveLength(0)

    await wrapper.setProps({
      voiceCaptureId: 202,
      pendientesAsistencia: structuredClone(pendientes),
    })
    await flushPromises()
    expect(wrapper.findAll('.pending-card')).toHaveLength(1)
    wrapper.unmount()
  })
})
