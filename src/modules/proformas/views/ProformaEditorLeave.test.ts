import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Proforma } from '@/generated/api'
import ProformaEditorView from '../views/ProformaEditorView.vue'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog.vue'
import { proformasService } from '../services/proformasService'

const options: Record<string, object[]> = {
  TIPO_ITEM: [{ id: 1, codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble' }],
  UNIDAD_MEDIDA: [{ id: 2, codigo: 'PIEZA', nombre: 'Pieza' }],
  MONEDA: [{ id: 3, codigo: 'BOB', nombre: 'Bolivianos' }],
  TIPO_MUEBLE: [],
  TIPO_CLIENTE: [],
  CATEGORIA_PRODUCTO: [],
}

async function editor() {
  vi.spyOn(proformasService, 'options').mockImplementation(async (code) =>
    Promise.resolve(options[code] as never),
  )
  vi.spyOn(proformasService, 'families').mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/proformas/nueva', component: ProformaEditorView },
      { path: '/proformas', component: { template: '<p>Bandeja de proformas</p>' } },
      { path: '/proformas/:id/editar', component: ProformaEditorView },
    ],
  })
  await router.push('/proformas/nueva')
  const wrapper = mount(
    { template: '<RouterView />' },
    { global: { plugins: [createPinia(), router], stubs: { Teleport: true } } },
  )
  await flushPromises()
  const view = wrapper.getComponent(ProformaEditorView)
  const conditions = view.findAll('button').find((button) => button.text().endsWith('Condiciones'))
  await conditions!.trigger('click')
  await view.get('#titulo').setValue('Cambios pendientes')
  return { wrapper, router }
}

const draft = {
  id: 578,
  numero: 578,
  revision: 'a'.repeat(64),
  cliente: null,
  cliente_resumen: null,
  vendedor: 1,
  estado: 1,
  estado_info: { id: 1, codigo: 'BORRADOR', nombre: 'Borrador' },
  titulo: 'Cambios pendientes',
  moneda: 3,
  moneda_info: { id: 3, codigo: 'BOB', nombre: 'Bolivianos' },
  fecha: '2026-11-04',
  subtotal: '0.00',
  descuento_total: '0.00',
  total: '0.00',
  detalles: [],
} as unknown as Proforma

afterEach(() => vi.restoreAllMocks())

describe('salida protegida del editor de proformas', () => {
  it('ofrece las tres acciones y permite seguir editando sin perder el borrador', async () => {
    const { wrapper, router } = await editor()
    const navigation = router.push('/proformas')
    await flushPromises()
    const dialog = wrapper.getComponent(UnsavedChangesDialog)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.text()).toContain('Guardar borrador y salir')
    expect(dialog.text()).toContain('Salir sin guardar')
    expect(dialog.text()).toContain('Seguir editando')
    dialog.vm.$emit('cancel')
    await navigation
    expect(router.currentRoute.value.path).toBe('/proformas/nueva')
    expect(wrapper.get('#titulo').element).toHaveProperty('value', 'Cambios pendientes')
    wrapper.unmount()
  })

  it('guarda exactamente una vez antes de salir cuando el backend confirma el borrador', async () => {
    const save = vi.spyOn(proformasService, 'saveIntegral').mockResolvedValue(draft)
    const { wrapper, router } = await editor()
    const navigation = router.push('/proformas')
    await flushPromises()
    const dialog = wrapper.getComponent(UnsavedChangesDialog)
    dialog.vm.$emit('save')
    await navigation
    await flushPromises()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0].emitir).toBe(false)
    expect(router.currentRoute.value.path).toBe('/proformas')
    wrapper.unmount()
  })

  it('mantiene el diálogo abierto y la proforma sin salir cuando falla el guardado', async () => {
    vi.spyOn(proformasService, 'saveIntegral').mockRejectedValue(new Error('Fallo de conexión'))
    const { wrapper, router } = await editor()
    const navigation = router.push('/proformas')
    await flushPromises()
    const dialog = wrapper.getComponent(UnsavedChangesDialog)
    dialog.vm.$emit('save')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/proformas/nueva')
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('error')).toContain('Fallo de conexión')
    dialog.vm.$emit('cancel')
    await navigation
    expect(router.currentRoute.value.path).toBe('/proformas/nueva')
    wrapper.unmount()
  })

  it('permite salir sin guardar únicamente tras confirmación expresa', async () => {
    const save = vi.spyOn(proformasService, 'saveIntegral')
    const { wrapper, router } = await editor()
    const navigation = router.push('/proformas')
    await flushPromises()
    wrapper.getComponent(UnsavedChangesDialog).vm.$emit('discard')
    await navigation
    expect(router.currentRoute.value.path).toBe('/proformas')
    expect(save).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
