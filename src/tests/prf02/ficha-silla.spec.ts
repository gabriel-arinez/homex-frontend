import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import type { Producto, ProductoWritable } from '@/generated/api'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'

const maestro = {
  id: 91,
  categoria: 3,
  familia: null,
  sku: 'SILLA-MAESTRO',
  nombre: 'Silla',
  precio_lista: '200.00',
  unidad_stock: 1,
  activo: true,
  silla: {
    marca: null,
    modelo: 'S-91',
    color_primario: null,
    color_secundario: null,
    especificaciones: {
      tapizado: 'malla',
      resistencia: 120,
      configuracion: { brazos: { altura: 'regulable' } },
    },
  },
} as unknown as Producto

function mockCatalog() {
  server.use(
    http.get('http://localhost:8000/api/v1/catalogo/familias/', () =>
      HttpResponse.json({ count: 0, results: [], next: null, previous: null }),
    ),
    http.get('http://localhost:8000/api/v1/catalogo/opciones/', ({ request }) => {
      const codigo = new URL(request.url).searchParams.get('concepto')
      if (codigo === 'CATEGORIA_PRODUCTO') {
        return HttpResponse.json([
          { id: 3, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: codigo },
        ])
      }
      if (codigo === 'UNIDAD_MEDIDA') {
        return HttpResponse.json([
          { id: 1, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: codigo },
        ])
      }
      return HttpResponse.json([])
    }),
  )
}

describe('PRF-02 ficha maestra de silla', () => {
  it('edita campos legibles y preserva las claves JSON complejas desconocidas', async () => {
    mockCatalog()
    const wrapper = mount(ProductoForm, { props: { initial: maestro } })
    await flushPromises()
    expect(wrapper.text()).toContain('Características adicionales de la silla')
    await wrapper.get('input[aria-label="Valor 1"]').setValue('cuero')
    await wrapper.get('form').trigger('submit')
    const body = wrapper.emitted('save')?.[0]?.[0] as ProductoWritable
    expect(body.silla?.especificaciones).toEqual({
      tapizado: 'cuero',
      resistencia: 120,
      configuracion: { brazos: { altura: 'regulable' } },
    })
    wrapper.unmount()
  })

  it('rechaza una característica sin nombre sin borrar la ficha previa', async () => {
    mockCatalog()
    const wrapper = mount(ProductoForm, { props: { initial: maestro } })
    await flushPromises()
    const add = wrapper.findAll('button').find((button) =>
      button.text().includes('Añadir característica'),
    )
    expect(add).toBeDefined()
    await add!.trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('Cada característica debe tener un nombre.')
    wrapper.unmount()
  })
})
