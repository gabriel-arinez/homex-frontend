import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ValorCatalogoPublico } from '@/generated/api'
import DetalleForm from '@/modules/proformas/components/DetalleForm.vue'
import {
  totalEstimadoCompleto,
  totalEstimadoLinea,
} from '@/modules/proformas/services/presentacionComercial'

const opcion = (id: number, codigo: string, nombre: string) =>
  ({ id, codigo, nombre }) as ValorCatalogoPublico

function formulario(unidad = 'PIEZA') {
  return mount(DetalleForm, {
    props: {
      tipos: [opcion(10, 'MUEBLE_MEDIDA', 'Mueble a medida')],
      unidades: [opcion(1, unidad, unidad === 'M2' ? 'Metro cuadrado' : 'Pieza')],
      moneda: 'BOB',
    },
    global: { stubs: { ProductoSelector: true } },
  })
}

describe('PRF-01 fundamentos comerciales', () => {
  it.each(['', '0', '-1', 'precio'])(
    'rechaza precio unitario inválido %j sin agregar la línea',
    async (precio) => {
      const wrapper = formulario()
      await wrapper.get('#nombre-linea').setValue('Mesa')
      await wrapper.get('#precio-unitario').setValue(precio)
      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('save')).toBeUndefined()
      expect(wrapper.get('#precio-unitario').attributes('aria-invalid')).toBe('true')
      expect(wrapper.text()).toContain('El precio unitario debe ser mayor que cero')
    },
  )

  it('acepta descuento cero y M2 fraccional, pero exige enteros para PIEZA', async () => {
    const m2 = formulario('M2')
    await m2.get('#nombre-linea').setValue('Piso')
    await m2.get('#cantidad-linea').setValue('1.2500')
    await m2.get('#precio-unitario').setValue('120')
    await m2.get('#descuento-linea').setValue('0')
    await m2.get('form').trigger('submit')
    expect(m2.emitted('save')?.[0]?.[0]).toMatchObject({ cantidad: '1.2500', descuento: '0' })

    const pieza = formulario('PIEZA')
    await pieza.get('#nombre-linea').setValue('Silla')
    await pieza.get('#cantidad-linea').setValue('1.5')
    await pieza.get('#precio-unitario').setValue('100')
    await pieza.get('form').trigger('submit')
    expect(pieza.emitted('save')).toBeUndefined()
    expect(pieza.text()).toContain('Esta unidad requiere una cantidad entera')
  })

  it('distingue precio pendiente, descuento cero y total negociado histórico', () => {
    expect(
      totalEstimadoLinea({ modo_calculo: 'PRECIO_UNITARIO', cantidad: '2', precio_unitario: '' }),
    ).toBeNull()
    expect(
      totalEstimadoLinea({
        modo_calculo: 'PRECIO_UNITARIO',
        cantidad: '2',
        precio_unitario: '50',
        descuento: '0',
      }),
    ).toBe(100)
    expect(
      totalEstimadoLinea({
        modo_calculo: 'TOTAL_NEGOCIADO',
        cantidad: '3',
        precio_unitario: '33.33',
        importe_negociado: '100',
        descuento: '0',
      }),
    ).toBe(100)
    expect(
      totalEstimadoCompleto([
        { modo_calculo: 'PRECIO_UNITARIO', cantidad: '1', precio_unitario: '50' },
        { modo_calculo: 'PRECIO_UNITARIO', cantidad: '1', precio_unitario: '' },
      ]),
    ).toBeNull()
  })
})
