import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Producto, ValorCatalogoPublico } from '@/generated/api'
import DetalleForm from '@/modules/proformas/components/DetalleForm.vue'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import ProductoSelector from '@/modules/proformas/components/ProductoSelector.vue'

const opcion = (id: number, codigo: string, nombre: string) =>
  ({ id, codigo, nombre }) as ValorCatalogoPublico

describe('AP6 correcciones funcionales', () => {
  it('sincroniza y bloquea la unidad de una variante física del catálogo', async () => {
    const wrapper = mount(DetalleForm, {
      props: {
        tipos: [opcion(10, 'PISO_FLOTANTE', 'Piso')],
        unidades: [opcion(1, 'PIEZA', 'Pieza'), opcion(2, 'M2', 'Metro cuadrado')],
        moneda: 'BOB',
      },
      global: { stubs: { ProductoSelector: true } },
    })
    const selector = wrapper.findComponent(ProductoSelector)
    const piso = {
      id: 77,
      nombre: 'Piso nogal',
      precio_vigente: '125.00',
      unidad_stock: 2,
    } as Producto
    selector.vm.$emit('update:modelValue', '77')
    selector.vm.$emit('select', piso)
    await wrapper.vm.$nextTick()

    const unidad = wrapper.get('#unidad-linea')
    expect((unidad.element as HTMLSelectElement).value).toBe('2')
    expect((unidad.element as HTMLSelectElement).disabled).toBe(true)
    await wrapper.get('#cantidad-linea').setValue('1.5000')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      producto: 77,
      unidad: 2,
      cantidad: '1.5000',
      precio_unitario: '125.00',
    })
  })

  it('registra fichas V2 por componente sin mezclar materiales ni inventar atributos', async () => {
    const wrapper = mount(EspecificacionForm, {
      props: { tipos: [opcion(5, 'ESCRITORIO', 'Escritorio')] },
    })
    await wrapper.get('#componente-nombre-0').setValue('Mesón')
    await wrapper.get('#componente-material-0').setValue('Melamina')
    await wrapper.get('#componente-espesor-0').setValue('25 mm')
    await wrapper.get('#componente-color-0').setValue('Nogal')
    await wrapper.get('#texto-original').setValue('Escritorio con cajonera a elección')
    await wrapper.get('#accesorios').setValue('Pasacables incorporado')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Agregar componente')!
      .trigger('click')
    await wrapper.get('#componente-nombre-1').setValue('Estructura')
    await wrapper.get('#componente-espesor-1').setValue('18 mm')
    await wrapper.get('#componente-color-1').setValue('Blanco')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      schema_version: 2,
      texto_original: 'Escritorio con cajonera a elección',
      accesorios: ['Pasacables incorporado'],
      componentes: [
        { nombre: 'Mesón', material: 'Melamina', espesor: '25 mm', color: 'Nogal' },
        { nombre: 'Estructura', espesor: '18 mm', color: 'Blanco' },
      ],
    })
  })
})
