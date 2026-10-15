import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import ClienteCreateView from '@/modules/clientes/views/ClienteCreateView.vue'
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
    await clientesService.deactivate(41)
    await clientesService.update(41, { activo: true })
    expect(methods).toEqual(['DELETE', 'PATCH:{"activo":true}'])
  })
})
