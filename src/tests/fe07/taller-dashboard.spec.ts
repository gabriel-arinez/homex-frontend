import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResumenView from '@/modules/resumen/views/ResumenView.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { server } from '@/tests/msw/server'

const tallerResumen = {
  fecha_referencia: '2026-11-27',
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
  cola_prioridades: {
    total: 2,
    page: 1,
    page_size: 50,
    results: [
      {
        orden_trabajo_id: 31,
        numero_ot: 31,
        cliente_nombre: 'Mauricio Zamora',
        vendedor_nombre: 'Alvaro Huallpa',
        muebles_solicitados: [
          { nombre: 'Credenza ejecutiva', tipo_mueble: 'CREDENZA', cantidad: '2.0000' },
        ],
        estado_codigo: 'EN_PROCESO',
        estado_nombre: 'En proceso',
        pedido_estado_codigo: 'EN_PRODUCCION',
        fecha_prevista: '2026-12-01',
        dias_diferencia: 4,
        categoria_prioridad: 'ENTREGA_PROXIMA',
      },
      {
        orden_trabajo_id: 35,
        numero_ot: 35,
        cliente_nombre: 'Lucía Paredes',
        vendedor_nombre: 'Rodrigo Ramos',
        muebles_solicitados: [
          { nombre: 'Escritorio en L', tipo_mueble: 'ESCRITORIO', cantidad: '1.0000' },
        ],
        estado_codigo: 'PENDIENTE',
        estado_nombre: 'Pendiente',
        pedido_estado_codigo: 'CONFIRMADO',
        fecha_prevista: '2026-12-05',
        dias_diferencia: 8,
        categoria_prioridad: 'PENDIENTE_INICIAR',
      },
      {
        orden_trabajo_id: 36,
        numero_ot: 36,
        cliente_nombre: 'Carla Méndez',
        vendedor_nombre: 'Alvaro Huallpa',
        muebles_solicitados: [
          { nombre: 'Estante modular', tipo_mueble: 'ESTANTE', cantidad: '1.0000' },
        ],
        estado_codigo: 'TERMINADA',
        estado_nombre: 'Terminada',
        pedido_estado_codigo: 'EN_PRODUCCION',
        fecha_prevista: '2026-12-08',
        dias_diferencia: 11,
        categoria_prioridad: 'TERMINADA_PENDIENTE_AUTORIZACION',
      },
      {
        orden_trabajo_id: 37,
        numero_ot: 37,
        cliente_nombre: 'Jorge Rojas',
        vendedor_nombre: 'Rodrigo Ramos',
        muebles_solicitados: [{ nombre: 'Gavetero', tipo_mueble: 'GAVETERO', cantidad: '1.0000' }],
        estado_codigo: 'EN_PROCESO',
        estado_nombre: 'En proceso',
        pedido_estado_codigo: 'EN_PRODUCCION',
        fecha_prevista: null,
        dias_diferencia: null,
        categoria_prioridad: 'SIN_FECHA_ENTREGA',
      },
    ],
    resumen_conteos: {
      entrega_vencida: 0,
      entrega_proxima: 1,
      pendiente_iniciar: 1,
      terminada_pendiente_autorizacion: 1,
      sin_fecha_entrega: 1,
    },
  },
}

const tallerPlanificacion = {
  fecha_referencia: '2026-11-27',
  calendario_eventos: {
    total: 2,
    page: 1,
    page_size: 20,
    resumen_naturaleza: {
      total: 2,
      planificados: 1,
      efectivos: 1,
    },
    results: [
      {
        orden_trabajo_id: 31,
        numero_ot: 31,
        tipo_evento: 'ENTREGA_PREVISTA',
        naturaleza: 'PLANIFICADA',
        fecha: '2026-12-01',
        fecha_hora: null,
        cliente_nombre: 'Mauricio Zamora',
        estado_codigo: 'EN_PROCESO',
      },
      {
        orden_trabajo_id: 25,
        numero_ot: 25,
        tipo_evento: 'FIN_FABRICACION',
        naturaleza: 'EFECTIVA',
        fecha: '2026-11-18',
        fecha_hora: '2026-11-18T14:00:00-04:00',
        cliente_nombre: 'Roberto Lozano',
        estado_codigo: 'TERMINADA',
      },
    ],
  },
  analisis_fabricacion: {
    granularidad: 'mensual',
    evolucion_fabricaciones: [
      { periodo: '2026-10-01', iniciadas: 11, terminadas: 8 },
      { periodo: '2026-11-01', iniciadas: 17, terminadas: 8 },
    ],
    duracion_promedio_horas: 135.53,
    duracion_promedio_dias: 5.65,
    ordenes_con_duracion_medible: 16,
    muebles_fabricados_por_tipo: [
      {
        tipo_mueble_codigo: 'CREDENZA',
        tipo_mueble_nombre: 'Credenza',
        cantidad_fabricada: '12.0000',
        ordenes_count: 7,
      },
    ],
    distribucion_ordenes_estado: [
      { codigo: 'PENDIENTE', nombre: 'Pendiente', cantidad: 2 },
      { codigo: 'EN_PROCESO', nombre: 'En proceso', cantidad: 12 },
      { codigo: 'TERMINADA', nombre: 'Terminada', cantidad: 16 },
      { codigo: 'CANCELADA', nombre: 'Cancelada', cantidad: 2 },
    ],
  },
}

