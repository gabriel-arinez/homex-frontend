import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResumenView from '@/modules/resumen/views/ResumenView.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { server } from '@/tests/msw/server'

const alvaroResumen = {
  fecha_referencia: '2026-11-27',
  vendedor_id: 2,
  indicadores: {
    total_proformas: 145,
    borradores: 13,
    proformas_formalizadas: 124,
    pedidos_generados: 26,
    pedidos_derivados_cohorte: 26,
    pedidos_no_cancelados_cohorte: 25,
    pedidos_confirmados_periodo: 26,
    pedidos_no_cancelados: 25,
    tasa_conversion_cohorte: '20.97',
    cobertura_formalizacion: {
      con_marca_temporal: 0,
      aproximadas_por_fecha: 124,
      anuladas_sin_evidencia_formalizacion: 8,
    },
    distribucion_proformas_estado: [
      { codigo: 'BORRADOR', nombre: 'Borrador', cantidad: 13 },
      { codigo: 'EN_REVISION', nombre: 'En revisión', cantidad: 11 },
      { codigo: 'ENVIADA', nombre: 'Enviada', cantidad: 4 },
      { codigo: 'APROBADA', nombre: 'Aprobada', cantidad: 26 },
      { codigo: 'VENCIDA', nombre: 'Vencida', cantidad: 50 },
      { codigo: 'NO_CONCRETADA', nombre: 'No concretada', cantidad: 33 },
    ],
    distribucion_pedidos_estado: [
      { codigo: 'CONFIRMADO', nombre: 'Confirmado', cantidad: 4 },
      { codigo: 'EN_PRODUCCION', nombre: 'En producción', cantidad: 6 },
      { codigo: 'LISTO_ENTREGA', nombre: 'Listo para entrega', cantidad: 4 },
      { codigo: 'ENTREGADO', nombre: 'Entregado', cantidad: 11 },
      { codigo: 'CANCELADO', nombre: 'Cancelado', cantidad: 1 },
    ],
    comparaciones_periodo_anterior: null,
    limitaciones: ['Aproximación histórica por proformas.fecha.'],
  },
  finanzas: {
    por_moneda: [
      {
        moneda: 'BOB',
        importe_pedidos_no_cancelados: '170717.37',
        cobros_validos_periodo: '108585.01',
        cobros_acumulados_cartera_vigente: '108585.01',
        saldo_pendiente: '62132.36',
        porcentaje_cobrado: '63.61',
      },
    ],
    cobros_pedidos_cancelados: [],
  },
  evolucion: {
    granularidad: 'mensual',
    puntos_conteo: [
      { periodo: '2026-10-01', proformas_formalizadas: 48, pedidos_generados: 10 },
      { periodo: '2026-11-01', proformas_formalizadas: 76, pedidos_generados: 16 },
    ],
    series_monetarias: [
      {
        moneda: 'BOB',
        puntos: [
          {
            periodo: '2026-10-01',
            importe_pedidos_no_cancelados: '70000.00',
            cobros_registrados: '50000.00',
          },
          {
            periodo: '2026-11-01',
            importe_pedidos_no_cancelados: '100717.37',
            cobros_registrados: '58585.01',
          },
        ],
      },
    ],
  },
}

