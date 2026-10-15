import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import ProformaEditorView from '@/modules/proformas/views/ProformaEditorView.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
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

async function mounted() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/proformas/nueva', component: ProformaEditorView },
      { path: '/proformas/:id/editar', component: ProformaEditorView },
      { path: '/proformas/:id', name: 'proforma-readonly', component: { template: '<div />' } },
    ],
  })
  await router.push('/proformas/nueva')
  const wrapper = mount(ProformaEditorView, {
    global: { plugins: [createPinia(), router], stubs: { Teleport: true } },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('AP3 editor integral', () => {
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
  })
})
