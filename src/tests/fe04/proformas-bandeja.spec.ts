import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { ProformaListado } from '@/generated/api'
import ProformasListView from '@/modules/proformas/views/ProformasListView.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'

function quote(id: number, status: string): ProformaListado {
  return {
    id,
    numero: id + 100,
    cliente: 1,
    cliente_resumen: { id: 1, nombre: 'Ana Pérez', empresa: null, celular: '70000000' },
    vendedor: 7,
    estado: 1,
    estado_info: { id: 1, codigo: status, nombre: status === 'BORRADOR' ? 'Borrador' : 'Enviada' },
    titulo: id === 1 ? 'Oficina ejecutiva' : 'Cocina',
    fecha: '2026-10-25',
    plazo_entrega: null,
    validez_oferta: null,
    porcentaje_adelanto: null,
    moneda: 40,
    moneda_info: { id: 40, codigo: 'BOB', nombre: 'Bolivianos' },
    subtotal: '7300.00',
    descuento_total: '0.00',
    total: '7300.00',
  }
}
function makeRouter(path = '/proformas') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/proformas', component: ProformasListView },
      { path: '/proformas/nueva', component: { template: '<p>Nueva</p>' } },
      { path: '/proformas/:id', component: { template: '<p>Detalle</p>' } },
      { path: '/proformas/:id/editar', component: { template: '<p>Edición</p>' } },
    ],
  })
  return router.push(path).then(() => router)
}
function mockList() {
  const list = vi.spyOn(proformasService, 'list').mockResolvedValue({
    count: 2,
    next: null,
    previous: null,
    results: [quote(1, 'BORRADOR'), quote(2, 'ENVIADA')],
  })
  vi.spyOn(proformasService, 'options').mockImplementation(async (concepto) =>
    concepto === 'MONEDA'
      ? [
          { id: 40, codigo: 'BOB', nombre: 'Bolivianos', concepto_codigo: 'MONEDA' },
          { id: 41, codigo: 'USD', nombre: 'Dólares', concepto_codigo: 'MONEDA' },
        ]
      : [
          { id: 1, codigo: 'BORRADOR', nombre: 'Borrador', concepto_codigo: 'ESTADO_PROFORMA' },
          { id: 2, codigo: 'ENVIADA', nombre: 'Enviada', concepto_codigo: 'ESTADO_PROFORMA' },
        ],
  )
  return list
}
afterEach(() => vi.restoreAllMocks())

describe('Bandeja de proformas HOMEX', () => {
  it('muestra título, fecha, estado y total; menú único en editable y ojo en no editable', async () => {
    mockList()
    const router = await makeRouter()
    const wrapper = mount(ProformasListView, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('Oficina ejecutiva')
      expect(wrapper.text()).toContain('Cocina')
      expect(wrapper.text()).toContain('7.300')
      expect(wrapper.findAll('th')).toHaveLength(6)
      expect(wrapper.findAll('[aria-label^="Acciones de la proforma"]')).toHaveLength(1)
      expect(wrapper.findAll('[aria-label^="Ver proforma"]')).toHaveLength(1)
      expect(wrapper.get('[aria-label="Ver proforma #102"]').attributes('href')).toBe(
        '/proformas/2',
      )
      await wrapper.get('[aria-label="Acciones de la proforma #101"]').trigger('click')
      await flushPromises()
      const menu = document.body.querySelector('[role="menu"]')
      expect(menu?.textContent).toContain('Continuar edición')
      expect(menu?.textContent).toContain('Ver detalle y acciones')
      expect(menu?.querySelector('a[href="/proformas/1/editar"]')).not.toBeNull()
      expect(menu?.querySelector('a[href="/proformas/1"]')).not.toBeNull()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()
      expect(document.body.querySelector('[role="menu"]')).toBeNull()
    } finally {
      wrapper.unmount()
    }
  })

  it('envía filtros de servidor y mantiene la consulta en la URL', async () => {
    const list = mockList()
    const router = await makeRouter()
    const wrapper = mount(ProformasListView, { global: { plugins: [router] } })
    try {
      await flushPromises()
      await wrapper.get('button.proforma-more-filters').trigger('click')
      await wrapper.get('#estado-proforma').setValue('BORRADOR')
      await wrapper.get('#moneda-proforma-filtro').setValue('USD')
      await wrapper.get('input[name="fecha-desde-proforma"]').setValue('2026-10-01')
      await wrapper.get('input[name="fecha-hasta-proforma"]').setValue('2026-10-31')
      await new Promise((resolve) => setTimeout(resolve, 30))
      await flushPromises()
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          estado: 'BORRADOR',
          moneda: 'USD',
          fecha_desde: '2026-10-01',
          fecha_hasta: '2026-10-31',
          page: 1,
        }),
      )
      expect(router.currentRoute.value.query.moneda).toBe('USD')
      expect(router.currentRoute.value.query.fecha_desde).toBe('2026-10-01')
    } finally {
      wrapper.unmount()
    }
  })

  it('rechaza rangos inversos sin hacer búsquedas y permite limpiar filtros', async () => {
    const list = mockList()
    const router = await makeRouter('/proformas?fecha_desde=2026-11-30&fecha_hasta=2026-11-01')
    const wrapper = mount(ProformasListView, { global: { plugins: [router] } })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('La fecha inicial no puede ser posterior')
      expect(list).not.toHaveBeenCalled()
      await wrapper.get('button.clear').trigger('click')
      await new Promise((resolve) => setTimeout(resolve, 30))
      await flushPromises()
      expect(list).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
    }
  })
})
