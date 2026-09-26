import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { DetalleProforma, Proforma } from '@/generated/api'
import DetalleForm from '@/modules/proformas/components/DetalleForm.vue'
import ProformaDetailView from '@/modules/proformas/views/ProformaDetailView.vue'
import ProformasListView from '@/modules/proformas/views/ProformasListView.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { server } from '@/tests/msw/server'

const option = (id: number, codigo: string, nombre: string, concepto_codigo = 'TIPO_ITEM') => ({
  id,
  codigo,
  nombre,
  concepto_codigo,
})
const detail: DetalleProforma = {
  id: 10,
  proforma: 1,
  tipo_item: 1,
  tipo_item_info: { id: 1, codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble a medida' },
  producto: null,
  nombre: 'Escritorio',
  descripcion: null,
  cantidad: 3,
  unidad: 5,
  unidad_info: { id: 5, codigo: 'PIEZA', nombre: 'Pieza' },
  modo_calculo: 'TOTAL_NEGOCIADO',
  precio_unitario: '33.333333',
  importe_negociado: '100.00',
  descuento: '0.00',
  precio_antes_snapshot: null,
  precio_ahora_snapshot: null,
  total: '100.00',
  especificacion: null as never,
}
const quote = (state = 'BORRADOR'): Proforma => ({
  id: 1,
  numero: 25,
  cliente: 1,
  cliente_resumen: { id: 1, nombre: 'Ana Pérez', empresa: null, celular: '7000' },
  vendedor: 7,
  estado: 2,
  estado_info: { id: 2, codigo: state, nombre: state === 'BORRADOR' ? 'Borrador' : 'Enviada' },
  titulo: 'Oficina',
  fecha: '2026-09-25',
  plazo_entrega: null,
  validez_oferta: null,
  porcentaje_adelanto: null,
  moneda: 3,
  moneda_info: { id: 3, codigo: 'BOB', nombre: 'Bolivianos' },
  subtotal: '100.00',
  descuento_total: '0.00',
  total: '100.00',
  observaciones: null,
  prospecto_nombre: null,
  prospecto_empresa: null,
  prospecto_celular: null,
  prospecto_direccion: null,
  cliente_nombre_snapshot: null,
  cliente_empresa_snapshot: null,
  cliente_celular_snapshot: null,
  cliente_direccion_snapshot: null,
  created_by: 7,
  updated_by: 7,
  detalles: [detail],
})
const options = {
  TIPO_ITEM: [option(1, 'MUEBLE_MEDIDA', 'Mueble a medida')],
  UNIDAD_MEDIDA: [option(5, 'PIEZA', 'Pieza', 'UNIDAD_MEDIDA')],
  TIPO_MUEBLE: [option(8, 'ESCRITORIO', 'Escritorio', 'TIPO_MUEBLE')],
  MONEDA: [
    { id: 40, concepto_codigo: 'MONEDA', codigo: 'BOB', nombre: 'Bolivianos' },
    { id: 41, concepto_codigo: 'MONEDA', codigo: 'USD', nombre: 'Dólares estadounidenses' },
  ],
  ESTADO_PROFORMA: [option(2, 'BORRADOR', 'Borrador', 'ESTADO_PROFORMA')],
}
function common(current = quote()) {
  server.use(
    http.get('http://localhost:8000/api/v1/catalogo/opciones/', ({ request }) =>
      HttpResponse.json(
        options[new URL(request.url).searchParams.get('concepto') as keyof typeof options] ?? [],
      ),
    ),
    http.get('http://localhost:8000/api/v1/clientes/', () =>
      HttpResponse.json({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 1,
            tipo_cliente: 1,
            nombres: 'Ana',
            apellidos: 'Pérez',
            activo: true,
            created_by: 7,
            updated_by: 7,
          },
        ],
      }),
    ),
    http.get('http://localhost:8000/api/v1/catalogo/productos/', () =>
      HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
    ),
    http.get('http://localhost:8000/api/v1/proformas/1/', () => HttpResponse.json(current)),
    http.get('http://localhost:8000/api/v1/proformas/1/detalles/10/archivos/', () =>
      HttpResponse.json([]),
    ),
  )
}
function router(path = '/proformas/1') {
  const r = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/proformas', component: ProformasListView },
      { path: '/proformas/:id', component: ProformaDetailView },
    ],
  })
  return r.push(path).then(() => r)
}

