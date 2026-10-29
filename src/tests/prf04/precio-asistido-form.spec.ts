import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'

const propsBase = (cantidad: string, precio_unitario = '', moneda: 'BOB' | 'USD' = 'BOB') => ({
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
  moneda,
  especificacion: {
    id: 0,
    proforma_detalle: 0,
    tipo_mueble: 28537,
    tipo_mueble_info: null,
    datos_tecnicos: { componentes: [], accesorios: [] },
    observaciones: null,
  },
  detalle: {
    nombre: 'Mesa de reunión para diez personas',
    cantidad,
    unidad: 10,
    precio_unitario,
    descuento: '0.00',
  },
  pendientesAsistencia: [
    {
      codigo: 'TOTAL_NEGOCIADO',
      ruta: 'comercial.precio_unitario',
      mensaje: 'El importe reconocido corresponde al total negociado de la línea.',
      total_negociado: '7300.00',
      moneda_codigo: 'BOB' as const,
    },
  ],
})

function precioVisible(wrapper: ReturnType<typeof mount>): string {
  return (wrapper.get('input[name="mueble-precio"]').element as HTMLInputElement).value
}

async function configurar(cantidad: string, precio_unitario = '', moneda: 'BOB' | 'USD' = 'BOB') {
  vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
    atributos: [],
    limites: { max_conjuntos: 10, max_componentes: 40 },
  })
  const wrapper = mount(EspecificacionForm, {
    props: propsBase(cantidad, precio_unitario, moneda),
  })
  await flushPromises()
  return wrapper
}

afterEach(() => vi.restoreAllMocks())

describe('PRF-04: confirmación comercial en el configurador', () => {
  it('completa automáticamente el precio unitario exacto, sin botón', async () => {
    const wrapper = await configurar('2')
    try {
      const panel = wrapper.get('aside[aria-label="Revisión de precio total dictado"]')
      expect(panel.text()).toContain('7300.00')
      expect(panel.text()).toContain('3650.00')
      expect(precioVisible(wrapper)).toBe('3650.00')
      expect(panel.find('button').exists()).toBe(false)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('save')?.[0]?.[1]).toEqual(
        expect.objectContaining({ cantidad: '2', precio_unitario: '3650.00' }),
      )
    } finally {
      wrapper.unmount()
    }
  })

  it('no inventa la cantidad: completa el unitario al ingresarla', async () => {
    const wrapper = await configurar('')
    try {
      expect(precioVisible(wrapper)).toBe('')
      await wrapper.get('input[name="mueble-cantidad"]').setValue('2')
      expect(precioVisible(wrapper)).toBe('3650.00')
      await wrapper.get('input[name="mueble-cantidad"]').setValue('1')
      expect(precioVisible(wrapper)).toBe('7300.00')
    } finally {
      wrapper.unmount()
    }
  })

  it('bloquea un importe distinto sin confirmación y revoca la confirmación al editar', async () => {
    const wrapper = await configurar('2', '3600.00')
    try {
      const panel = wrapper.get('aside[aria-label="Revisión de precio total dictado"]')
      const confirmacion = () => panel.get('input[type="checkbox"]')
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('save')).toBeUndefined()
      expect(wrapper.get('[role="alert"]').text()).toContain('Confirma la diferencia')

      await confirmacion().setValue(true)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('save')).toHaveLength(1)
      expect(wrapper.emitted('save')?.[0]?.[1]).toEqual(
        expect.objectContaining({ cantidad: '2', precio_unitario: '3600.00' }),
      )

      await wrapper.get('input[name="mueble-precio"]').setValue('3550.00')
      expect((confirmacion().element as HTMLInputElement).checked).toBe(false)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('save')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })
  it('la moneda de Condiciones gobierna el precio, sin conversión ni confirmación extra', async () => {
    const wrapper = await configurar('2', '', 'USD')
    try {
      const panel = wrapper.get('aside[aria-label="Revisión de precio total dictado"]')
      expect(precioVisible(wrapper)).toBe('3650.00')
      expect(panel.text()).toContain('7300.00 USD')
      expect(panel.text()).not.toContain('La moneda del total dictado no coincide')
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('save')).toHaveLength(1)
      await wrapper.setProps({ moneda: 'BOB' })
      await flushPromises()
      expect(precioVisible(wrapper)).toBe('3650.00')
      expect(panel.text()).toContain('7300.00 BOB')
    } finally {
      wrapper.unmount()
    }
  })

  it('conserva el precio corregido manualmente al variar cantidad', async () => {
    const wrapper = await configurar('2')
    try {
      await wrapper.get('input[name="mueble-precio"]').setValue('4000.00')
      await wrapper.get('input[name="mueble-cantidad"]').setValue('1')
      expect(precioVisible(wrapper)).toBe('4000.00')
    } finally {
      wrapper.unmount()
    }
  })
})

it('exige descuento explícito antes de derivar el unitario de un total', async () => {
  vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
    atributos: [],
    limites: { max_conjuntos: 10, max_componentes: 40 },
  })
  const props = propsBase('2')
  props.detalle.descuento = ''
  const wrapper = mount(EspecificacionForm, { props })
  try {
    await flushPromises()
    expect(precioVisible(wrapper)).toBe('')
    await wrapper.get('input[name="mueble-descuento"]').setValue('0.00')
    expect(precioVisible(wrapper)).toBe('3650.00')
  } finally {
    wrapper.unmount()
  }
})

it('no confirma un descuento desconocido aunque se acepte una diferencia de precio', async () => {
  vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
    atributos: [],
    limites: { max_conjuntos: 10, max_componentes: 40 },
  })
  const props = propsBase('2', '3600.00')
  props.detalle.descuento = ''
  const wrapper = mount(EspecificacionForm, { props })
  try {
    await flushPromises()
    await wrapper.get('aside input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('descuento')
  } finally {
    wrapper.unmount()
  }
})