const alvaroSeguimiento = {
  fecha_referencia: '2026-11-27',
  vendedor_id: 2,
  agenda: {
    resumen_conteos: {
      proformas_proximas_vencer: 1,
      proformas_pendientes_revision: 1,
      proformas_enviadas: 0,
      pedidos_listos_entrega: 1,
      pedidos_con_saldo_pendiente: 1,
      entregas_proximas: 1,
      entregas_retrasadas: 0,
    },
    elementos: {
      total: 4,
      page: 1,
      page_size: 20,
      results: [
        {
          tipo_documento: 'PROFORMA',
          documento_id: 486,
          proforma_id: 486,
          pedido_id: null,
          numero_documento: 486,
          cliente_nombre: 'Víctor Morales',
          fecha: '2026-12-02',
          estado_codigo: 'EN_REVISION',
          estado_nombre: 'En revisión',
          prioridad: 'MEDIA',
          categoria_agenda: 'PROFORMA_PROXIMA_VENCER',
          dias_diferencia: 5,
        },
        {
          tipo_documento: 'PEDIDO',
          documento_id: 88,
          proforma_id: 400,
          pedido_id: 88,
          numero_documento: 400,
          cliente_nombre: 'Elena Miranda',
          fecha: '2026-11-29',
          estado_codigo: 'LISTO_ENTREGA',
          estado_nombre: 'Listo para entrega',
          prioridad: 'ALTA',
          categoria_agenda: 'PEDIDO_LISTO_ENTREGA',
          dias_diferencia: 2,
        },
      ],
    },
  },
  disponibilidad: {
    resumen: {
      total_activos: 37,
      con_stock_disponible: 28,
      con_stock_bajo: 0,
      con_stock_agotado: 3,
      bajo_pedido: 6,
      sin_stock_minimo: 31,
    },
    por_categoria: [
      {
        categoria_codigo: 'SILLA',
        categoria_nombre: 'Silla',
        total_activos: 25,
        con_stock_disponible: 22,
        con_stock_bajo: 0,
        con_stock_agotado: 3,
        bajo_pedido: 0,
      },
      {
        categoria_codigo: 'PISO_FLOTANTE',
        categoria_nombre: 'Piso flotante',
        total_activos: 12,
        con_stock_disponible: 6,
        con_stock_bajo: 0,
        con_stock_agotado: 0,
        bajo_pedido: 6,
      },
    ],
    productos: {
      total: 2,
      page: 1,
      page_size: 20,
      results: [
        {
          producto_id: 1,
          sku: 'S-101',
          nombre: 'Silla Ejecutiva',
          categoria_codigo: 'SILLA',
          categoria_nombre: 'Silla',
          modalidad_abastecimiento: 'CON_STOCK',
          stock: '12.0000',
          stock_minimo: null,
          unidad_codigo: 'PIEZA',
          unidad_nombre: 'Pieza',
          estado_disponibilidad: 'DISPONIBLE',
          imagen_principal: {
            original: '/media/productos/s101/original.webp',
            ancho: 800,
            alto: 800,
            variantes: { '320': '/media/productos/s101/320.webp' },
          },
        },
        {
          producto_id: 2,
          sku: 'PF-201',
          nombre: 'Piso Flotante Roble',
          categoria_codigo: 'PISO_FLOTANTE',
          categoria_nombre: 'Piso flotante',
          modalidad_abastecimiento: 'BAJO_PEDIDO',
          stock: '0.0000',
          stock_minimo: null,
          unidad_codigo: 'M2',
          unidad_nombre: 'Metro cuadrado',
          estado_disponibilidad: 'BAJO_PEDIDO',
          imagen_principal: null,
        },
      ],
    },
  },
}

async function mountTiendaResumen(displayName = 'Alvaro Huallpa') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const session = useSessionStore()
  session.identity = { id: 2, username: 'alvaro.huallpa', display_name: displayName }
  session.capabilities = ['comercial.operar']
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