describe('FE04 proformas manuales', () => {
  it('conserva 3 por 100 como total negociado exacto', async () => {
    common()
    const wrapper = mount(DetalleForm, {
      props: { tipos: options.TIPO_ITEM, unidades: options.UNIDAD_MEDIDA, moneda: 'BOB' },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.get('#nombre-linea').setValue('Mueble')
    await wrapper.get('#cantidad-linea').setValue('3')
    await wrapper.get('#modo-calculo').setValue('TOTAL_NEGOCIADO')
    await wrapper.get('#importe-negociado').setValue('100.00')
    await wrapper.get('form').trigger('submit')
    const body = wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
    expect(body).toMatchObject({
      cantidad: 3,
      modo_calculo: 'TOTAL_NEGOCIADO',
      importe_negociado: '100.00',
    })
    expect(body.precio_unitario).toBe('0')
  })
  it('mantiene el decimal USD sin convertirlo ni recalcularlo', async () => {
    common()
    const wrapper = mount(DetalleForm, {
      props: { tipos: options.TIPO_ITEM, unidades: options.UNIDAD_MEDIDA, moneda: 'USD' },
    })
    await wrapper.get('#nombre-linea').setValue('Mueble USD')
    await wrapper.get('#cantidad-linea').setValue('3')
    await wrapper.get('#precio-unitario').setValue('33.33')
    await wrapper.get('form').trigger('submit')
    const body = wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
    expect(body).toMatchObject({
      cantidad: 3,
      modo_calculo: 'PRECIO_UNITARIO',
      precio_unitario: '33.33',
      importe_negociado: null,
    })
  })
  it('envía filtros y paginación al backend', async () => {
    let url = ''
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/opciones/', () =>
        HttpResponse.json(options.ESTADO_PROFORMA),
      ),
      http.get('http://localhost:8000/api/v1/proformas/', ({ request }) => {
        url = request.url
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] })
      }),
    )
    const r = await router('/proformas')
    const wrapper = mount(ProformasListView, { global: { plugins: [createPinia(), r] } })
    await flushPromises()
    await wrapper.get('input[type=search]').setValue('Ana')
    await flushPromises()
    expect(url).toContain('search=Ana')
    expect(url).toContain('page_size=10')
  })
  it('congela ENVIADA y conserva total autoritativo', async () => {
    common(quote('ENVIADA'))
    const r = await router()
    const wrapper = mount(ProformaDetailView, {
      global: { plugins: [createPinia(), r], stubs: { Teleport: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('modo lectura')
    expect(wrapper.text()).toContain('Bs 100,00')
    expect(wrapper.findAll('button').map((x) => x.text())).not.toContain('Agregar línea')
    expect(wrapper.text()).toContain('Aprobar')
  })
  it('representa conflicto 409 como recuperable y no simula éxito', async () => {
    common(quote('ENVIADA'))
    server.use(
      http.post('http://localhost:8000/api/v1/proformas/1/aprobar/', () =>
        HttpResponse.json({ detail: 'Stock insuficiente.' }, { status: 409 }),
      ),
    )
    const r = await router()
    const wrapper = mount(ProformaDetailView, {
      global: { plugins: [createPinia(), r], stubs: { Teleport: true } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((x) => x.text() === 'Aprobar')!
      .trigger('click')
    await flushPromises()
    const approveButtons = wrapper.findAll('button').filter((x) => x.text() === 'Aprobar')
    await approveButtons[approveButtons.length - 1]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Stock insuficiente')
    expect(wrapper.text()).not.toContain('Pedido #')
  })
  it('sube media con FormData sin serializar el archivo', async () => {
    let init: RequestInit | undefined
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockImplementation(async (_input, options) => {
        init = options
        return new Response(
          JSON.stringify({
            id: 3,
            nombre: 'referencia.png',
            mime_type: 'image/png',
            tamano_bytes: 4,
            url: 'https://media.example/a.webp',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      })
    vi.stubGlobal('fetch', fetchMock)
    await proformasService.upload(
      1,
      10,
      new File(['test'], 'referencia.png', { type: 'image/png' }),
    )
    expect(init).toBeDefined()
    const requestInit = init as RequestInit
    expect(requestInit.body).toBeInstanceOf(FormData)
    expect(new Headers(requestInit.headers).has('Content-Type')).toBe(false)
    expect((requestInit.body as FormData).get('archivo')).toBeInstanceOf(File)
    vi.unstubAllGlobals()
  })
  it('revoca previews locales y no las persiste', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview'),
      revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { default: Adjuntos } = await import('@/modules/proformas/components/AdjuntosDetalle.vue')
    common()
    const wrapper = mount(Adjuntos, {
      props: { proformaId: 1, detalleId: 10, editable: true },
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()
    const input = wrapper.get('input[type=file]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'a.png', { type: 'image/png' })],
    })
    await input.trigger('change')
    expect(wrapper.html()).toContain('blob:preview')
    wrapper.unmount()
    expect(create).toHaveBeenCalled()
    expect(revoke).toHaveBeenCalledWith('blob:preview')
  })
})
