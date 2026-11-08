import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import ProformaEditorView from '@/modules/proformas/views/ProformaEditorView.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { productosService } from '@/modules/productos/services/productosService'
import { server } from '@/tests/msw/server'

const options: Record<string, object[]> = {
  TIPO_ITEM: [{ id: 1, concepto_codigo: 'TIPO_ITEM', codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble' }],
  UNIDAD_MEDIDA: [{ id: 2, concepto_codigo: 'UNIDAD_MEDIDA', codigo: 'PIEZA', nombre: 'Pieza' }],
  MONEDA: [{ id: 3, concepto_codigo: 'MONEDA', codigo: 'BOB', nombre: 'Bolivianos' }],
  TIPO_MUEBLE: [{ id: 4, concepto_codigo: 'TIPO_MUEBLE', codigo: 'MESA', nombre: 'Mesa' }],
  TIPO_CLIENTE: [{ id: 5, concepto_codigo: 'TIPO_CLIENTE', codigo: 'PERSONA', nombre: 'Persona' }],
}

function references() {
  vi.spyOn(proformasService, 'options').mockImplementation(async (concepto) =>
    Promise.resolve(options[concepto] as never),
  )
  vi.spyOn(proformasService, 'families').mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  })
}

const click = async (wrapper: Awaited<ReturnType<typeof mounted>>['wrapper'], text: string) => {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().endsWith(text))
  if (!button) throw new Error(`No se encontró el botón ${text}`)
  await button.trigger('click')
}

