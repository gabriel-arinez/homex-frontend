import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResumenView from '@/modules/resumen/views/ResumenView.vue'
import { buildPeriodPreset, formatMoney, formatPercent } from '@/shared/analytics/formatters'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { server } from '@/tests/msw/server'

const resumenPayload = {
  fecha_referencia: '2026-11-27',
  comercial: {
    total_proformas: 286,
    borradores: 26,
    proformas_formalizadas: 248,
    pedidos_generados: 52,
    pedidos_derivados_cohorte: 52,
    pedidos_no_cancelados_cohorte: 49,
    pedidos_confirmados_periodo: 52,
    pedidos_no_cancelados: 49,
    tasa_conversion_cohorte: '20.97',
    cobertura_formalizacion: {
      con_marca_temporal: 0,
      aproximadas_por_fecha: 248,
      anuladas_sin_evidencia_formalizacion: 12,
    },
    distribucion_proformas_estado: [{ codigo: 'APROBADA', nombre: 'Aprobada', cantidad: 52 }],
    distribucion_pedidos_estado: [{ codigo: 'ENTREGADO', nombre: 'Entregado', cantidad: 23 }],
    comparaciones_periodo_anterior: null,
    limitaciones: ['Aproximación histórica por proformas.fecha.'],
  },
  finanzas: {
    por_moneda: [
      {
        moneda: 'BOB',
        importe_pedidos_no_cancelados: '299468.87',
        cobros_validos_periodo: '184927.01',
        cobros_acumulados_cartera_vigente: '184927.01',
        saldo_pendiente: '114541.86',
        porcentaje_cobrado: '61.75',
      },
    ],
    cobros_pedidos_cancelados: [],
  },
  produccion: {
    ordenes_fabricacion_total: 31,
    ordenes_fabricacion_por_estado: [{ codigo: 'EN_PROCESO', nombre: 'En proceso', cantidad: 12 }],
    ordenes_tecnicas_total: 21,
    ordenes_tecnicas_por_estado: [{ codigo: 'TERMINADA', nombre: 'Terminada', cantidad: 15 }],
    fabricaciones_activas: 12,
    entregas_proximas: 7,
    entregas_retrasadas: 0,
    entregas_efectivas: 23,
    entregas_evaluables_plazo: 23,
    entregas_en_plazo: 23,
    cumplimiento_entregas_porcentaje: '100.00',
  },
  inventario: {
    total_activos: 37,
    con_stock: 31,
    bajo_pedido: 6,
    stock_bajo: 0,
    agotados: 3,
    sin_stock_minimo: 31,
  },
  alertas: {
    totales: {
      proformas_proximas_vencer: 1,
      pedidos_retrasados: 0,
      fabricaciones_retrasadas: 0,
      saldos_pedidos_entregados: 0,
      productos_stock_bajo: 3,
      productos_sin_stock_minimo: 31,
    },
    proformas_proximas_vencer: [
      {
        proforma_id: 10,
        numero: 101,
        cliente_nombre: 'Cliente Demo',
        vendedor_nombre: 'Alvaro Huallpa',
        fecha_vencimiento: '2026-11-29',
        dias_restantes: 2,
        moneda: 'BOB',
        total: '1500.00',
      },
    ],
    pedidos_retrasados: [],
    fabricaciones_retrasadas: [],
    saldos_pedidos_entregados_por_moneda: [],
    productos_stock_bajo: [],
    productos_sin_stock_minimo: [],
  },
}

const comercialPayload = {
  fecha_referencia: '2026-11-27',
  indicadores: resumenPayload.comercial,
  evolucion: {
    granularidad: 'mensual',
    puntos_conteo: [
      { periodo: '2026-10-01', proformas_formalizadas: 96, pedidos_generados: 20 },
      { periodo: '2026-11-01', proformas_formalizadas: 152, pedidos_generados: 32 },
    ],
    series_monetarias: [
      {
        moneda: 'BOB',
        puntos: [
          {
            periodo: '2026-10-01',
            importe_pedidos_no_cancelados: '100000.00',
            cobros_registrados: '80000.00',
          },
        ],
      },
    ],
  },
  vendedores: [
    {
      vendedor_id: 2,
      vendedor_nombre: 'Alvaro Huallpa',
      proformas_formalizadas: 124,
      pedidos_generados: 26,
      conversion_comercial: '20.97',
      vencidas_no_concretadas: 40,
      vencidas: 25,
      no_concretadas: 15,
      montos_por_moneda: [
        {
          moneda: 'BOB',
          importe_pedidos_no_cancelados: '170717.37',
          cobros_validos: '108585.01',
          saldo_pendiente: '62132.36',
        },
      ],
    },
  ],
}

const finanzasPayload = {
  por_moneda: resumenPayload.finanzas.por_moneda,
  cobros_pedidos_cancelados: [],
  pedidos_entregados_con_saldo: { total: 0, page: 1, page_size: 10, results: [] },
  clientes_mayores_saldos_por_moneda: [],
  evolucion_cobros: [],
}

const inventarioPayload = {
  resumen: resumenPayload.inventario,
  por_categoria: [
    {
      categoria_codigo: 'SILLA',
      categoria_nombre: 'Silla',
      total_activos: 20,
      con_stock: 20,
      bajo_pedido: 0,
      stock_bajo: 0,
      agotados: 3,
      sin_stock_minimo: 20,
    },
  ],
  existencias_por_unidad: [],
  movimientos_por_unidad: [],
  mas_vendidos: { total: 0, page: 1, page_size: 20, results: [] },
}

