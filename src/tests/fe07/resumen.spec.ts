import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import ResumenView from '@/modules/resumen/views/ResumenView.vue'
import { resumenService } from '@/modules/resumen/services/resumenService'
import { useSessionStore } from '@/app/stores/useSessionStore'
import type { Capability } from '@/modules/auth/types/session'
import { server } from '@/tests/msw/server'
const states = [
  { id: 1, codigo: 'BORRADOR', nombre: 'Borrador', concepto_codigo: 'ESTADO_PROFORMA' },
  { id: 2, codigo: 'ENVIADA', nombre: 'Enviada', concepto_codigo: 'ESTADO_PROFORMA' },
  { id: 3, codigo: 'APROBADA', nombre: 'Aprobada', concepto_codigo: 'ESTADO_PROFORMA' },
]
function mock(counts: Record<string, number>, failure?: string | ((state: string) => boolean)) {
  server.use(
    http.get('http://localhost:8000/api/v1/catalogo/opciones/', () => HttpResponse.json(states)),
    http.get('http://localhost:8000/api/v1/proformas/', ({ request }) => {
      const state = new URL(request.url).searchParams.get('estado') ?? ''
      const shouldFail = typeof failure === 'function' ? failure(state) : state === failure
      if (shouldFail)
        return HttpResponse.json(
          { detail: 'Métrica temporalmente no disponible.' },
          { status: 503 },
        )
      return HttpResponse.json({
        count: counts[state] ?? 0,
        next: null,
        previous: null,
        results: [],
      })
    }),
  )
}
async function render(capabilities: Capability[] = ['comercial.operar']) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.capabilities = capabilities
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/resumen', component: ResumenView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push('/resumen')
  await router.isReady()
  return mount(ResumenView, { global: { plugins: [pinia, router] } })
}
beforeEach(() => setActivePinia(createPinia()))
describe('FE07 resumen operativo', () => {
  it('consulta conteos filtrados en servidor sin descargar colecciones', async () => {
    const urls: string[] = []
    server.use(
      http.get('http://localhost:8000/api/v1/proformas/', ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json({ count: 4, next: null, previous: null, results: [] })
      }),
    )
    const result = await resumenService.contarEstado(states[1]!)
    expect(result.conteo).toBe(4)
    expect(urls[0]).toContain('estado=ENVIADA')
    expect(urls[0]).toContain('page_size=1')
  })
  it('muestra KPI y fallback textual accesible', async () => {
    mock({ BORRADOR: 2, ENVIADA: 3, APROBADA: 1 })
    const w = await render()
    await flushPromises()
    expect(w.text()).toContain('Borradores2')
    expect(w.text()).toContain('Enviadas3')
    expect(w.find('table').text()).toContain('Total consultado6')
    expect(w.find('.bars').attributes('aria-hidden')).toBe('true')
  })
  it('conserva métricas sanas cuando una consulta falla', async () => {
    mock({ BORRADOR: 2, APROBADA: 1 }, 'ENVIADA')
    const w = await render()
    await flushPromises()
    expect(w.text()).toContain('1 indicador no pudo actualizarse')
    expect(w.text()).toContain('No disponible')
    expect(w.text()).toContain('Borradores2')
    expect(w.find('table').text()).toContain('Subtotal disponible3')
    expect(w.find('table').text()).not.toContain('Total consultado3')
  })
  it('representa estado vacío real con conteos cero', async () => {
    mock({})
    const w = await render()
    await flushPromises()
    expect(w.text()).toContain('Total consultado0')
    expect(w.text()).not.toContain('Sin métricas disponibles')
    expect(w.findAll('.bar-row i')).toHaveLength(3)
    for (const bar of w.findAll('.bar-row i'))
      expect(bar.attributes('style')).toContain('width: 0%')
  })
  it('adapta accesos a capacidades sin métricas inventadas', async () => {
    mock({})
    const seller = await render()
    await flushPromises()
    expect(seller.findAll('nav a').map((x) => x.text())).toEqual([
      'Revisar proformas',
      'Consultar pedidos',
      'Nueva captura asistida',
    ])
    expect(seller.text()).not.toMatch(/99\.9|eficiencia|stock valorizado/i)

    const admin = await render(['comercial.operar', 'comercial.administrar'])
    await flushPromises()
    expect(admin.findAll('nav a').map((x) => x.text())).toContain('Administrar catálogo')
  })
  it('recupera un indicador fallido al actualizar y restaura el total completo', async () => {
    let failing = true
    mock(
      { BORRADOR: 2, ENVIADA: 3, APROBADA: 1 },
      (state) => failing && state === 'ENVIADA',
    )
    const w = await render()
    await flushPromises()
    expect(w.text()).toContain('1 indicador no pudo actualizarse')
    expect(w.find('table').text()).toContain('Subtotal disponible3')

    failing = false
    const actualizar = w.findAll('button').find((button) => button.text().includes('Actualizar'))
    expect(actualizar).toBeDefined()
    await actualizar!.trigger('click')
    await flushPromises()

    expect(w.text()).not.toContain('indicador no pudo actualizarse')
    expect(w.find('table').text()).toContain('Total consultado6')
  })
})