async function mounted(path = '/proformas/nueva') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/proformas/nueva', component: ProformaEditorView },
      { path: '/proformas/:id/editar', component: ProformaEditorView },
      { path: '/proformas/:id', name: 'proforma-readonly', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  const wrapper = mount(ProformaEditorView, {
    global: { plugins: [createPinia(), router], stubs: { Teleport: true } },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('AP3 editor integral', () => {
  it('habilita guardar solo si hay cambios reales y lo deshabilita al revertirlos', async () => {
    references()
    const { wrapper } = await mounted()
    const save = wrapper.get('button.editor-save-draft')
    expect(save.attributes('disabled')).toBeDefined()
    await click(wrapper, 'Condiciones')
    await wrapper.get('#titulo').setValue('Nueva propuesta')
    expect(save.attributes('disabled')).toBeUndefined()
    await wrapper.get('#titulo').setValue('')
    expect(save.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('desglosa cantidad, precio unitario, descuento e importe de la línea con claridad', async () => {
    references()
    vi.spyOn(proformasService, 'get').mockResolvedValue({
      id: 1,
      estado_info: { codigo: 'BORRADOR' },
      moneda_info: { codigo: 'BOB' },
      detalles: [
        {
          id: 32,
          proforma: 1,
          tipo_item: 1,
          producto: 7,
          nombre: 'Mesa de reunión para 10 personas',
          descripcion: '',
          cantidad: '1.0000',
          unidad: 2,
          modo_calculo: 'UNITARIO',
          precio_unitario: '7300.00',
          descuento: '0.00',
          importe_negociado: null,
          total: '7300.00',
          galeria_id: null,
          especificacion: null,
        },
      ],
    } as never)
    vi.spyOn(productosService, 'get').mockResolvedValue({
      id: 7,
      sku: 'M-007',
      nombre: 'Mesa de reunión para 10 personas',
      imagen_principal: null,
    } as never)
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/7/imagenes/', () =>
        HttpResponse.json({ imagenes: [], limite: 8 }),
      ),
    )

    const { wrapper } = await mounted('/proformas/1/editar')
    const lineSummary = wrapper.get(
      '[aria-label="Ver detalle completo de Mesa de reunión para 10 personas"]',
    )
    expect(lineSummary.text()).toContain('Mesa de reunión para 10 personas')
    expect(lineSummary.text()).not.toContain('Cantidad')
    const lineMetrics = wrapper.get('.line-card .line-metrics')
    const metricsText = lineMetrics.text().replace(/\s+/g, ' ')
    expect(metricsText).toContain('Cantidad')
    expect(metricsText).toContain('1 Pieza')
    expect(metricsText).toContain('Precio por unidad')
    expect(metricsText).toContain('Bs 7.300,00')
    expect(metricsText).toContain('Descuento')
    expect(metricsText).toContain('Ninguno')
    expect(wrapper.get('.line-total').text()).toContain('Importe de línea')
    await lineMetrics.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Resumen de la línea')
    wrapper.unmount()
  })

  it('consulta una línea histórica sin sustituir el importe ni habilitar su edición', async () => {
    references()
    const historicalLine = {
      id: 31,
      proforma: 1,
      tipo_item: 1,
      tipo_item_info: options.TIPO_ITEM![0]!,
      producto: 7,
      familia_producto: null,
      nombre: 'Silla negociada histórica',
      descripcion: 'Tapizado acordado',
      cantidad: '2.0000',
      unidad: 2,
      unidad_info: options.UNIDAD_MEDIDA![0]!,
      modo_calculo: 'TOTAL_NEGOCIADO',
      precio_unitario: '150.00',
      importe_negociado: '321.75',
      descuento: '10.25',
      precio_antes_snapshot: null,
      precio_ahora_snapshot: null,
      total: '311.50',
      galeria_id: null,
      especificacion: null,
    }
    vi.spyOn(proformasService, 'get').mockResolvedValue({
      id: 1,
      estado_info: { codigo: 'BORRADOR' },
      moneda_info: { codigo: 'BOB' },
      detalles: [historicalLine],
    } as never)
    vi.spyOn(productosService, 'get').mockResolvedValue({
      id: 7,
      sku: 'S-007',
      nombre: 'Silla actual',
      categoria_info: { nombre: 'Silla' },
      familia_info: { nombre: 'Oficina' },
      unidad_stock_info: { nombre: 'Pieza' },
      precio_vigente: '720.00',
      precio_lista: '800.00',
      stock: '2.0000',
      demanda_pendiente: '1.0000',
      disponibilidad_referencial: '1.0000',
      imagen_principal: null,
    } as never)
    server.use(
      http.get('http://localhost:8000/api/v1/catalogo/productos/7/imagenes/', () =>
        HttpResponse.json({ imagenes: [], limite: 8 }),
      ),
    )
    const { wrapper } = await mounted('/proformas/1/editar')
    await flushPromises()
    await wrapper
      .get('[aria-label="Ver detalle completo de Silla negociada histórica"]')
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Importe negociado histórico')
    expect(wrapper.text()).toContain('321.75')
    expect(wrapper.text()).not.toContain('Precio vigente del catálogo')
    expect(wrapper.find('.viewer-footer .context-action').exists()).toBe(false)
    wrapper.unmount()
  })

  it('abre y navega los cuatro apartados sin persistir ni perder información', async () => {
    references()
    let writes = 0
    server.use(
      http.post('http://localhost:8000/api/v1/proformas/integral/', () => {
        writes += 1
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    const { wrapper } = await mounted()

    await click(wrapper, 'Condiciones')
    await wrapper.get('#titulo').setValue('Proyecto sin persistir')
    await click(wrapper, 'Productos')
    await click(wrapper, 'Condiciones')

    expect((wrapper.get('#titulo').element as HTMLInputElement).value).toBe(
      'Proyecto sin persistir',
    )
    expect(wrapper.text()).toContain('Productos')
    expect(wrapper.text()).toContain('Cliente')
    expect(wrapper.text()).toContain('Condiciones')
    expect(wrapper.text()).toContain('Revisar')
    expect(writes).toBe(0)
  })

  it('guarda el borrador completo mediante una sola solicitud explícita', async () => {
    references()
    const bodies: unknown[] = []
    server.use(
      http.post('http://localhost:8000/api/v1/proformas/integral/', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(
          {
            id: 9,
            numero: 101,
            revision: 'a'.repeat(64),
            cliente: null,
            cliente_resumen: null,
            vendedor: 1,
            estado: 1,
            estado_info: { id: 1, codigo: 'BORRADOR', nombre: 'Borrador' },
            titulo: 'Borrador AP3',
            fecha: '2026-10-14',
            plazo_entrega: null,
            validez_oferta: null,
            porcentaje_adelanto: null,
            moneda: 3,
            moneda_info: { id: 3, codigo: 'BOB', nombre: 'Bolivianos' },
            subtotal: '0.00',
            descuento_total: '0.00',
            total: '0.00',
            observaciones: null,
            prospecto_nombre: null,
            prospecto_empresa: null,
            prospecto_celular: null,
            prospecto_direccion: null,
            cliente_nombre_snapshot: null,
            cliente_empresa_snapshot: null,
            cliente_celular_snapshot: null,
            cliente_direccion_snapshot: null,
            created_by: 1,
            updated_by: 1,
            detalles: [],
          },
          { status: 201 },
        )
      }),
    )
    const { wrapper, router } = await mounted()
    await click(wrapper, 'Condiciones')
    await wrapper.get('#titulo').setValue('Borrador AP3')
    await click(wrapper, 'Productos')
    await click(wrapper, 'Condiciones')

    await click(wrapper, 'Guardar borrador')
    await flushPromises()

    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ emitir: false, titulo: 'Borrador AP3', detalles: [] })
    expect(router.currentRoute.value.fullPath).toBe('/proformas/9/editar')

    server.use(
      http.put('http://localhost:8000/api/v1/proformas/9/integral/', () =>
        HttpResponse.json({ detail: 'Conflicto de revisión.' }, { status: 409 }),
      ),
    )
    await wrapper.get('#titulo').setValue('Cambios locales no enviados')
    await click(wrapper, 'Guardar borrador')
    await flushPromises()

    expect((wrapper.get('#titulo').element as HTMLInputElement).value).toBe(
      'Cambios locales no enviados',
    )
    expect(wrapper.text()).toContain('Se conservaron tus cambios locales')
    expect(wrapper.text()).toContain('Descartar cambios y recargar')
  })
})
