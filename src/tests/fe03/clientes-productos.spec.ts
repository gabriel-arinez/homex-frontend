import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import ClientesListView from '@/modules/clientes/views/ClientesListView.vue'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import { productosService } from '@/modules/productos/services/productosService'
import { clientesService } from '@/modules/clientes/services/clientesService'
import { server } from '@/tests/msw/server'

const clients = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  tipo_cliente: 1,
  nombres: index === 11 ? 'Lucía' : `Cliente ${index + 1}`,
  apellidos: 'HOMEX',
  celular: `700000${index}`,
  activo: index !== 10,
  created_by: 7,
  updated_by: 7,
}))

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/clientes', component: ClientesListView },
      { path: '/clientes/:id', component: { template: '<div />' } },
    ],
  })
}

describe('FE03 clientes y productos', () => {
  it('envía búsqueda, filtro y paginación de clientes al backend', async () => {
    const requests: URL[] = []
    server.use(
      http.get('http://localhost:8000/api/v1/clientes/', ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        const search = url.searchParams.get('search')
        const activo = url.searchParams.get('activo')
        const filtered = clients.filter((client) => {
          const matchesSearch =
            !search ||
            [client.nombres, client.apellidos, client.celular]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(search.toLowerCase())
          const matchesActive =
            activo === null || String(client.activo !== false) === activo.toLowerCase()
          return matchesSearch && matchesActive
        })
        return HttpResponse.json({
          count: filtered.length,
          next: null,
          previous: null,
          results: filtered.slice(0, 10),
        })
      }),
    )
    const router = testRouter()
    await router.push('/clientes')
    const wrapper = mount(ClientesListView, { global: { plugins: [createPinia(), router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('12 clientes')
    expect(requests[requests.length - 1]?.searchParams.get('page_size')).toBe('10')
    expect(requests[requests.length - 1]?.searchParams.get('page')).toBe('1')

    await wrapper.get('input[type="search"]').setValue('Lucía')
    await flushPromises()
    expect(requests[requests.length - 1]?.searchParams.get('search')).toBe('Lucía')
    expect(wrapper.text()).toContain('Lucía HOMEX')

    await wrapper.get('select').setValue('inactivos')
    await flushPromises()
    expect(requests[requests.length - 1]?.searchParams.get('activo')).toBe('false')
    expect(wrapper.text()).toContain('Sin resultados')
  })

  it('envía filtros contractuales de productos y consume envelope paginado', async () => {
    let requestedUrl = ''
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/', ({ request }) => {
        requestedUrl = request.url
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 4,
              categoria: 3,
              unidad_stock: 2,
              nombre: 'Silla B15',
              precio_vigente: '1200.00',
              stock: 8,
              demanda_pendiente: 3,
              disponibilidad_referencial: 5,
              imagen_principal: null,
              created_by: 7,
              updated_by: 7,
            },
          ],
        })
      }),
    )

    const response = await productosService.list({
      search: 'B15',
      activo: true,
      categoria: 3,
      page: 2,
      page_size: 12,
    })

    const requested = new URL(requestedUrl)
    expect(response.count).toBe(1)
    expect(response.results[0]?.nombre).toBe('Silla B15')
    expect(requested.searchParams.get('search')).toBe('B15')
    expect(requested.searchParams.get('activo')).toBe('true')
    expect(requested.searchParams.get('categoria')).toBe('3')
    expect(requested.searchParams.get('page')).toBe('2')
    expect(requested.searchParams.get('page_size')).toBe('12')
  })

  it('construye srcset sólo con variantes y usa fallback sin original', async () => {
    const wrapper = mount(ProductImage, {
      props: {
        alt: 'Silla B15',
        image: {
          original: 'https://media.example/original.webp',
          ancho: 1280,
          alto: 960,
          variantes: {
            '320': 'https://media.example/320.webp',
            '640': 'https://media.example/640.webp',
          },
        },
      },
    })
    const image = wrapper.get('img')
    expect(image.attributes('src')).toBe('https://media.example/320.webp')
    expect(image.attributes('srcset')).toContain('320.webp 320w')
    expect(image.attributes('srcset')).not.toContain('original.webp')
    expect(image.attributes('loading')).toBe('lazy')
    await image.trigger('error')
    expect(wrapper.text()).toContain('Sin imagen')
  })

  it('edita datos comerciales sin enviar stock calculado por frontend', async () => {
    let sent: Record<string, unknown> = {}
    server.use(
      http.patch('http://localhost:8000/api/v1/catalogo/productos/4/', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          id: 4,
          categoria: 1,
          unidad_stock: 1,
          nombre: 'Silla B15',
          precio_vigente: '1200.00',
          stock: 8,
          demanda_pendiente: 3,
          disponibilidad_referencial: 5,
          imagen_principal: null,
          created_by: 7,
          updated_by: 7,
          ...sent,
        })
      }),
    )
    await productosService.update(4, { nombre: 'Silla B15', precio_lista: '1500.00' })
    expect(sent).toEqual({ nombre: 'Silla B15', precio_lista: '1500.00' })
    expect(sent).not.toHaveProperty('stock')
    expect(sent).not.toHaveProperty('precio_vigente')
  })

  it('conserva errores 403 y validaciones del servidor en edición de clientes', async () => {
    server.use(
      http.patch('http://localhost:8000/api/v1/clientes/3/', () =>
        HttpResponse.json({ detail: 'Sin permiso' }, { status: 403 }),
      ),
    )
    await expect(clientesService.update(3, { celular: '70000000' })).rejects.toMatchObject({
      status: 403,
      message: 'Sin permiso',
    })
    server.use(
      http.patch('http://localhost:8000/api/v1/clientes/3/', () =>
        HttpResponse.json({ empresa: ['La empresa es obligatoria.'] }, { status: 400 }),
      ),
    )
    await expect(clientesService.update(3, { empresa: '' })).rejects.toMatchObject({
      status: 400,
      fields: { empresa: ['La empresa es obligatoria.'] },
    })
  })
})
