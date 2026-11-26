import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  it('delega comercial.operar a TiendaDashboard y conserva estados de servicio', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/tienda/', () =>
        HttpResponse.json({
          fecha_referencia: '2026-11-27',
          vendedor_id: 2,
          indicadores: {
            total_proformas: 10,
            borradores: 2,
            proformas_formalizadas: 8,
            pedidos_generados: 2,
            pedidos_derivados_cohorte: 2,
            pedidos_no_cancelados_cohorte: 2,
            pedidos_confirmados_periodo: 2,
            pedidos_no_cancelados: 2,
            tasa_conversion_cohorte: '25.00',
            cobertura_formalizacion: {
              con_marca_temporal: 0,
              aproximadas_por_fecha: 8,
              anuladas_sin_evidencia_formalizacion: 0,
            },
            distribucion_proformas_estado: [],
            distribucion_pedidos_estado: [],
            comparaciones_periodo_anterior: null,
            limitaciones: [],
          },
          finanzas: { por_moneda: [], cobros_pedidos_cancelados: [] },
          evolucion: { granularidad: 'mensual', puntos_conteo: [], series_monetarias: [] },
        }),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/tienda/seguimiento/', () =>
        HttpResponse.json({
          fecha_referencia: '2026-11-27',
          vendedor_id: 2,
          agenda: {
            resumen_conteos: {
              proformas_proximas_vencer: 0,
              proformas_pendientes_revision: 0,
              proformas_enviadas: 0,
              pedidos_listos_entrega: 0,
              pedidos_con_saldo_pendiente: 0,
              entregas_proximas: 0,
              entregas_retrasadas: 0,
            },
            elementos: { total: 0, page: 1, page_size: 20, results: [] },
          },
          disponibilidad: {
            resumen: {
              total_activos: 0,
              con_stock_disponible: 0,
              con_stock_bajo: 0,
              con_stock_agotado: 0,
              bajo_pedido: 0,
              sin_stock_minimo: 0,
            },
            productos: { total: 0, page: 1, page_size: 20, results: [] },
          },
        }),
      ),
    )
    const seller = await render(['comercial.operar'])
    await vi.waitFor(
      () => {
        expect(seller.text()).toContain('Mi actividad comercial')
      },
      { timeout: 5000 },
    )
    expect(seller.text()).toContain('Nueva proforma')
    expect(seller.text()).toContain('Cotizar mediante voz')
    expect(seller.text()).not.toMatch(/99\.9|eficiencia|stock valorizado/i)
  })
  it('conserva la delegación de administrador y taller en ResumenView', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/administrador/*', () =>
        HttpResponse.json({
          fecha_referencia: '2026-11-27',
          comercial: {
            total_proformas: 0,
            borradores: 0,
            proformas_formalizadas: 0,
            pedidos_generados: 0,
            pedidos_derivados_cohorte: 0,
            pedidos_no_cancelados_cohorte: 0,
            pedidos_confirmados_periodo: 0,
            pedidos_no_cancelados: 0,
            tasa_conversion_cohorte: null,
            cobertura_formalizacion: {
              con_marca_temporal: 0,
              aproximadas_por_fecha: 0,
              anuladas_sin_evidencia_formalizacion: 0,
            },
            distribucion_proformas_estado: [],
            distribucion_pedidos_estado: [],
            comparaciones_periodo_anterior: null,
            limitaciones: [],
          },
          finanzas: { por_moneda: [], cobros_pedidos_cancelados: [] },
          produccion: {
            ordenes_fabricacion_total: 0,
            ordenes_fabricacion_por_estado: [],
            ordenes_tecnicas_total: 0,
            ordenes_tecnicas_por_estado: [],
            fabricaciones_activas: 0,
            entregas_proximas: 0,
            entregas_retrasadas: 0,
            entregas_efectivas: 0,
            entregas_evaluables_plazo: 0,
            entregas_en_plazo: 0,
            cumplimiento_entregas_porcentaje: null,
          },
          inventario: {
            total_activos: 0,
            con_stock: 0,
            bajo_pedido: 0,
            stock_bajo: 0,
            agotados: 0,
            sin_stock_minimo: 0,
          },
          alertas: {
            totales: {
              proformas_proximas_vencer: 0,
              pedidos_retrasados: 0,
              fabricaciones_retrasadas: 0,
              saldos_pedidos_entregados: 0,
              productos_stock_bajo: 0,
              productos_sin_stock_minimo: 0,
            },
            proformas_proximas_vencer: [],
            pedidos_retrasados: [],
            fabricaciones_retrasadas: [],
            saldos_pedidos_entregados_por_moneda: [],
            productos_stock_bajo: [],
            productos_sin_stock_minimo: [],
          },
          indicadores: {
            total_proformas: 0,
            borradores: 0,
            proformas_formalizadas: 0,
            pedidos_generados: 0,
            pedidos_derivados_cohorte: 0,
            pedidos_no_cancelados_cohorte: 0,
            pedidos_confirmados_periodo: 0,
            pedidos_no_cancelados: 0,
            tasa_conversion_cohorte: null,
            cobertura_formalizacion: {
              con_marca_temporal: 0,
              aproximadas_por_fecha: 0,
              anuladas_sin_evidencia_formalizacion: 0,
            },
            distribucion_proformas_estado: [],
            distribucion_pedidos_estado: [],
            comparaciones_periodo_anterior: null,
            limitaciones: [],
          },
          evolucion: { granularidad: 'mensual', puntos_conteo: [], series_monetarias: [] },
          vendedores: [],
          por_moneda: [],
          cobros_pedidos_cancelados: [],
          pedidos_entregados_con_saldo: { total: 0, page: 1, page_size: 10, results: [] },
          clientes_mayores_saldos_por_moneda: [],
          evolucion_cobros: [],
          resumen: {
            total_activos: 0,
            con_stock: 0,
            bajo_pedido: 0,
            stock_bajo: 0,
            agotados: 0,
            sin_stock_minimo: 0,
          },
          por_categoria: [],
          existencias_por_unidad: [],
          movimientos_por_unidad: [],
          mas_vendidos: { total: 0, page: 1, page_size: 20, results: [] },
        }),
      ),
    )
    const admin = await render(['comercial.operar', 'comercial.administrar'])
    await vi.waitFor(() => {
      expect(admin.text()).toContain('Resumen general')
    })
    expect(admin.text()).toContain('Supervisión administrativa')
  })
  it('presenta visión operativa de taller para JEFE_TALLER sin consultar proformas', async () => {
    let proformaCalls = 0
    server.use(
      http.get('http://localhost:8000/api/v1/proformas/', () => {
        proformaCalls += 1
        return HttpResponse.json({ detail: 'Forbidden' }, { status: 403 })
      }),
      http.get('http://localhost:8000/api/v1/dashboard/taller/', () =>
        HttpResponse.json({
          metadata: {
            generado_en: '2026-11-27T18:00:00Z',
            zona_horaria: 'America/La_Paz',
            fecha_corte: '2026-11-27',
            alcance_rol: 'taller',
          },
          filtros_aplicados: {
            fecha_desde: null,
            fecha_hasta: null,
            estado_ot: null,
            moneda: null,
            vendedor: null,
            familia_producto: null,
            agrupacion: 'month',
          },
          indicadores: {
            pendientes: 2,
            en_proceso: 12,
            terminadas: 16,
            canceladas: 2,
            carga_activa_fabricacion: 14,
            fabricaciones_iniciadas_periodo: 28,
            fabricaciones_terminadas_periodo: 16,
            tiempo_promedio_fabricacion_horas: 135.53,
            tiempo_promedio_fabricacion_dias: 5.65,
            ordenes_con_duracion_medible: 16,
            antiguedad_promedio_activas_dias: 14.08,
            antiguedad_maxima_activas_dias: 37,
            ordenes_con_antiguedad_medible: 12,
            entregas_proximas: 2,
            entregas_retrasadas: 0,
            entregas_efectivas: 13,
            entregas_evaluables_plazo: 13,
            entregas_en_plazo: 13,
            cumplimiento_entregas_porcentaje: '100.00',
          },
          cola_prioridades: [],
        }),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/taller/planificacion/', () =>
        HttpResponse.json({
          metadata: {
            generado_en: '2026-11-27T18:00:00Z',
            zona_horaria: 'America/La_Paz',
            fecha_corte: '2026-11-27',
            alcance_rol: 'taller',
          },
          filtros_aplicados: {
            fecha_desde: null,
            fecha_hasta: null,
            estado_ot: null,
            moneda: null,
            vendedor: null,
            familia_producto: null,
            agrupacion: 'month',
          },
          calendario: [],
          analisis_fabricacion: {
            distribucion_estados: [
              { estado_codigo: 'EN_PROCESO', estado_nombre: 'En proceso', cantidad: 12 },
            ],
            evolucion_fabricaciones: [{ periodo: '2026-11-01', iniciadas: 17, terminadas: 8 }],
            muebles_fabricados_por_tipo: [
              {
                tipo_mueble_codigo: 'CREDENZA',
                tipo_mueble_nombre: 'Credenza',
                ordenes: 7,
                piezas_fabricadas: 12,
              },
            ],
            cumplimiento_entregas: {
              entregas_efectivas: 13,
              entregas_evaluables_plazo: 13,
              entregas_en_plazo: 13,
              cumplimiento_entregas_porcentaje: '100.00',
              entregas_retrasadas: 0,
            },
          },
        }),
      ),
    )
    const workshop = await render(['taller.operar'])
    await vi.waitFor(() => expect(workshop.text()).toContain('Operación de taller'))
    expect(proformaCalls).toBe(0)
    expect(workshop.text()).toContain('Carga activa en taller')
    expect(workshop.findAll('.quick-actions a').map((x) => x.text())).toEqual([
      'Consultar órdenes de trabajo',
      'Ver fabricación a medida',
    ])
  })
  it('recupera métricas al reintentar en TiendaDashboard tras fallo inicial', async () => {
    let failing = true
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/tienda/', () =>
        failing
          ? HttpResponse.json({ detail: 'Error temporal' }, { status: 503 })
          : HttpResponse.json({
              fecha_referencia: '2026-11-27',
              vendedor_id: 2,
              indicadores: {
                total_proformas: 10,
                borradores: 2,
                proformas_formalizadas: 8,
                pedidos_generados: 2,
                pedidos_derivados_cohorte: 2,
                pedidos_no_cancelados_cohorte: 2,
                pedidos_confirmados_periodo: 2,
                pedidos_no_cancelados: 2,
                tasa_conversion_cohorte: '25.00',
                cobertura_formalizacion: {
                  con_marca_temporal: 0,
                  aproximadas_por_fecha: 8,
                  anuladas_sin_evidencia_formalizacion: 0,
                },
                distribucion_proformas_estado: [],
                distribucion_pedidos_estado: [],
                comparaciones_periodo_anterior: null,
                limitaciones: [],
              },
              finanzas: { por_moneda: [], cobros_pedidos_cancelados: [] },
              evolucion: { granularidad: 'mensual', puntos_conteo: [], series_monetarias: [] },
            }),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/tienda/seguimiento/', () =>
        HttpResponse.json({
          fecha_referencia: '2026-11-27',
          vendedor_id: 2,
          agenda: {
            resumen_conteos: {
              proformas_proximas_vencer: 0,
              proformas_pendientes_revision: 0,
              proformas_enviadas: 0,
              pedidos_listos_entrega: 0,
              pedidos_con_saldo_pendiente: 0,
              entregas_proximas: 0,
              entregas_retrasadas: 0,
            },
            elementos: { total: 0, page: 1, page_size: 20, results: [] },
          },
          disponibilidad: {
            resumen: {
              total_activos: 0,
              con_stock_disponible: 0,
              con_stock_bajo: 0,
              con_stock_agotado: 0,
              bajo_pedido: 0,
              sin_stock_minimo: 0,
            },
            productos: { total: 0, page: 1, page_size: 20, results: [] },
          },
        }),
      ),
    )
    const w = await render()
    await vi.waitFor(() => expect(w.text()).toContain('Reintentar'))
    failing = false
    const retry = w.findAll('button').find((button) => button.text().includes('Reintentar'))
    expect(retry).toBeDefined()
    await retry!.trigger('click')
    await vi.waitFor(() => expect(w.text()).toContain('Mis proformas formalizadas'))
  })
})