describe('Fase 3 TiendaDashboard', () => {
  it('concilia KPIs de vendedor, oculta selector de vendedores y muestra accesos rápidos', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/tienda/', () =>
        HttpResponse.json(alvaroResumen),
      ),
      http.get('http://localhost:8000/api/v1/dashboard/tienda/seguimiento/', ({ request }) => {
        const cat = new URL(request.url).searchParams.get('categoria_agenda')
        if (cat === 'PROFORMA_PENDIENTE_REVISION') {
          return HttpResponse.json({
            ...alvaroSeguimiento,
            agenda: {
              ...alvaroSeguimiento.agenda,
              elementos: {
                total: 1,
                page: 1,
                page_size: 5,
                results: [
                  {
                    tipo_documento: 'PROFORMA',
                    documento_id: 499,
                    proforma_id: 499,
                    pedido_id: null,
                    numero_documento: 499,
                    cliente_nombre: 'Cliente Página 2',
                    fecha: '2026-11-26',
                    estado_codigo: 'EN_REVISION',
                    estado_nombre: 'En revisión',
                    prioridad: 'MEDIA',
                    categoria_agenda: 'PROFORMA_PENDIENTE_REVISION',
                    dias_diferencia: 1,
                  },
                ],
              },
            },
          })
        }
        return HttpResponse.json(alvaroSeguimiento)
      }),
      http.get('http://localhost:8000/api/v1/catalogo/opciones/', () =>
        HttpResponse.json([
          { id: 12, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: 'CATEGORIA_PRODUCTO' },
        ]),
      ),
    )

    const wrapper = await mountTiendaResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Mis proformas formalizadas')
      expect(wrapper.text()).toContain('Proforma #486')
    })

    const text = wrapper.text()
    expect(text).toContain('Mi actividad comercial')
    expect(text).toContain('124')
    expect(text).toContain('26')
    expect(text).toContain('20,97 %')
    expect(text).toContain('170.717,37')
    expect(text).toContain('108.585,01')
    expect(text).toContain('62.132,36')
    expect(text).toContain('incidencias')
    expect(text).not.toContain('Corte:')
    expect(wrapper.get('.header-actions').text()).toContain('Actualizar')
    expect(wrapper.find('select[aria-label="Filtrar por vendedor"]').exists()).toBe(false)

    // Accesos rápidos
    const links = wrapper.findAll('.quick-actions a').map((a) => a.attributes('href'))
    expect(links).toEqual([
      '/proformas/nueva',
      '/proformas/nueva?voz=1',
      '/clientes/nuevo',
      '/productos',
    ])

    // Agenda por categoría (incluyendo registros que estaban fuera de la página 1 global)
    const revTab = wrapper
      .findAll('button[role="tab"]')
      .find((b) => b.text().includes('Proformas pendientes de revisión'))
    await revTab!.trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Proforma #499')
    })
  })

  it('navega por pestañas, aísla categoría en Disponibilidad y resuelve ID numérico', async () => {
    let resumenCalls = 0
    let segCalls = 0
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/tienda/', () => {
        resumenCalls += 1
        return HttpResponse.json(alvaroResumen)
      }),
      http.get('http://localhost:8000/api/v1/dashboard/tienda/seguimiento/', () => {
        segCalls += 1
        return HttpResponse.json(alvaroSeguimiento)
      }),
      http.get('http://localhost:8000/api/v1/catalogo/opciones/', () =>
        HttpResponse.json([
          { id: 12, codigo: 'SILLA', nombre: 'Silla', concepto_codigo: 'CATEGORIA_PRODUCTO' },
        ]),
      ),
    )

    const wrapper = await mountTiendaResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Mis proformas formalizadas')
    })
    const initialResumen = resumenCalls

    const clickTab = async (label: string) => {
      const btn = wrapper.findAll('button[role="tab"]').find((b) => b.text().includes(label))
      await btn!.trigger('click')
    }

    await clickTab('Proformas')
    expect(wrapper.text()).toContain('Vencidas y no concretadas')
    expect(wrapper.text()).toContain('83')

    await clickTab('Pedidos y cobros')
    expect(wrapper.text()).toContain('Pedidos, entregas y recaudación')

    await clickTab('Disponibilidad')
    expect(wrapper.text()).toContain('Silla Ejecutiva')
    expect(wrapper.text()).toContain('Bajo pedido')
    const prodImg = wrapper.get('.product-compact-thumb img')
    expect(prodImg.attributes('src')).toBe('http://localhost:8000/media/productos/s101/320.webp')

    const beforeCatSeg = segCalls
    await wrapper.get('select[aria-label="Filtrar categoría de disponibilidad"]').setValue('SILLA')
    await vi.waitFor(() => {
      expect(segCalls).toBeGreaterThan(beforeCatSeg)
      expect(wrapper.get('a.shortcut-link').attributes('href')).toContain('/productos?categoria=12')
    })
    expect(resumenCalls).toBe(initialResumen)
  })

  it('cambia cifras KPI al filtrar período, valida enlaces de pedidos reales y aísla errores por categoría', async () => {
    const agendaCatCalls: string[] = []
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/tienda/', ({ request }) => {
        const desde = new URL(request.url).searchParams.get('fecha_desde')
        if (desde === '2026-11-01') {
          return HttpResponse.json({
            ...alvaroResumen,
            indicadores: {
              ...alvaroResumen.indicadores,
              proformas_formalizadas: 76,
              pedidos_confirmados_periodo: 16,
              tasa_conversion_cohorte: '21.05',
            },
            finanzas: {
              por_moneda: [
                {
                  moneda: 'BOB',
                  importe_pedidos_no_cancelados: '126688.62',
                  cobros_validos_periodo: '75146.26',
                  cobros_acumulados_cartera_vigente: '75146.26',
                  saldo_pendiente: '51542.36',
                  porcentaje_cobrado: '59.32',
                },
              ],
              cobros_pedidos_cancelados: [],
            },
          })
        }
        return HttpResponse.json(alvaroResumen)
      }),
      http.get('http://localhost:8000/api/v1/dashboard/tienda/seguimiento/', ({ request }) => {
        const url = new URL(request.url)
        const cat = url.searchParams.get('categoria_agenda')
        if (cat) agendaCatCalls.push(cat)
        if (cat === 'PEDIDO_SALDO_PENDIENTE') {
          return HttpResponse.json({
            ...alvaroSeguimiento,
            agenda: {
              ...alvaroSeguimiento.agenda,
              elementos: {
                total: 1,
                page: 1,
                page_size: 5,
                results: [
                  {
                    tipo_documento: 'PEDIDO',
                    documento_id: 103,
                    proforma_id: 546,
                    pedido_id: 103,
                    numero_documento: 546,
                    cliente_nombre: 'Cliente Saldo Real',
                    fecha: '2026-11-20',
                    estado_codigo: 'CONFIRMADO',
                    estado_nombre: 'Confirmado',
                    prioridad: 'MEDIA',
                    categoria_agenda: 'PEDIDO_SALDO_PENDIENTE',
                    dias_diferencia: null,
                    moneda: 'BOB',
                    saldo_pendiente: '11343.00',
                  },
                ],
              },
            },
          })
        }
        if (cat === 'ENTREGA_PROXIMA') {
          return HttpResponse.json({ detail: 'Error categoría entregas' }, { status: 503 })
        }
        return HttpResponse.json(alvaroSeguimiento)
      }),
    )

    const wrapper = await mountTiendaResumen()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('170.717,37')
      expect(agendaCatCalls).toContain('PEDIDO_SALDO_PENDIENTE')
    })

    // Cambio de período actualiza KPIs reales
    await wrapper.get('select[aria-label="Selector de período"]').setValue('este_mes')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('76')
      expect(wrapper.text()).toContain('126.688,62')
    })

    // Enlace de pedido usa pedido_id (103) y nunca proforma_id (546), y muestra error en categoría fallida
    const clickTab = async (label: string) => {
      const btn = wrapper.findAll('button[role="tab"]').find((b) => b.text().includes(label))
      await btn!.trigger('click')
    }
    await clickTab('Pedidos y cobros')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Pedido #103 (Prof. #546)')
    })
    const pedLink = wrapper.findAll('a.table-link').find((a) => a.text().includes('Pedido #103'))
    expect(pedLink?.attributes('href')).toBe('/pedidos/103')
    expect(wrapper.text()).toContain('11.343,00')
    expect(wrapper.text()).toContain('Error categoría entregas')
  })

  it('aísla fallos parciales y descarta respuestas obsoletas fuera de orden', async () => {
    let call = 0
    server.use(
      http.get('http://localhost:8000/api/v1/dashboard/tienda/', async () => {
        call += 1
        if (call === 1) {
          await new Promise((r) => setTimeout(r, 60))
          return HttpResponse.json({
            ...alvaroResumen,
            indicadores: { ...alvaroResumen.indicadores, proformas_formalizadas: 999 },
          })
        }
        return HttpResponse.json({
          ...alvaroResumen,
          indicadores: { ...alvaroResumen.indicadores, proformas_formalizadas: 124 },
        })
      }),
      http.get('http://localhost:8000/api/v1/dashboard/tienda/seguimiento/', () =>
        HttpResponse.json({ detail: 'Servicio no disponible' }, { status: 503 }),
      ),
    )

    const wrapper = await mountTiendaResumen()
    await wrapper.get('select[aria-label="Selector de período"]').setValue('este_mes')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('124')
    })
    await new Promise((r) => setTimeout(r, 80))
    expect(wrapper.text()).toContain('124')
    expect(wrapper.text()).not.toContain('999')
    expect(wrapper.text()).toContain('No disponible')
  })
})
