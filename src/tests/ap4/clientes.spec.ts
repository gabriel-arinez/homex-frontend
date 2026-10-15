import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import ClienteCreateView from '@/modules/clientes/views/ClienteCreateView.vue'
import ClienteDetailView from '@/modules/clientes/views/ClienteDetailView.vue'
import ClientesListView from '@/modules/clientes/views/ClientesListView.vue'
import ClienteFormFields from '@/modules/clientes/components/ClienteFormFields.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { clientesService } from '@/modules/clientes/services/clientesService'
import { server } from '@/tests/msw/server'

const typeInfo = {
  id: 2,
  concepto_codigo: 'TIPO_CLIENTE',
  codigo: 'EMPRESA',
  nombre: 'Empresa',
}

describe('AP4 clientes consolidados', () => {
  it('registra una empresa con contacto usando el contrato backend', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('http://localhost:8000/api/v1/clientes/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          id: 41,
          ...body,
          tipo_cliente_info: typeInfo,
          activo: true,
          created_by: 7,
          updated_by: 7,
        })
      }),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/clientes/nuevo', component: ClienteCreateView },
        { path: '/clientes/:id', component: { template: '<div>Detalle</div>' } },
        { path: '/clientes', component: { template: '<div>Clientes</div>' } },
      ],
    })
    await router.push('/clientes/nuevo')
    const wrapper = mount(ClienteCreateView, { global: { plugins: [createPinia(), router] } })
    await flushPromises()
    await wrapper.get('select').setValue('2')
    await wrapper.get('input[name="nuevo-cliente-nombres"]').setValue('María')
    await wrapper.get('input[name="nuevo-cliente-apellidos"]').setValue('Flores')
    await wrapper.get('input[name="nuevo-cliente-empresa"]').setValue('Muebles Flores')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(body).toMatchObject({
      tipo_cliente: 2,
      nombres: 'María',
      apellidos: 'Flores',
      empresa: 'Muebles Flores',
    })
    expect(router.currentRoute.value.fullPath).toBe('/clientes/41')
  })

  it('envía filtros de tipo, estado, búsqueda y paginación al servidor', async () => {
    let url = ''
    server.use(
      http.get('http://localhost:8000/api/v1/clientes/', ({ request }) => {
        url = request.url
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] })
      }),
    )
    await clientesService.list({
      search: 'Flores',
      activo: false,
      tipo_cliente: 2,
      page: 3,
      page_size: 10,
    })
    const params = new URL(url).searchParams
    expect(Object.fromEntries(params)).toMatchObject({
      search: 'Flores',
      activo: 'false',
      tipo_cliente: '2',
      page: '3',
      page_size: '10',
    })
  })

  it('desactiva mediante DELETE lógico y permite reactivación explícita', async () => {
    const methods: string[] = []
    server.use(
      http.delete('http://localhost:8000/api/v1/clientes/41/', ({ request }) => {
        methods.push(request.method)
        return new HttpResponse(null, { status: 204 })
      }),
      http.patch('http://localhost:8000/api/v1/clientes/41/', async ({ request }) => {
        methods.push(`${request.method}:${JSON.stringify(await request.json())}`)
        return HttpResponse.json({
          id: 41,
          tipo_cliente: 2,
          tipo_cliente_info: typeInfo,
          nombres: 'María',
          apellidos: 'Flores',
          empresa: 'Muebles Flores',
          activo: true,
          created_by: 7,
          updated_by: 7,
        })
      }),
    )
    await clientesService.deactivate(41, 'a'.repeat(64))
    await clientesService.update(41, { activo: true }, 'b'.repeat(64))
    expect(methods).toEqual(['DELETE', 'PATCH:{"activo":true}'])
  })
  it('limpia la razon social oculta al pasar de EMPRESA a PERSONA', async () => {
    const wrapper = mount(ClienteFormFields, {
      props: {
        model: {
          tipo_cliente: '2',
          nombres: 'María',
          apellidos: 'Flores',
          empresa: 'Razón social anterior',
          celular: '',
          direccion: '',
          observaciones: '',
        },
        tipos: [
          { id: 1, concepto_codigo: 'TIPO_CLIENTE', codigo: 'PERSONA', nombre: 'Persona' },
          typeInfo,
        ],
      },
    })
    await wrapper.get('select').setValue('1')
    expect(wrapper.emitted('change')).toEqual([
      ['tipo_cliente', '1'],
      ['empresa', ''],
    ])
  })

  it('actualiza la ficha al cambiar de identificador sin mostrar el cliente anterior', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/clientes/:id/', ({ params }) =>
        HttpResponse.json({
          id: Number(params.id),
          tipo_cliente: 1,
          tipo_cliente_info: {
            id: 1, concepto_codigo: 'TIPO_CLIENTE', codigo: 'PERSONA', nombre: 'Persona',
          },
          nombres: `Nombre ${params.id}`,
          apellidos: 'HOMEX',
          empresa: null,
          revision: 'a'.repeat(64),
          activo: true,
        }),
      ),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/clientes/:id', component: ClienteDetailView }],
    })
    await router.push('/clientes/1')
    const wrapper = mount(ClienteDetailView, {
      global: { plugins: [createPinia(), router] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Nombre 1 HOMEX')
    await router.push('/clientes/2')
    await flushPromises()
    expect(wrapper.text()).toContain('Nombre 2 HOMEX')
    expect(wrapper.text()).not.toContain('Nombre 1 HOMEX')
  })

  it('restaura los filtros al navegar a otra URL de clientes', async () => {
    const queries: string[] = []
    server.use(
      http.get('http://localhost:8000/api/v1/clientes/', ({ request }) => {
        queries.push(request.url)
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] })
      }),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/clientes', component: ClientesListView }],
    })
    await router.push('/clientes')
    const wrapper = mount(ClientesListView, {
      global: { plugins: [createPinia(), router] },
    })
    await flushPromises()
    await router.push('/clientes?q=Flores&estado=inactivos&tipo=2&pagina=2')
    await flushPromises()
    const query = new URL(queries.at(-1) ?? '').searchParams
    expect(Object.fromEntries(query)).toMatchObject({
      search: 'Flores', activo: 'false', tipo_cliente: '2', page: '2',
    })
    expect(wrapper.text()).toContain('Flores')
  })

  it('conserva campos locales ante 409 por otro editor', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/clientes/41/', () =>
        HttpResponse.json({
          id: 41, tipo_cliente: 2, tipo_cliente_info: typeInfo,
          nombres: 'María', apellidos: 'Flores', empresa: 'Muebles Flores',
          revision: 'a'.repeat(64), activo: true,
        }),
      ),
      http.patch('http://localhost:8000/api/v1/clientes/41/', () =>
        HttpResponse.json({ detail: 'Edición obsoleta' }, { status: 409 }),
      ),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/clientes/:id', component: ClienteDetailView }],
    })
    await router.push('/clientes/41')
    const pinia = createPinia()
    useSessionStore(pinia).capabilities = ['comercial.operar']
    const wrapper = mount(ClienteDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const editar = wrapper.findAll('button').find((button) => button.text() === 'Editar')
    expect(editar).toBeDefined()
    await editar!.trigger('click')
    await wrapper.get('input[name="nombres"]').setValue('Cambio no guardado')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect((wrapper.get('input[name="nombres"]').element as HTMLInputElement).value).toBe(
      'Cambio no guardado',
    )
    expect(wrapper.text()).toContain('Descartar cambios y recargar ficha')
  })

})