async function mountTallerResumen() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.identity = { id: 4, username: 'antonio.flores', display_name: 'Antonio Flores' }
  session.capabilities = ['taller.operar']
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

describe('Fase 4 TallerDashboard', () => {
  it('concilia métricas operativas, oculta montos/Corte y muestra Actualizar arriba a la derecha', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/taller/', ({ request }) => {
        const desde = new URL(request.url).searchParams.get('fecha_desde')
        if (desde === '2026-11-01') {
          return HttpResponse.json({
            ...tallerResumen,
            indicadores: {
              ...tallerResumen.indicadores,
              fabricaciones_iniciadas_periodo: 17,
              fabricaciones_terminadas_periodo: 8,
            },
          })
        }
        return HttpResponse.json(tallerResumen)
      }),
      http.get('http://localhost:8000/api/v1/dashboard/taller/planificacion/', () =>
        HttpResponse.json(tallerPlanificacion),
      ),
    )

    const wrapper = await mountTallerResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Carga activa en taller')
      expect(wrapper.text()).toContain('OT #31')
    })

    const text = wrapper.text()
    expect(text).toContain('Operación de taller')
    expect(text).toContain('14')
    expect(text).toContain('28')
    expect(text).toContain('5,65 d')
    expect(text).toContain('100,00 %')
    expect(text).not.toContain('Corte:')
    expect(text).not.toMatch(/\bBs\b|\$us|saldo pendiente/i)
    expect(wrapper.get('.header-actions').text()).toContain('Actualizar')

    // Cambio de período actualiza métricas
    await wrapper.get('select[aria-label="Selector de período"]').setValue('este_mes')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('17')
    })

    // Navegación por pestañas
    const clickTab = async (label: string) => {
      const btn = wrapper.findAll('button[role="tab"]').find((b) => b.text().includes(label))
      await btn!.trigger('click')
    }
    await clickTab('Producción y tiempos')
    expect(wrapper.text()).toContain('14,08 d')
    expect(wrapper.text()).toContain('37 d')

    await clickTab('Planificación y entregas')
    expect(wrapper.text()).toContain('Noviembre 2026')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OT #25')
    })

    // Navegación a diciembre y cambio a vista alternativa Listado de eventos
    await wrapper.get('button[aria-label="Mes siguiente"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Diciembre 2026')
    })

    const listadoBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Listado de eventos'))
    await listadoBtn!.trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Total conjunto: 2 eventos')
    })
    await wrapper.get('select[aria-label="Filtrar naturaleza de eventos"]').setValue('PLANIFICADA')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OT #31')
    })

    // Verifica que las 5 categorías reales de prioridades se muestran en la cola
    await clickTab('General')
    expect(wrapper.text()).toContain('Terminadas por autorizar')
    expect(wrapper.text()).toContain('Sin fecha de entrega')
  })

  it('valida rango de fechas con dateRangeError (histórico vs planificación futura) y aísla fallos parciales', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/taller/', () =>
        HttpResponse.json(tallerResumen),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/taller/planificacion/', () =>
        HttpResponse.json({ detail: 'Error planificación' }, { status: 503 }),
      ),
    )

    const wrapper = await mountTallerResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Carga activa en taller')
    })
    expect(wrapper.text()).toContain('Error planificación')

    await wrapper.get('input[aria-label="Fecha desde"]').setValue('2026-11-25')
    await wrapper.get('input[aria-label="Fecha hasta"]').setValue('2026-11-10')
    expect(wrapper.text()).toContain('La fecha inicial no puede ser posterior a la fecha final.')

    // Fecha futura bloqueada en filtro histórico
    await wrapper.get('input[aria-label="Fecha hasta"]').setValue('2026-12-15')
    expect(wrapper.text()).toContain('La fecha no puede ser futura.')
  })
})
