import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import type { Producto, ValorCatalogoPublico } from '@/generated/api'
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
  it('consulta productos reales mediante API y no guarda proformas al seleccionar SKU', async () => {
    let lecturas = 0
    let escrituras = 0
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/', () => {
        lecturas += 1
        return HttpResponse.json({
          count: 1, next: null, previous: null, results: [sku],
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
    const seleccionar = wrapper.findAll('button').find((button) =>
      button.text().includes('Seleccionar para cotizar'))
    expect(seleccionar).toBeDefined()
    await seleccionar!.trigger('click')
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 41 })
    expect(lecturas).toBeGreaterThan(0)
    expect(escrituras).toBe(0)
    wrapper.unmount()
  })

  it('bloquea visualmente agregar el mismo SKU dos veces', async () => {
    server.use(http.get('http://localhost:8000/api/v1/catalogo/productos/', () =>
      HttpResponse.json({ count: 1, next: null, previous: null, results: [sku] })))
    const wrapper = mount(CatalogoContextual, {
      props: { categorias: [silla], familias: [], existingProductIds: [41] },
    })
    await flushPromises()
    const seleccionar = wrapper.findAll('button').find((button) =>
      button.text().includes('SKU ya agregado'))
    expect(seleccionar?.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
