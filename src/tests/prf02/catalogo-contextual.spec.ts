import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import type { DetalleProforma, Producto, ValorCatalogoPublico } from '@/generated/api'
import DetalleForm from '@/modules/proformas/components/DetalleForm.vue'
import CatalogoContextual from '@/modules/proformas/components/CatalogoContextual.vue'

const silla = { id: 1, codigo: 'SILLA', nombre: 'Sillas' } as ValorCatalogoPublico
const sku = {
  id: 41,
  sku: 'SILLA-41',
  nombre: 'Silla de prueba',
  categoria: 1,
  categoria_info: silla,
  familia: null,
  familia_info: null,
  unidad_stock: 2,
  unidad_stock_info: { id: 2, nombre: 'Pieza', codigo: 'PIEZA' },
  precio_vigente: '120.00',
  stock: '5.0000',
  disponibilidad_referencial: '5.0000',
  imagen_principal: null,
} as unknown as Producto

describe('PRF-02 catálogo contextual', () => {
  it('resuelve una familia pendiente con variante compatible y conserva su negociación', async () => {
    let consulta = ''
    const variante = {
      ...sku,
      id: 73,
      familia: 6,
      categoria_info: silla,
      unidad_stock: 20,
      unidad_stock_info: { id: 20, codigo: 'PIEZA', nombre: 'Pieza' },
      precio_vigente: '400.00',
    } as Producto
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/', ({ request }) => {
        consulta = request.url
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [variante],
        })
      }),
    )
    const pendiente = {
      id: 88,
      tipo_item: 10,
      producto: null,
      familia_producto: 6,
      nombre: 'Silla negociada',
      descripcion: 'Respaldo solicitado por el cliente',
      cantidad: '2.0000',
      unidad: 20,
      modo_calculo: 'PRECIO_UNITARIO',
      precio_unitario: '150.00',
      importe_negociado: null,
      descuento: '20.00',
    } as unknown as DetalleProforma
    const wrapper = mount(DetalleForm, {
      props: {
        detail: pendiente,
        tipos: [{ id: 10, codigo: 'SILLA', nombre: 'Silla' } as ValorCatalogoPublico],
        categorias: [silla],
        unidades: [{ id: 20, codigo: 'PIEZA', nombre: 'Pieza' } as ValorCatalogoPublico],
        familias: [{ id: 6, codigo: 'FAMILIA-6', nombre: 'Sillas generales', activo: true }],
        moneda: 'BOB',
      },
    })
    await flushPromises()
    const params = new URL(consulta).searchParams
    expect(params.get('familia')).toBe('6')
    expect(params.get('categoria')).toBe('1')
    await wrapper.get('select[name="producto-linea"]').setValue('73')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      producto: 73,
      familia_producto: null,
      nombre: 'Silla negociada',
      descripcion: 'Respaldo solicitado por el cliente',
      cantidad: '2.0000',
      unidad: 20,
      precio_unitario: '150.00',
      descuento: '20.00',
    })
    wrapper.unmount()
  })

  it('consulta productos reales mediante API y no guarda proformas al seleccionar SKU', async () => {
    let lecturas = 0
    let escrituras = 0
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/', () => {
        lecturas += 1
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [sku],
        })
      }),
      http.post('http://localhost:8000/api/v1/proformas/integral/', () => {
        escrituras += 1
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    const wrapper = mount(CatalogoContextual, {
      props: { categorias: [silla], familias: [], existingProductIds: [] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('SILLA-41')
    const seleccionar = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Seleccionar para cotizar'))
    expect(seleccionar).toBeDefined()
    await seleccionar!.trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 41 })
    expect(lecturas).toBeGreaterThan(0)
    expect(escrituras).toBe(0)
    wrapper.unmount()
  })

  it('redirige el SKU repetido a la línea existente sin incorporarlo otra vez', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/', () =>
        HttpResponse.json({ count: 1, next: null, previous: null, results: [sku] }),
      ),
    )
    const wrapper = mount(CatalogoContextual, {
      props: { categorias: [silla], familias: [], existingProductIds: [41] },
    })
    await flushPromises()
    const seleccionar = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Ir a línea'))
    expect(seleccionar).toBeDefined()
    await seleccionar!.trigger('click')
    expect(wrapper.emitted('duplicate')?.[0]).toEqual([41])
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })
})
