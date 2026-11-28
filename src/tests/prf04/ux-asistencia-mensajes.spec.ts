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
      dimensiones: {
        largo: { valor: '2.40', unidad: 'm' },
        ancho: { valor: '1.20', unidad: 'm' },
        alto: { valor: '0.80', unidad: 'm' },
      },
    },
    conjuntos: [],
    componentes: [
      { uid: 'c1', nombre: 'Tablero', material: 'melamina', espesor: '18 mm' },
      { uid: 'c2', nombre: 'mesón', espesor: '27 mm' },
    ],
    accesorios: ['Tapacanto de PVC', '2 tomacorrientes al centro'],
    descripcion_original: 'Mesa de reunión',
  },
  observaciones: null,
}

describe('EspecificacionForm — UX de mensajes y acciones de revisión', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('no muestra pendientes ni JSON cuando el dictado está limpio y muestra Datos completos', async () => {
    const wrapper = mount(EspecificacionForm, {
      props: {
        tipos: [],
        studio: true,
        activeSection: 'revision',
        especificacion: baseSpec,
        unidades: [{ id: 1, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
        detalle: {
          nombre: 'mesa de reunión para 10 personas',
          cantidad: '1',
          unidad: 1,
          precio_unitario: '7280.00',
          descuento: '0.00',
        },
        pendientesAsistencia: [],
      },
    })
    await flushPromises()
    expect(wrapper.find('.pending-summary').exists()).toBe(false)
    expect(wrapper.text()).toContain('Datos completos')
    wrapper.unmount()
  })

  it('usa etiquetas específicas y nunca muestra Revisar campo ni Datos completos con pendientes visibles', async () => {
    const pendientes: PendienteAsistida[] = [
      {
        codigo: 'TIPO_NO_RESUELTO',
        ruta: 'especificacion.tipo_mueble',
        mensaje: 'Seleccione el tipo de mueble.',
      },
      {
        codigo: 'SELECCION_COLOR',
        ruta: 'general.color',
        mensaje: 'Color a elección: selecciona o confirma el color cuando esté definido.',
        resolucion: { tipo: 'ATRIBUTO_GENERAL', clave: 'color' },
      },
      {
        codigo: 'ESPECIFICACION',
        ruta: 'especificacion.observaciones',
        mensaje: 'Detalle adicional detectado: «enchapada». Revísalo en Observaciones.',
        resolucion: { tipo: 'OBSERVACIONES' },
      },
      {
        codigo: 'AVISO_SIN_DESTINO',
        ruta: '',
        mensaje: 'Aviso informativo sin campo asociado.',
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
          nombre: 'mesa de reunión',
          cantidad: '1',
          unidad: 1,
          precio_unitario: '7280.00',
          descuento: '0.00',
        },
        pendientesAsistencia: pendientes,
      },
    })
    await flushPromises()

    const buttons = wrapper.findAll('.pending-card__footer button[type="button"]')
    const labels = buttons.map((b) => b.text().trim())
    expect(labels).toContain('Revisar tipo de mueble')
    expect(labels).toContain('Seleccionar color')
    expect(labels).toContain('Revisar observaciones')
    expect(labels.some((l) => l.includes('Revisar campo'))).toBe(false)

    // No debe mostrar "Datos completos" mientras haya pendientes visibles
    expect(wrapper.find('.review-hero__summary').text()).not.toContain('Datos completos')

    // Al pulsar "Revisar observaciones", pide navegar a 'accesorios'
    const obsBtn = buttons.find((b) => b.text().includes('Revisar observaciones'))!
    await obsBtn.trigger('click')
    expect(wrapper.emitted('requestSection')?.some((args) => args[0] === 'accesorios')).toBe(true)

    wrapper.unmount()
  })
})