async function mountAdminResumen() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.identity = { id: 1, username: 'ana', display_name: 'Ana Admin' }
  session.capabilities = ['comercial.operar', 'comercial.administrar']
  session.entornoEvaluacion = true

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/resumen', component: ResumenView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push('/resumen')
  await router.isReady()
  const wrapper = mount(ResumenView, { global: { plugins: [pinia, router] } })
  await vi.waitFor(
    () => {
      expect(wrapper.find('select[aria-label="Selector de período"]').exists()).toBe(true)
    },
    { timeout: 5000 },
  )
  return wrapper
}

beforeEach(() => setActivePinia(createPinia()))

describe('Fase 2 AdminDashboard y formateadores analíticos', () => {
  it('calcula presets de período relativos a fecha_referencia y formatea en es-BO', () => {
    expect(buildPeriodPreset('este_mes', '2026-11-27')).toEqual({
      fecha_desde: '2026-11-01',
      fecha_hasta: '2026-11-27',
    })
    expect(buildPeriodPreset('mes_anterior', '2026-11-27')).toEqual({
      fecha_desde: '2026-10-01',
      fecha_hasta: '2026-10-31',
    })
    expect(formatMoney('299468.87', 'BOB')).toContain('Bs')
    expect(formatPercent(null)).toBe('No aplicable')
  })

  it('renderiza el dashboard administrativo con KPIs, pestañas, alertas consolidadas e inventario', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/administrador/', () =>
        HttpResponse.json(resumenPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/comercial/', () =>
        HttpResponse.json(comercialPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/finanzas/', () =>
        HttpResponse.json(finanzasPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/inventario/', () =>
        HttpResponse.json(inventarioPayload),
      ),
      http.get('http://localhost:8000/api/v1/catalogo/opciones/', () =>
        HttpResponse.json([
          { id: 12, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: 'CATEGORIA_PRODUCTO' },
        ]),
      ),
    )

    const wrapper = await mountAdminResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Proformas formalizadas')
    })

    expect(wrapper.text()).toContain('Resumen general')
    expect(wrapper.text()).not.toContain('Modo demostración')
    expect(wrapper.text()).toContain('248')
    expect(wrapper.text()).toContain('20,97 %')
    expect(wrapper.text()).toContain('Alertas prioritarias')
    expect(wrapper.text()).toContain('Proforma #101')

    await wrapper.get('button[role="tab"]:nth-of-type(2)').trigger('click')
    expect(wrapper.text()).toContain('Alvaro Huallpa')

    await wrapper.get('button[role="tab"]:nth-of-type(5)').trigger('click')
    expect(wrapper.text()).toContain('Productos activos')
    expect(wrapper.text()).toContain('No evaluable')
  })

  it('aísla el filtro de categoría de inventario sin alterar KPIs ni disparar resumen', async () => {
    let resumenCalls = 0
    let inventarioCalls = 0
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/administrador/', () => {
        resumenCalls += 1
        return HttpResponse.json(resumenPayload)
      }),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/comercial/', () =>
        HttpResponse.json(comercialPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/finanzas/', () =>
        HttpResponse.json(finanzasPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/inventario/', () => {
        inventarioCalls += 1
        return HttpResponse.json(inventarioPayload)
      }),
      http.get('http://localhost:8000/api/v1/catalogo/opciones/', () =>
        HttpResponse.json([
          { id: 12, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: 'CATEGORIA_PRODUCTO' },
        ]),
      ),
    )

    const wrapper = await mountAdminResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Proformas formalizadas')
    })

    const initialResumenCalls = resumenCalls
    const initialInventarioCalls = inventarioCalls

    await wrapper.get('button[role="tab"]:nth-of-type(5)').trigger('click')
    const select = wrapper.get('select[aria-label="Filtrar categoría de inventario"]')
    await select.setValue('SILLA')

    await vi.waitFor(() => {
      expect(inventarioCalls).toBe(initialInventarioCalls + 1)
      expect(wrapper.get('a.shortcut-link').attributes('href')).toContain('/productos?categoria=12')
    })
    expect(resumenCalls).toBe(initialResumenCalls)
    expect(wrapper.text()).toContain('248')
  })

  it('ignora respuestas asíncronas obsoletas que llegan fuera de orden', async () => {
    let callIdx = 0
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/administrador/', async () => {
        callIdx += 1
        if (callIdx === 1) {
          await new Promise((r) => setTimeout(r, 60))
          return HttpResponse.json({
            ...resumenPayload,
            comercial: { ...resumenPayload.comercial, proformas_formalizadas: 999 },
          })
        }
        return HttpResponse.json({
          ...resumenPayload,
          comercial: { ...resumenPayload.comercial, proformas_formalizadas: 123 },
        })
      }),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/comercial/', () =>
        HttpResponse.json(comercialPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/finanzas/', () =>
        HttpResponse.json(finanzasPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/inventario/', () =>
        HttpResponse.json(inventarioPayload),
      ),
    )

    const wrapper = await mountAdminResumen()
    await wrapper.get('select[aria-label="Selector de período"]').setValue('este_mes')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('123')
    })
    await new Promise((r) => setTimeout(r, 80))
    expect(wrapper.text()).toContain('123')
    expect(wrapper.text()).not.toContain('999')
  })

  it('aisla fallos parciales sin ocultar bloques exitosos ni mostrar alertas en cero', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/administrador/', () =>
        HttpResponse.json(resumenPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/comercial/', () =>
        HttpResponse.json(comercialPayload),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/finanzas/', () =>
        HttpResponse.json({ detail: 'Error temporal' }, { status: 503 }),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/administrador/inventario/', () =>
        HttpResponse.json(inventarioPayload),
      ),
    )

    const wrapper = await mountAdminResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Proformas formalizadas')
    })

    const text = wrapper.text()
    expect(text).toContain('Proformas formalizadas')
    expect(text).toContain('No disponible')
  })
})
