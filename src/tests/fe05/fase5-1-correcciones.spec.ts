import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import AppSidebar from '@/app/layouts/AppSidebar.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
import PedidosListView from '@/modules/pedidos/views/PedidosListView.vue'
import OrdenesTrabajoListView from '@/modules/ordenes-trabajo/views/OrdenesTrabajoListView.vue'
import NotasEntregaListView from '@/modules/notas-entrega/views/NotasEntregaListView.vue'
import RecibosListView from '@/modules/recibos/views/RecibosListView.vue'
import StagedVoiceCapture from '@/modules/capturas/components/StagedVoiceCapture.vue'
import * as audioConversion from '@/modules/capturas/audioConversion'
import { asistidasService } from '@/modules/capturas/services/asistidasService'
import { server } from '@/tests/msw/server'

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/proformas', component: { template: '<div />' } },
  { path: '/productos', component: { template: '<div />' } },
  { path: '/movimientos-stock', component: { template: '<div />' } },
  { path: '/pedidos', component: { template: '<div />' } },
  { path: '/ordenes-trabajo', component: { template: '<div />' } },
  { path: '/notas-entrega', component: { template: '<div />' } },
  { path: '/clientes', component: { template: '<div />' } },
  { path: '/recibos', component: { template: '<div />' } },
]

function makeRouter(path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes })
  return router.push(path).then(() => router.isReady().then(() => router))
}

describe('Fase 5.1 correcciones transversales', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
      configurable: true,
    })
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.identity = {
      id: 1,
      username: 'encargado',
      display_name: 'Carlos Méndez',
    }
    session.capabilities = ['comercial.operar', 'comercial.administrar', 'catalogo.crear_producto']
  })

  it('ordena el sidebar con Clientes antes que Recibos', async () => {
    const router = await makeRouter('/')
    const w = mount(AppSidebar, {
      props: { drawerOpen: true },
      global: { plugins: [router] },
    })
    const labels = w.findAll('nav a').map((a) => a.text().trim())
    expect(labels).toEqual([
      'Resumen',
      'Proformas',
      'Productos',
      'Movimientos de stock',
      'Pedidos',
      'Órdenes de trabajo',
      'Notas de entrega',
      'Clientes',
      'Recibos',
    ])
  })

  it.each([
    ['PedidosListView', PedidosListView, '/pedidos?desde=2026-11-10&hasta=2026-11-01'],
    [
      'OrdenesTrabajoListView',
      OrdenesTrabajoListView,
      '/ordenes-trabajo?desde=2026-11-10&hasta=2026-11-01',
    ],
    [
      'NotasEntregaListView',
      NotasEntregaListView,
      '/notas-entrega?desde=2026-11-10&hasta=2026-11-01',
    ],
    ['RecibosListView', RecibosListView, '/recibos?desde=2026-11-10&hasta=2026-11-01'],
  ])(
    '%s deshabilita Exportar Excel y muestra motivo ante rango de fechas inválido',
    async (_name, Comp, path) => {
      server.use(
        http.get('http://localhost:8000/api/v1/pedidos/', () => HttpResponse.json([])),
        http.get('http://localhost:8000/api/v1/ordenes-trabajo/', () => HttpResponse.json([])),
        http.get('http://localhost:8000/api/v1/notas-entrega/', () => HttpResponse.json([])),
        http.get('http://localhost:8000/api/v1/recibos/', () => HttpResponse.json([])),
        http.get('http://localhost:8000/api/v1/catalogo/valores-publicos/', () =>
          HttpResponse.json([]),
        ),
      )
      const router = await makeRouter(path)
      const w = mount(Comp as never, {
        global: { plugins: [router], stubs: { Teleport: true } },
      })
      await flushPromises()
      const exportBtn = w.findAll('button').find((b) => b.text().includes('Exportar Excel'))!
      expect(exportBtn.attributes('disabled')).toBeDefined()
      expect(w.text()).toContain('La fecha inicial no puede ser posterior a la fecha final.')
    },
  )

  it('muestra cronómetro MM:SS durante transcripción y preserva tiempos en revisión', async () => {
    const wavFile = new File([new Uint8Array(100)], 'dictado.wav', { type: 'audio/wav' })
    vi.spyOn(audioConversion, 'prepareAudioForCapture').mockResolvedValue(wavFile)
    vi.spyOn(asistidasService, 'create').mockResolvedValue({
      id: 77,
      estado: 'PENDIENTE',
      intento_id: 1,
      numero_intento: 1,
      reutilizada: false,
    })
    let resolvePoll!: (value: Awaited<ReturnType<typeof asistidasService.get>>) => void
    vi.spyOn(asistidasService, 'get').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve
        }),
    )

    const w = mount(StagedVoiceCapture, {
      props: { mode: 'furniture', sesion: '11111111-1111-4111-8111-111111111111', moneda: 'BOB' },
    })
    const fileInput = w.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [wavFile],
      configurable: true,
    })
    await fileInput.trigger('change')
    await flushPromises()

    expect(w.text()).toContain('Transcribiendo audio…')
    expect(w.find('.voice-stopwatch').text()).toMatch(/^\d{2}:\d{2}$/)

    resolvePoll({
      id: 77,
      estado: 'COMPLETADA',
      intento_id: 1,
      solo_transcribir: true,
      captura_origen: null,
      texto_asr_original:
        'Mesa de melamina blanca de ciento veinte centímetros por sesenta centímetros',
      texto_corregido: null,
      texto_transcrito_original:
        'Mesa de melamina blanca de ciento veinte centímetros por sesenta centímetros',
      resultado: 'TRANSCRIBED',
      propuesta_configurador: null,
      pendientes: [],
      version_proyeccion: 'PRF04_2',
      candidatos: [],
      advertencias: [],
      motor: null,
      error_codigo: null,
      latencia_asr_ms: 2150,
    })
    await flushPromises()

    expect(w.text()).toContain('ASR: 2.1 s')
    expect(w.text()).toContain('Espera total:')
    w.unmount()
  })
})
