import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppSidebar from '@/app/layouts/AppSidebar.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import {
  buildCatalogTranscriptEvidence,
  buildFurnitureTranscriptEvidence,
} from '@/modules/capturas/voiceEvidence'
import PeriodFilterBar from '@/shared/analytics/PeriodFilterBar.vue'
import ExportExcelModal from '@/shared/download/ExportExcelModal.vue'
import { exportRangeError, exportTrayExcel } from '@/shared/download/exportExcel'

afterEach(() => vi.restoreAllMocks())

describe('HOMEX Fase 5.2 — Consistencia funcional y facilidad de uso', () => {
  it('muestra y actualiza la transcripción del dictado debajo de ImageGallery en ProductoForm', async () => {
    vi.spyOn(proformasService, 'families').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    vi.spyOn(proformasService, 'options').mockImplementation(async (key) => {
      const entries: Record<string, Array<{ id: number; codigo: string; nombre: string }>> = {
        CATEGORIA_PRODUCTO: [
          { id: 1, codigo: 'SILLA', nombre: 'Silla' },
          { id: 2, codigo: 'PISO_FLOTANTE', nombre: 'Piso flotante' },
          { id: 3, codigo: 'OTRO', nombre: 'Otro' },
        ],
        UNIDAD_MEDIDA: [{ id: 4, codigo: 'PIEZA', nombre: 'Pieza' }],
      }
      return (entries[key] ?? []).map((item) => ({ ...item, concepto_codigo: key }))
    })

    const w = mount(ProductoForm, {
      props: { preselectCategory: 'SILLA' },
      global: { stubs: { CapturaCatalogo: true } },
    })
    await flushPromises()
    expect(w.text()).not.toContain('Transcripción del dictado')

    await w.get('.voice-trigger').trigger('click')
    w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
      capture_id: 101,
      fields: { nombre: 'Silla ergonómica', precio_lista: '450' },
      text: 'Silla ergonómica a 450 bs para oficina',
      warnings: [],
      evidence: [
        {
          candidate_id: 'c1',
          label: 'nombre',
          start: 0,
          end: 16,
          text: 'Silla ergonómica',
          decision: 'ACCEPTED',
        },
        {
          candidate_id: 'c2',
          label: 'precio_lista',
          start: 19,
          end: 25,
          text: '450 bs',
          decision: 'UNRESOLVED',
          reason: 'Confirmar precio',
        },
      ],
      field_reviews: [
        {
          review_id: 'r-precio',
          code: 'REVIEW_PRICE',
          severity: 'REVIEW',
          message: 'Confirmar precio',
          field: 'precio_lista',
          evidence_ids: ['c2'],
        },
      ],
    })
    await flushPromises()

    expect(w.text()).toContain('Transcripción del dictado')
    expect(w.text()).toContain('Silla ergonómica a 450 bs para oficina')
    expect(w.find('mark.cat--conflict').text()).toBe('450 bs')

    await w.get('[name="precio"]').setValue('500')
    await flushPromises()
    expect(w.find('mark.cat--conflict').exists()).toBe(false)
    expect(w.find('mark.is-resolved').text()).toBe('450 bs')

    // Nueva captura reemplaza por completo la anterior
    await w.get('.voice-trigger').trigger('click')
    w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
      capture_id: 102,
      fields: { nombre: 'Silla ejecutiva', precio_lista: '600' },
      text: 'Silla ejecutiva en 600 bs',
      warnings: [],
      evidence: [],
      field_reviews: [],
    })
    await flushPromises()
    expect(w.text()).toContain('Silla ejecutiva en 600 bs')
    expect(w.text()).not.toContain('para oficina')
    w.unmount()
  })

  it('resalta números escritos en palabras y unidades sin marcar palabras de contexto como error', () => {
    const transcript =
      'Necesito dos escritorios de ciento cincuenta cm en mil quinientos bolivianos para gerencia'
    const evidence = buildFurnitureTranscriptEvidence(transcript, {
      comercial: {
        nombre: 'Escritorio',
        cantidad: 2,
        unidad_codigo: 'und',
        precio_unitario: 1500,
        descuento: 0,
      },
      especificacion: {
        datos_tecnicos: {
          caracteristicas_generales: {
            dimensiones: { ancho: { valor: 150, unidad: 'cm' } },
          },
        },
      },
    } as never)

    expect(evidence.some((e) => e.decision === 'REJECTED')).toBe(false)
    expect(
      evidence.some((e) => e.text === 'ciento cincuenta cm' && e.category === 'dimensions'),
    ).toBe(true)
    expect(
      evidence.some((e) => e.text === 'mil quinientos bolivianos' && e.category === 'commercial'),
    ).toBe(true)

    const catEvidence = buildCatalogTranscriptEvidence(
      'Silla negra para oficina',
      [{ start: 6, end: 11, text: 'negra', label: 'color_primario', decision: 'ACCEPTED' }],
      [],
    )
    expect(catEvidence).toHaveLength(1)
    expect(catEvidence[0]?.category).toBe('structure')
  })

  it('mantiene el orden exacto de la barra lateral y elimina Inventario', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }))
    setActivePinia(createPinia())
    const session = useSessionStore()
    session.identity = {
      id: 1,
      username: 'admin',
      display_name: 'Admin',
    }
    session.capabilities = ['comercial.operar', 'taller.operar', 'catalogo.crear_producto']

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/resumen')
    await router.isReady()

    const w = mount(AppSidebar, {
      props: { drawerOpen: true },
      global: { plugins: [router] },
    })
    const links = w.findAll('nav a').map((a) => a.text().trim())
    expect(links).toEqual([
      'Resumen',
      'Proformas',
      'Productos',
      'Movimientos de stock',
      'Pedidos',
      'Órdenes de trabajo',
      'Notas de entrega',
      'Recibos',
      'Clientes',
    ])
    expect(w.text().toLowerCase()).not.toContain('inventario')
    w.unmount()
  })

  it('valida calendarios en PeriodFilterBar y bloquea apply con rango inválido', async () => {
    const w = mount(PeriodFilterBar, {
      props: {
        fechaReferencia: '2026-11-26',
        fechaDesde: '2026-11-20',
        fechaHasta: '2026-11-10',
        granularidad: 'mensual',
        vendedores: [{ id: 1, nombre: 'Ana' }],
      },
    })
    expect(w.text()).toContain('Agrupar por')
    expect(w.text()).toContain('La fecha inicial no puede ser posterior a la fecha final.')
    await w.get('select[aria-label="Filtrar por vendedor"]').setValue('1')
    expect(w.emitted('apply')).toBeUndefined()
    w.unmount()
  })

  it('exige rango de fechas obligatorio en ExportExcelModal y exportTrayExcel', async () => {
    expect(exportRangeError('', '2026-11-26', '2026-11-26')).toContain('fecha inicial')
    expect(exportRangeError('2026-11-01', '', '2026-11-26')).toContain('fecha final')
    await expect(
      exportTrayExcel({
        endpoint: '/api/v1/proformas/exportar-excel/',
        prefix: 'proformas',
      }),
    ).rejects.toThrow(/fecha inicial/i)

    const w = mount(ExportExcelModal, {
      props: {
        open: true,
        prefix: 'proformas',
        filenameSegments: ['Aprobadas'],
        activeFilters: [{ label: 'Estado', value: 'Aprobadas' }],
      },
      global: { stubs: { Teleport: true } },
    })
    const exportBtn = w.findAll('button').find((b) => b.text().includes('Exportar Excel'))!
    expect(exportBtn.attributes('disabled')).toBeDefined()

    await w.get('input[name="export_fecha_desde"]').setValue('2026-11-01')
    await w.get('input[name="export_fecha_hasta"]').setValue('2026-11-26')
    await flushPromises()
    expect(w.text()).toContain('proformas_aprobadas_2026-11-01_a_2026-11-26.xlsx')
    const enabledExportBtn = w.findAll('button').find((b) => b.text().includes('Exportar Excel'))!
    expect(enabledExportBtn.attributes('disabled')).toBeUndefined()
    await enabledExportBtn.trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual([
      { fechaDesde: '2026-11-01', fechaHasta: '2026-11-26' },
    ])
    w.unmount()
  })
})
