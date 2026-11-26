<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  AlertTriangle,
  AudioLines,
  Banknote,
  Boxes,
  ClipboardCheck,
  Clock,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  TrendingUp,
  UserPlus,
  Wallet,
} from '@lucide/vue'
import type {
  DashboardTiendaResumen,
  DashboardTiendaSeguimiento,
  ElementoAgendaComercial,
  ProductoDisponibilidad,
  ValorCatalogoPublico,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { proformasService } from '@/modules/proformas/services/proformasService'
import Badge from '@/shared/ui/Badge.vue'
import Card from '@/shared/ui/Card.vue'
import DetailTabs, { type DetailTabItem } from '@/shared/ui/DetailTabs.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import type { AlertRowItem } from '@/shared/analytics/AlertListCard.vue'
import AnalyticsTableCard from '@/shared/analytics/AnalyticsTableCard.vue'
import BarChartCard from '@/shared/analytics/BarChartCard.vue'
import DonutChartCard from '@/shared/analytics/DonutChartCard.vue'
import LineAreaChartCard from '@/shared/analytics/LineAreaChartCard.vue'
import MetricKpiCard from '@/shared/analytics/MetricKpiCard.vue'
import PeriodFilterBar from '@/shared/analytics/PeriodFilterBar.vue'
import PriorityAlertsPanel, {
  type PriorityAlertCategory,
} from '@/shared/analytics/PriorityAlertsPanel.vue'
import StateDistributionCard from '@/shared/analytics/StateDistributionCard.vue'
import {
  formatDateLaPaz,
  formatInteger,
  formatMoney,
  formatPercent,
  formatPeriodLabel,
  formatQuantity,
  formatTimeLaPaz,
  toNumber,
} from '@/shared/analytics/formatters'
import {
  tiendaDashboardService,
  type AgendaCategoriaCodigo,
} from '../services/tiendaDashboardService'

type TiendaTabId = 'general' | 'proformas' | 'pedidos' | 'disponibilidad'

interface ProductImagePayload {
  original?: string | null
  variantes?: Record<string, string> | null
}

const AGENDA_CATEGORIES: Array<{
  key: AgendaCategoriaCodigo
  label: string
  viewAllTo: string
  viewAllLabel: string
  emptyDescription: string
}> = [
  {
    key: 'PROFORMA_PROXIMA_VENCER',
    label: 'Proformas próximas a vencer',
    viewAllTo: '/proformas',
    viewAllLabel: 'Ver proformas',
    emptyDescription: 'No tienes proformas próximas a vencer en los siguientes 7 días.',
  },
  {
    key: 'PROFORMA_PENDIENTE_REVISION',
    label: 'Proformas pendientes de revisión',
    viewAllTo: '/proformas?estado=EN_REVISION',
    viewAllLabel: 'Revisar proformas',
    emptyDescription: 'No tienes proformas pendientes de revisión.',
  },
  {
    key: 'PEDIDO_LISTO_ENTREGA',
    label: 'Pedidos listos para entrega',
    viewAllTo: '/pedidos?estado=LISTO_ENTREGA',
    viewAllLabel: 'Ver listos para entrega',
    emptyDescription: 'No hay pedidos listos pendientes de entrega.',
  },
  {
    key: 'PEDIDO_SALDO_PENDIENTE',
    label: 'Pedidos con saldo pendiente',
    viewAllTo: '/pedidos',
    viewAllLabel: 'Ver pedidos',
    emptyDescription: 'Tus pedidos activos no presentan saldos pendientes.',
  },
  {
    key: 'ENTREGA_PROXIMA',
    label: 'Entregas próximas',
    viewAllTo: '/pedidos',
    viewAllLabel: 'Ver pedidos',
    emptyDescription: 'No hay entregas programadas en los próximos 7 días.',
  },
  {
    key: 'ENTREGA_RETRASADA',
    label: 'Entregas retrasadas',
    viewAllTo: '/pedidos',
    viewAllLabel: 'Ver pedidos',
    emptyDescription: 'No registras entregas retrasadas.',
  },
]

const emit = defineEmits<{ 'open-menu': [] }>()
const session = useSessionStore()

const activeTab = ref<TiendaTabId>('general')
const fechaDesde = ref<string | null>(null)
const fechaHasta = ref<string | null>(null)
const granularidad = ref<'diaria' | 'semanal' | 'mensual'>('mensual')
const moneda = ref<string>('')
const categoriaLocal = ref<string>('')

const resumen = ref<DashboardTiendaResumen | null>(null)
const seguimiento = ref<DashboardTiendaSeguimiento | null>(null)
const agendaBuckets = ref<Partial<Record<AgendaCategoriaCodigo, ElementoAgendaComercial[]>>>({})

const loadingResumen = ref(true)
const loadingSeguimiento = ref(true)
const errorResumen = ref('')
const errorSeguimiento = ref('')

const lastUpdatedText = ref('')
const catalogCategories = ref<ValorCatalogoPublico[]>([])
const activeMoneyChartCurrency = ref<string>('BOB')
const activeDonutCurrency = ref<string>('BOB')

let resumenCtrl: AbortController | null = null
let seguimientoCtrl: AbortController | null = null
let agendaCtrl: AbortController | null = null
let resumenSeq = 0
let seguimientoSeq = 0
let agendaSeq = 0

const vendorName = computed(() => session.identity?.display_name ?? 'Encargado de tienda')

const scopeDescription = computed(() => `Gestión comercial personal de ${vendorName.value}.`)

const fechaReferencia = computed(
  () => resumen.value?.fecha_referencia ?? seguimiento.value?.fecha_referencia ?? null,
)

const hasPeriodFilter = computed(() => Boolean(fechaDesde.value && fechaHasta.value))

const periodScopeLabel = computed(() => {
  if (fechaDesde.value && fechaHasta.value) {
    return `${formatDateLaPaz(fechaDesde.value)} – ${formatDateLaPaz(fechaHasta.value)}`
  }
  return 'Todo el histórico'
})

const anyLoading = computed(() => loadingResumen.value || loadingSeguimiento.value)

const availableCurrencies = computed(() => {
  const set = new Set<string>(['BOB', 'USD'])
  for (const m of resumen.value?.finanzas.por_moneda ?? []) set.add(m.moneda)
  for (const s of resumen.value?.evolucion.series_monetarias ?? []) set.add(s.moneda)
  return Array.from(set)
})

const categoryOptions = computed(() => {
  if (catalogCategories.value.length) {
    return catalogCategories.value.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
    }))
  }
  const map = new Map<string, string>()
  for (const p of seguimiento.value?.disponibilidad.productos.results ?? []) {
    if (!map.has(p.categoria_codigo)) map.set(p.categoria_codigo, p.categoria_nombre)
  }
  return Array.from(map.entries()).map(([codigo, nombre]) => ({
    id: null as number | null,
    codigo,
    nombre,
  }))
})

const productosTargetRoute = computed(() => {
  if (!categoriaLocal.value) return '/productos'
  const match = catalogCategories.value.find((c) => c.codigo === categoriaLocal.value)
  if (match) return { path: '/productos', query: { categoria: String(match.id) } }
  return '/productos'
})

const staleBlocks = computed(() => {
  const items: string[] = []
  if (errorResumen.value && resumen.value) items.push(`Actividad (${errorResumen.value})`)
  if (errorSeguimiento.value && seguimiento.value) {
    items.push(`Agenda y disponibilidad (${errorSeguimiento.value})`)
  }
  return items
})

async function fetchResumen() {
  const seq = ++resumenSeq
  resumenCtrl?.abort()
  const controller = new AbortController()
  resumenCtrl = controller
  loadingResumen.value = true
  errorResumen.value = ''
  try {
    const data = await tiendaDashboardService.getResumen(
      {
        fecha_desde: fechaDesde.value,
        fecha_hasta: fechaHasta.value,
        granularidad: granularidad.value,
        moneda: moneda.value || null,
      },
      controller.signal,
    )
    if (seq !== resumenSeq) return
    resumen.value = data
    const firstCurrency = data.finanzas.por_moneda[0]?.moneda
    if (
      firstCurrency &&
      !data.finanzas.por_moneda.some((m) => m.moneda === activeDonutCurrency.value)
    ) {
      activeDonutCurrency.value = firstCurrency
    }
  } catch (err) {
    if (seq !== resumenSeq || (err as { name?: string })?.name === 'AbortError') return
    errorResumen.value =
      err instanceof Error ? err.message : 'No se pudo cargar tu actividad comercial.'
  } finally {
    if (seq === resumenSeq) loadingResumen.value = false
  }
}

async function fetchAgendaBuckets(base: DashboardTiendaSeguimiento) {
  const seq = ++agendaSeq
  agendaCtrl?.abort()
  const controller = new AbortController()
  agendaCtrl = controller

  const counts = base.agenda.resumen_conteos
  const countMap: Record<AgendaCategoriaCodigo, number> = {
    PROFORMA_PROXIMA_VENCER: counts.proformas_proximas_vencer,
    PROFORMA_PENDIENTE_REVISION: counts.proformas_pendientes_revision,
    PROFORMA_ENVIADA: counts.proformas_enviadas,
    PEDIDO_LISTO_ENTREGA: counts.pedidos_listos_entrega,
    PEDIDO_SALDO_PENDIENTE: counts.pedidos_con_saldo_pendiente,
    ENTREGA_PROXIMA: counts.entregas_proximas,
    ENTREGA_RETRASADA: counts.entregas_retrasadas,
  }

  const nextBuckets: Partial<Record<AgendaCategoriaCodigo, ElementoAgendaComercial[]>> = {}
  for (const cat of AGENDA_CATEGORIES) {
    nextBuckets[cat.key] = base.agenda.elementos.results
      .filter((el) => el.categoria_agenda === cat.key)
      .slice(0, 5)
  }
  agendaBuckets.value = nextBuckets

  const activeKeys = AGENDA_CATEGORIES.map((c) => c.key).filter((key) => countMap[key] > 0)
  if (!activeKeys.length) return

  const results = await Promise.allSettled(
    activeKeys.map(async (catKey) => {
      const resp = await tiendaDashboardService.getSeguimiento(
        {
          moneda: moneda.value || null,
          categoria_agenda: catKey,
          page_size: 5,
        },
        controller.signal,
      )
      return [catKey, resp.agenda.elementos.results.slice(0, 5)] as const
    }),
  )
  if (seq !== agendaSeq || controller.signal.aborted) return

  const updated = { ...agendaBuckets.value }
  for (const res of results) {
    if (res.status === 'fulfilled') {
      const [key, items] = res.value
      updated[key] = items
    }
  }
  agendaBuckets.value = updated
}

async function fetchSeguimiento() {
  const seq = ++seguimientoSeq
  seguimientoCtrl?.abort()
  const controller = new AbortController()
  seguimientoCtrl = controller
  loadingSeguimiento.value = true
  errorSeguimiento.value = ''
  try {
    const data = await tiendaDashboardService.getSeguimiento(
      {
        moneda: moneda.value || null,
        categoria: categoriaLocal.value || null,
        page_size: 20,
      },
      controller.signal,
    )
    if (seq !== seguimientoSeq) return
    seguimiento.value = data
    void fetchAgendaBuckets(data)
  } catch (err) {
    if (seq !== seguimientoSeq || (err as { name?: string })?.name === 'AbortError') return
    errorSeguimiento.value =
      err instanceof Error ? err.message : 'No se pudo cargar agenda y disponibilidad.'
  } finally {
    if (seq === seguimientoSeq) loadingSeguimiento.value = false
  }
}

async function loadCatalogCategories() {
  try {
    const items = await proformasService.options('CATEGORIA_PRODUCTO')
    catalogCategories.value = items.filter((item) => item.concepto_codigo === 'CATEGORIA_PRODUCTO')
  } catch {
    // Fallback to categories extracted from disponibilidad
  }
}

async function loadAll() {
  if (fechaDesde.value && fechaHasta.value && fechaDesde.value > fechaHasta.value) {
    return
  }
  await Promise.all([fetchResumen(), fetchSeguimiento()])
  if (!errorResumen.value || !errorSeguimiento.value) {
    lastUpdatedText.value = formatTimeLaPaz(new Date())
  }
}

function onCategoryChange() {
  void fetchSeguimiento()
}

onMounted(() => {
  void loadCatalogCategories()
  void loadAll()
})

onBeforeUnmount(() => {
  resumenCtrl?.abort()
  seguimientoCtrl?.abort()
  agendaCtrl?.abort()
})

// Indicadores principales
const ind = computed(() => resumen.value?.indicadores ?? null)
const finMonedas = computed(() => resumen.value?.finanzas.por_moneda ?? [])
const primaryFin = computed(() => {
  if (moneda.value) {
    return finMonedas.value.find((m) => m.moneda === moneda.value) ?? finMonedas.value[0] ?? null
  }
  return finMonedas.value[0] ?? null
})
const hasApproximateCohort = computed(
  () => (ind.value?.cobertura_formalizacion.aproximadas_por_fecha ?? 0) > 0,
)
const compAnterior = computed(() => ind.value?.comparaciones_periodo_anterior ?? null)

const secondaryFinSummary = computed(() => {
  const others = finMonedas.value.filter((m) => m.moneda !== primaryFin.value?.moneda)
  if (!others.length) return ''
  return others
    .map((m) => `${m.moneda}: ${formatMoney(m.importe_pedidos_no_cancelados, m.moneda)}`)
    .join(' · ')
})

// Conteos de estado actual
function stateCount(
  items: Array<{ codigo: string; cantidad: number }> | undefined,
  codigo: string,
): number | null {
  if (!items) return null
  return items.find((x) => x.codigo === codigo)?.cantidad ?? 0
}

const proformasBorradores = computed(() => ind.value?.borradores ?? null)
const proformasRevision = computed(() =>
  stateCount(ind.value?.distribucion_proformas_estado, 'EN_REVISION'),
)
const proformasEnviadas = computed(() =>
  stateCount(ind.value?.distribucion_proformas_estado, 'ENVIADA'),
)
const proformasVencidasNoConcretadas = computed(() => {
  const dist = ind.value?.distribucion_proformas_estado
  if (!dist) return null
  const vencidas = stateCount(dist, 'VENCIDA') ?? 0
  const noConcretadas = stateCount(dist, 'NO_CONCRETADA') ?? 0
  return vencidas + noConcretadas
})

const pedidosConfirmados = computed(() =>
  stateCount(ind.value?.distribucion_pedidos_estado, 'CONFIRMADO'),
)
const pedidosProduccion = computed(() =>
  stateCount(ind.value?.distribucion_pedidos_estado, 'EN_PRODUCCION'),
)
const pedidosListos = computed(() =>
  stateCount(ind.value?.distribucion_pedidos_estado, 'LISTO_ENTREGA'),
)
const pedidosEntregados = computed(() =>
  stateCount(ind.value?.distribucion_pedidos_estado, 'ENTREGADO'),
)
const pedidosCancelados = computed(() =>
  stateCount(ind.value?.distribucion_pedidos_estado, 'CANCELADO'),
)

// Evolución comercial personal
const evoConteoLabels = computed(
  () =>
    resumen.value?.evolucion.puntos_conteo.map((p) =>
      formatPeriodLabel(p.periodo, granularidad.value),
    ) ?? [],
)
const evoConteoSeries = computed(() => {
  const pts = resumen.value?.evolucion.puntos_conteo ?? []
  if (!pts.length) return []
  return [
    {
      name: 'Proformas formalizadas',
      data: pts.map((p) => p.proformas_formalizadas),
      colorKey: 'info' as const,
    },
    {
      name: 'Pedidos confirmados',
      data: pts.map((p) => p.pedidos_generados),
      colorKey: 'primary' as const,
    },
  ]
})

const availableEvoCurrencies = computed(
  () => resumen.value?.evolucion.series_monetarias.map((s) => s.moneda) ?? [],
)
const selectedEvoCurrency = computed(() => {
  if (moneda.value) return moneda.value
  if (availableEvoCurrencies.value.includes(activeMoneyChartCurrency.value)) {
    return activeMoneyChartCurrency.value
  }
  return availableEvoCurrencies.value[0] ?? 'BOB'
})
const evoMonetariaSerie = computed(() =>
  resumen.value?.evolucion.series_monetarias.find((s) => s.moneda === selectedEvoCurrency.value),
)
const evoMoneyLabels = computed(
  () =>
    evoMonetariaSerie.value?.puntos.map((p) => formatPeriodLabel(p.periodo, granularidad.value)) ??
    [],
)
const evoMoneySeries = computed(() => {
  const pts = evoMonetariaSerie.value?.puntos ?? []
  if (!pts.length) return []
  return [
    {
      name: `Importe pedidos vigentes (${selectedEvoCurrency.value})`,
      data: pts.map((p) => toNumber(p.importe_pedidos_no_cancelados) ?? 0),
      colorKey: 'primary' as const,
      area: true,
    },
    {
      name: `Cobros registrados (${selectedEvoCurrency.value})`,
      data: pts.map((p) => toNumber(p.cobros_registrados) ?? 0),
      colorKey: 'success' as const,
      area: true,
    },
  ]
})

// Finanzas anillo
const donutCurrency = computed(() => {
  if (moneda.value) return moneda.value
  return activeDonutCurrency.value
})
const donutMonedaRow = computed(
  () =>
    finMonedas.value.find((m) => m.moneda === donutCurrency.value) ?? finMonedas.value[0] ?? null,
)
const donutSlices = computed(() => {
  if (!donutMonedaRow.value) return []
  const cobrado = Math.max(0, toNumber(donutMonedaRow.value.cobros_acumulados_cartera_vigente) ?? 0)
  const saldo = Math.max(0, toNumber(donutMonedaRow.value.saldo_pendiente) ?? 0)
  if (cobrado === 0 && saldo === 0) return []
  return [
    { name: 'Cobros acumulados', value: cobrado, colorKey: 'success' as const },
    { name: 'Saldo pendiente', value: saldo, colorKey: 'warning' as const },
  ]
})

// Agenda comercial
function mapAgendaRow(el: ElementoAgendaComercial): AlertRowItem {
  const isProforma = el.tipo_documento === 'PROFORMA'
  const to = isProforma
    ? `/proformas/${el.proforma_id}`
    : `/pedidos/${el.pedido_id ?? el.documento_id}`
  const docLabel = isProforma
    ? `Proforma #${el.numero_documento}`
    : `Pedido Prof. #${el.numero_documento}`
  const parts: string[] = [el.estado_nombre, formatDateLaPaz(el.fecha)]

  let badge = el.estado_nombre
  let tone: AlertRowItem['tone'] = 'info'

  if (el.categoria_agenda === 'PROFORMA_PROXIMA_VENCER') {
    badge = el.dias_diferencia === 0 ? 'Vence hoy' : `${el.dias_diferencia ?? 0} d`
    tone = (el.dias_diferencia ?? 0) <= 2 ? 'danger' : 'warning'
  } else if (el.categoria_agenda === 'PROFORMA_PENDIENTE_REVISION') {
    badge = `${el.dias_diferencia ?? 0} d en rev.`
    tone = 'warning'
  } else if (el.categoria_agenda === 'PEDIDO_LISTO_ENTREGA') {
    badge = el.dias_diferencia !== null ? `${el.dias_diferencia} d` : 'Listo'
    tone = 'info'
  } else if (el.categoria_agenda === 'PEDIDO_SALDO_PENDIENTE') {
    badge = formatMoney(el.saldo_pendiente ?? null, el.moneda ?? 'BOB')
    tone = el.estado_codigo === 'ENTREGADO' ? 'danger' : 'warning'
  } else if (el.categoria_agenda === 'ENTREGA_PROXIMA') {
    badge = el.dias_diferencia === 0 ? 'Hoy' : `En ${el.dias_diferencia ?? 0} d`
    tone = (el.dias_diferencia ?? 0) <= 2 ? 'warning' : 'info'
  } else if (el.categoria_agenda === 'ENTREGA_RETRASADA') {
    badge = `${el.dias_diferencia ?? 0} d retraso`
    tone = 'danger'
  }

  return {
    id: `${el.categoria_agenda}-${el.tipo_documento}-${el.documento_id}`,
    title: `${docLabel} · ${el.cliente_nombre}`,
    subtitle: parts.join(' · '),
    badge,
    tone,
    to,
  }
}

const agendaCounts = computed(() => seguimiento.value?.agenda.resumen_conteos ?? null)

const totalAgendaIncidencias = computed(() => {
  if (!agendaCounts.value) return null
  const c = agendaCounts.value
  return (
    c.proformas_proximas_vencer +
    c.proformas_pendientes_revision +
    c.pedidos_listos_entrega +
    c.pedidos_con_saldo_pendiente +
    c.entregas_proximas +
    c.entregas_retrasadas
  )
})

const agendaCategories = computed<PriorityAlertCategory[]>(() => {
  if (!agendaCounts.value) return []
  const c = agendaCounts.value
  const totals: Record<AgendaCategoriaCodigo, number> = {
    PROFORMA_PROXIMA_VENCER: c.proformas_proximas_vencer,
    PROFORMA_PENDIENTE_REVISION: c.proformas_pendientes_revision,
    PROFORMA_ENVIADA: c.proformas_enviadas,
    PEDIDO_LISTO_ENTREGA: c.pedidos_listos_entrega,
    PEDIDO_SALDO_PENDIENTE: c.pedidos_con_saldo_pendiente,
    ENTREGA_PROXIMA: c.entregas_proximas,
    ENTREGA_RETRASADA: c.entregas_retrasadas,
  }
  return AGENDA_CATEGORIES.map((cfg) => ({
    key: cfg.key,
    label: cfg.label,
    totalCount: totals[cfg.key],
    items: (agendaBuckets.value[cfg.key] ?? []).map(mapAgendaRow),
    viewAllTo: cfg.viewAllTo,
    viewAllLabel: cfg.viewAllLabel,
    emptyDescription: cfg.emptyDescription,
  }))
})

const pedidosSaldoRows = computed(() => agendaBuckets.value.PEDIDO_SALDO_PENDIENTE ?? [])
const pedidosEntregadosConSaldoRows = computed(() =>
  pedidosSaldoRows.value.filter((p) => p.estado_codigo === 'ENTREGADO'),
)
const entregasProximasRows = computed(() => agendaBuckets.value.ENTREGA_PROXIMA ?? [])
const entregasRetrasadasRows = computed(() => agendaBuckets.value.ENTREGA_RETRASADA ?? [])

// Disponibilidad comercial
const dispResumen = computed(() => seguimiento.value?.disponibilidad.resumen ?? null)
const dispProductos = computed(() => seguimiento.value?.disponibilidad.productos.results ?? [])

const dispCategorySummary = computed(() => {
  const map = new Map<
    string,
    { nombre: string; disponible: number; bajoPedido: number; agotado: number }
  >()
  for (const p of dispProductos.value) {
    let entry = map.get(p.categoria_codigo)
    if (!entry) {
      entry = { nombre: p.categoria_nombre, disponible: 0, bajoPedido: 0, agotado: 0 }
      map.set(p.categoria_codigo, entry)
    }
    if (p.modalidad_abastecimiento === 'BAJO_PEDIDO') entry.bajoPedido += 1
    else if (p.estado_disponibilidad === 'AGOTADO') entry.agotado += 1
    else entry.disponible += 1
  }
  return Array.from(map.values())
})

const dispCatLabels = computed(() => dispCategorySummary.value.map((c) => c.nombre))
const dispCatSeries = computed(() => {
  if (!dispCategorySummary.value.length) return []
  return [
    {
      name: 'Disponibles (con stock)',
      data: dispCategorySummary.value.map((c) => c.disponible),
      colorKey: 'info' as const,
    },
    {
      name: 'Bajo pedido',
      data: dispCategorySummary.value.map((c) => c.bajoPedido),
      colorKey: 'warning' as const,
    },
    {
      name: 'Agotados',
      data: dispCategorySummary.value.map((c) => c.agotado),
      colorKey: 'primary' as const,
    },
  ]
})

function productThumbnail(p: ProductoDisponibilidad): string | null {
  const img = p.imagen_principal as ProductImagePayload | null | undefined
  if (!img) return null
  return img.variantes?.['160'] || img.variantes?.['320'] || img.original || null
}

function dispBadge(estado: string): {
  label: string
  tone: 'success' | 'warning' | 'danger' | 'info'
} {
  if (estado === 'BAJO_PEDIDO') return { label: 'Bajo pedido', tone: 'info' }
  if (estado === 'AGOTADO') return { label: 'Agotado', tone: 'danger' }
  if (estado === 'STOCK_BAJO') return { label: 'Stock bajo', tone: 'warning' }
  return { label: 'Disponible', tone: 'success' }
}

const tabs = computed<DetailTabItem[]>(() => [
  {
    id: 'general',
    label: 'General',
    icon: LayoutDashboard,
    badge: totalAgendaIncidencias.value !== null ? totalAgendaIncidencias.value : undefined,
  },
  { id: 'proformas', label: 'Proformas', icon: FileText },
  { id: 'pedidos', label: 'Pedidos y cobros', icon: ShoppingBag },
  { id: 'disponibilidad', label: 'Disponibilidad', icon: Boxes },
])
</script>

<template>
  <div class="tienda-dash">
    <PageHeader
      title="Mi actividad comercial"
      :description="scopeDescription"
      show-menu
      @menu="emit('open-menu')"
    >
      <template #actions>
        <Badge tone="neutral">
          <Store :size="13" aria-hidden="true" />
          {{ vendorName }}
        </Badge>
      </template>
    </PageHeader>

    <!-- Accesos rápidos superiores -->
    <nav class="quick-actions" aria-label="Accesos rápidos comerciales">
      <RouterLink to="/proformas/nueva" class="quick-action quick-action--primary">
        <FilePlus2 :size="16" aria-hidden="true" />
        <span>Nueva proforma</span>
      </RouterLink>
      <RouterLink to="/proformas/nueva?voz=1" class="quick-action">
        <AudioLines :size="16" aria-hidden="true" />
        <span>Cotizar mediante voz</span>
      </RouterLink>
      <RouterLink to="/clientes/nuevo" class="quick-action">
        <UserPlus :size="16" aria-hidden="true" />
        <span>Registrar cliente</span>
      </RouterLink>
      <RouterLink to="/productos" class="quick-action">
        <Boxes :size="16" aria-hidden="true" />
        <span>Consultar productos</span>
      </RouterLink>
    </nav>

    <PeriodFilterBar
      v-model:fecha-desde="fechaDesde"
      v-model:fecha-hasta="fechaHasta"
      v-model:granularidad="granularidad"
      v-model:moneda="moneda"
      :fecha-referencia="fechaReferencia"
      :monedas="availableCurrencies"
      :show-seller="false"
      :loading="anyLoading"
      :last-updated-text="lastUpdatedText"
      @apply="loadAll"
      @refresh="loadAll"
    />

    <div v-if="staleBlocks.length" class="stale-banner" role="status">
      <AlertTriangle :size="15" aria-hidden="true" />
      <span> Mostrando datos anteriores desactualizados en: {{ staleBlocks.join(' · ') }}. </span>
    </div>

    <!-- 6 Indicadores principales del vendedor -->
    <section aria-label="Mis indicadores principales">
      <LoadingSkeleton v-if="loadingResumen && !resumen" :lines="4" />
      <ErrorState v-else-if="errorResumen && !resumen" :description="errorResumen">
        <button type="button" @click="fetchResumen()">Reintentar</button>
      </ErrorState>
      <div v-else class="kpi-grid">
        <MetricKpiCard
          label="Mis proformas formalizadas"
          :icon="FileText"
          :value="formatInteger(ind?.proformas_formalizadas)"
          :scope-note="periodScopeLabel"
          :approximate="hasApproximateCohort"
          :show-variation="hasPeriodFilter && Boolean(compAnterior)"
          :variation-pct="compAnterior?.proformas_formalizadas.variacion_porcentaje"
          :detail="`Borradores: ${formatInteger(ind?.borradores)} · Total: ${formatInteger(ind?.total_proformas)}`"
          to="/proformas"
          tone="primary"
        />
        <MetricKpiCard
          label="Mis pedidos confirmados"
          :icon="ShoppingBag"
          :value="formatInteger(ind?.pedidos_confirmados_periodo)"
          :scope-note="periodScopeLabel"
          :show-variation="hasPeriodFilter && Boolean(compAnterior)"
          :variation-pct="compAnterior?.pedidos_confirmados_periodo.variacion_porcentaje"
          :detail="`Vigentes no cancelados: ${formatInteger(ind?.pedidos_no_cancelados)}`"
          to="/pedidos"
        />
        <MetricKpiCard
          label="Mi conversión por cohorte"
          :icon="TrendingUp"
          :value="formatPercent(ind?.tasa_conversion_cohorte)"
          :scope-note="periodScopeLabel"
          :approximate="hasApproximateCohort"
          :detail="`${formatInteger(ind?.pedidos_derivados_cohorte)} derivados de ${formatInteger(ind?.proformas_formalizadas)}`"
        />
        <MetricKpiCard
          label="Importe de mis pedidos"
          :icon="Wallet"
          :value="
            primaryFin
              ? formatMoney(primaryFin.importe_pedidos_no_cancelados, primaryFin.moneda)
              : 'Sin datos'
          "
          :scope-note="`${primaryFin?.moneda ?? 'BOB'} · ${periodScopeLabel}`"
          :detail="secondaryFinSummary || `Pedidos no cancelados ${primaryFin?.moneda ?? ''}`"
          to="/pedidos"
        />
        <MetricKpiCard
          label="Cobros acumulados (cartera)"
          :icon="Banknote"
          :value="
            primaryFin
              ? formatMoney(primaryFin.cobros_acumulados_cartera_vigente, primaryFin.moneda)
              : 'Sin datos'
          "
          :scope-note="`Avance: ${formatPercent(primaryFin?.porcentaje_cobrado)}`"
          :detail="
            primaryFin
              ? `En el período: ${formatMoney(primaryFin.cobros_validos_periodo, primaryFin.moneda)}`
              : ''
          "
          to="/recibos"
          tone="success"
        />
        <MetricKpiCard
          label="Mi saldo pendiente"
          :icon="Clock"
          :value="
            primaryFin ? formatMoney(primaryFin.saldo_pendiente, primaryFin.moneda) : 'Sin datos'
          "
          :scope-note="`Cartera ${primaryFin?.moneda ?? 'BOB'} (${periodScopeLabel})`"
          :detail="
            resumen?.finanzas.cobros_pedidos_cancelados.length
              ? `En cancelados: ${resumen.finanzas.cobros_pedidos_cancelados.map((c) => formatMoney(c.importe, c.moneda)).join(', ')}`
              : 'Sin cobros en pedidos cancelados'
          "
          to="/pedidos"
          tone="warning"
        />
      </div>
    </section>

    <DetailTabs
      :model-value="activeTab"
      :tabs="tabs"
      aria-label="Secciones de mi actividad comercial"
      @update:model-value="activeTab = $event as TiendaTabId"
    />

    <!-- TAB 1: GENERAL -->
    <div v-if="activeTab === 'general'" class="tab-panel" role="tabpanel" aria-label="General">
      <section class="section-block" aria-label="Mi agenda comercial">
        <PriorityAlertsPanel
          title="Mi agenda comercial"
          description="Seguimiento prioritario de tus proformas, pedidos con saldo y entregas."
          count-label="incidencias"
          heading-level="h2"
          :categories="agendaCategories"
          :loading="loadingSeguimiento && !seguimiento"
          :error="errorSeguimiento && !seguimiento ? errorSeguimiento : ''"
          @retry="fetchSeguimiento()"
        />
      </section>

      <section class="section-block" aria-label="Evolución y resumen financiero">
        <div class="two-col">
          <BarChartCard
            title="Evolución comercial personal"
            :description="`Proformas formalizadas vs. pedidos confirmados (${granularidad}).`"
            :labels="evoConteoLabels"
            :series="evoConteoSeries"
            :loading="loadingResumen"
            :error="errorResumen && !resumen ? errorResumen : ''"
            :value-formatter="formatInteger"
            @retry="fetchResumen()"
          />

          <DonutChartCard
            :title="`Resumen financiero (${donutCurrency})`"
            description="Cobros acumulados frente a saldo pendiente de tu cartera vigente."
            :slices="donutSlices"
            :center-label="formatPercent(donutMonedaRow?.porcentaje_cobrado)"
            center-sublabel="Cobrado"
            :loading="loadingResumen"
            :error="errorResumen && !resumen ? errorResumen : ''"
            :value-formatter="(v) => formatMoney(v, donutCurrency)"
            @retry="fetchResumen()"
          >
            <template v-if="finMonedas.length > 1 && !moneda" #controls>
              <select
                v-model="activeDonutCurrency"
                class="inline-select"
                aria-label="Moneda de resumen financiero"
              >
                <option v-for="m in finMonedas" :key="m.moneda" :value="m.moneda">
                  {{ m.moneda }}
                </option>
              </select>
            </template>
          </DonutChartCard>
        </div>
      </section>

      <section class="section-block" aria-label="Distribución resumida de pedidos">
        <StateDistributionCard
          title="Distribución actual de mis pedidos"
          description="Conteo actual de tus pedidos por estado operativo."
          :items="ind?.distribucion_pedidos_estado ?? []"
        />
      </section>
    </div>

    <!-- TAB 2: PROFORMAS -->
    <div v-if="activeTab === 'proformas'" class="tab-panel" role="tabpanel" aria-label="Proformas">
      <section class="section-block" aria-label="Estado de mis proformas">
        <div class="section-block__head-row">
          <div class="section-block__head">
            <h2>Mis proformas y conversión</h2>
            <p>
              La distribución por estado refleja tu fotografía actual; la conversión evalúa la
              cohorte del período.
            </p>
          </div>
          <RouterLink to="/proformas" class="shortcut-link">
            <FileText :size="15" aria-hidden="true" />
            Ir a proformas
          </RouterLink>
        </div>

        <div class="kpi-grid kpi-grid--compact">
          <MetricKpiCard
            label="Borradores pendientes"
            :value="formatInteger(proformasBorradores)"
            detail="Editables sin formalizar"
            to="/proformas?estado=BORRADOR"
          />
          <MetricKpiCard
            label="En revisión"
            :value="formatInteger(proformasRevision)"
            detail="Pendientes de seguimiento"
            to="/proformas?estado=EN_REVISION"
            tone="warning"
          />
          <MetricKpiCard
            label="Enviadas"
            :value="formatInteger(proformasEnviadas)"
            detail="En espera de respuesta"
            to="/proformas?estado=ENVIADA"
          />
          <MetricKpiCard
            label="Próximas a vencer"
            :value="
              errorSeguimiento && !seguimiento
                ? 'No disponible'
                : formatInteger(agendaCounts?.proformas_proximas_vencer)
            "
            detail="Vigencia dentro de 7 días"
            to="/proformas"
            tone="warning"
          />
          <MetricKpiCard
            label="Vencidas y no concretadas"
            :value="formatInteger(proformasVencidasNoConcretadas)"
            detail="Estados VENCIDA + NO_CONCRETADA"
            to="/proformas?estado=VENCIDA"
            tone="danger"
          />
        </div>

        <div class="two-col">
          <StateDistributionCard
            title="Distribución actual de mis proformas"
            description="Estados reales del catálogo comercial en este momento (no es embudo histórico)."
            :items="ind?.distribucion_proformas_estado ?? []"
          />

          <BarChartCard
            title="Formalizadas y pedidos derivados"
            :description="`Serie ${granularidad} de proformas formalizadas y pedidos derivados.`"
            :labels="evoConteoLabels"
            :series="evoConteoSeries"
            :loading="loadingResumen"
            :error="errorResumen && !resumen ? errorResumen : ''"
            :value-formatter="formatInteger"
            @retry="fetchResumen()"
          />
        </div>

        <Card v-if="ind?.limitaciones.length">
          <div class="notes-foot">
            <div class="notes-foot__title">
              <AlertTriangle :size="15" aria-hidden="true" />
              <strong>Notas metodológicas</strong>
            </div>
            <ul>
              <li v-for="note in ind.limitaciones" :key="note">{{ note }}</li>
            </ul>
            <p class="notes-foot__coverage">
              <ClipboardCheck :size="14" aria-hidden="true" />
              Cobertura de formalización:
              {{ formatInteger(ind.cobertura_formalizacion.con_marca_temporal) }} con marca
              temporal,
              {{ formatInteger(ind.cobertura_formalizacion.aproximadas_por_fecha) }}
              aproximadas por fecha comercial,
              {{ formatInteger(ind.cobertura_formalizacion.anuladas_sin_evidencia_formalizacion) }}
              anuladas sin evidencia persistida.
            </p>
          </div>
        </Card>
      </section>
    </div>

    <!-- TAB 3: PEDIDOS Y COBROS -->
    <div
      v-if="activeTab === 'pedidos'"
      class="tab-panel"
      role="tabpanel"
      aria-label="Pedidos y cobros"
    >
      <section class="section-block" aria-label="Mis pedidos y cobros">
        <div class="section-block__head-row">
          <div class="section-block__head">
            <h2>Pedidos, entregas y recaudación</h2>
            <p>Seguimiento comercial de pedidos propios y cobros válidos por moneda.</p>
          </div>
          <div class="inventory-controls">
            <RouterLink to="/pedidos" class="shortcut-link">
              <ShoppingBag :size="15" aria-hidden="true" />
              Ver pedidos
            </RouterLink>
            <RouterLink to="/recibos" class="shortcut-link">
              <Banknote :size="15" aria-hidden="true" />
              Ver recibos
            </RouterLink>
          </div>
        </div>

        <div class="kpi-grid kpi-grid--compact">
          <MetricKpiCard
            label="Confirmados"
            :value="formatInteger(pedidosConfirmados)"
            to="/pedidos?estado=CONFIRMADO"
          />
          <MetricKpiCard
            label="En producción"
            :value="formatInteger(pedidosProduccion)"
            to="/pedidos?estado=EN_PRODUCCION"
            tone="warning"
          />
          <MetricKpiCard
            label="Listos para entrega"
            :value="formatInteger(pedidosListos)"
            to="/pedidos?estado=LISTO_ENTREGA"
            tone="success"
          />
          <MetricKpiCard
            label="Entregados"
            :value="formatInteger(pedidosEntregados)"
            to="/pedidos?estado=ENTREGADO"
            tone="success"
          />
          <MetricKpiCard
            label="Cancelados"
            :value="formatInteger(pedidosCancelados)"
            to="/pedidos?estado=CANCELADO"
            tone="danger"
          />
        </div>

        <div class="two-col">
          <LineAreaChartCard
            :title="`Evolución monetaria de pedidos y cobros (${selectedEvoCurrency})`"
            :description="`Serie monetaria ${granularidad} en ${selectedEvoCurrency}.`"
            :labels="evoMoneyLabels"
            :series="evoMoneySeries"
            :loading="loadingResumen"
            :error="errorResumen && !resumen ? errorResumen : ''"
            :value-formatter="(v) => formatMoney(v, selectedEvoCurrency)"
            @retry="fetchResumen()"
          >
            <template v-if="availableEvoCurrencies.length > 1 && !moneda" #controls>
              <select
                v-model="activeMoneyChartCurrency"
                class="inline-select"
                aria-label="Moneda de evolución monetaria"
              >
                <option v-for="c in availableEvoCurrencies" :key="c" :value="c">{{ c }}</option>
              </select>
            </template>
          </LineAreaChartCard>

          <DonutChartCard
            :title="`Cobros acumulados vs. saldo pendiente (${donutCurrency})`"
            description="Conciliación de tus pedidos vigentes."
            :slices="donutSlices"
            :center-label="formatPercent(donutMonedaRow?.porcentaje_cobrado)"
            center-sublabel="Cobrado"
            :loading="loadingResumen"
            :error="errorResumen && !resumen ? errorResumen : ''"
            :value-formatter="(v) => formatMoney(v, donutCurrency)"
            @retry="fetchResumen()"
          />
        </div>

        <div class="two-col">
          <StateDistributionCard
            title="Distribución actual de mis pedidos"
            description="Conteo según estado operativo actual."
            :items="ind?.distribucion_pedidos_estado ?? []"
          />

          <AnalyticsTableCard
            title="Pedidos con saldo pendiente"
            description="Incluye entregados que todavía mantienen saldo por cobrar."
            :loading="loadingSeguimiento && !seguimiento"
            :error="errorSeguimiento && !seguimiento ? errorSeguimiento : ''"
            :is-empty="!pedidosSaldoRows.length"
            empty-title="Sin saldos pendientes"
            empty-description="Todos tus pedidos activos están al día."
            @retry="fetchSeguimiento()"
          >
            <p v-if="pedidosEntregadosConSaldoRows.length" class="sub-highlight">
              {{ formatInteger(pedidosEntregadosConSaldoRows.length) }} pedido(s) ya entregados
              mantienen saldo pendiente.
            </p>
            <table class="compact-table">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Estado</th>
                  <th scope="col" class="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ped in pedidosSaldoRows" :key="ped.documento_id">
                  <td>
                    <RouterLink
                      :to="`/pedidos/${ped.pedido_id ?? ped.documento_id}`"
                      class="table-link"
                    >
                      Prof. #{{ ped.numero_documento }}
                    </RouterLink>
                  </td>
                  <td>{{ ped.cliente_nombre }}</td>
                  <td>
                    <Badge :tone="ped.estado_codigo === 'ENTREGADO' ? 'danger' : 'warning'">
                      {{ ped.estado_nombre }}
                    </Badge>
                  </td>
                  <td class="num">
                    {{ formatMoney(ped.saldo_pendiente ?? null, ped.moneda ?? 'BOB') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </AnalyticsTableCard>
        </div>

        <div class="two-col">
          <AnalyticsTableCard
            title="Entregas próximas (7 días)"
            description="Pedidos programados para entrega en los próximos 7 días."
            :loading="loadingSeguimiento && !seguimiento"
            :error="errorSeguimiento && !seguimiento ? errorSeguimiento : ''"
            :is-empty="!entregasProximasRows.length"
            empty-title="Sin entregas próximas"
            empty-description="No tienes entregas programadas en los próximos 7 días."
            @retry="fetchSeguimiento()"
          >
            <table class="compact-table">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Fecha prevista</th>
                  <th scope="col" class="num">Plazo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ent in entregasProximasRows" :key="ent.documento_id">
                  <td>
                    <RouterLink
                      :to="`/pedidos/${ent.pedido_id ?? ent.documento_id}`"
                      class="table-link"
                    >
                      Prof. #{{ ent.numero_documento }}
                    </RouterLink>
                  </td>
                  <td>{{ ent.cliente_nombre }}</td>
                  <td>{{ formatDateLaPaz(ent.fecha) }}</td>
                  <td class="num">
                    {{ ent.dias_diferencia === 0 ? 'Hoy' : `${ent.dias_diferencia ?? 0} d` }}
                  </td>
                </tr>
              </tbody>
            </table>
          </AnalyticsTableCard>

          <AnalyticsTableCard
            title="Entregas retrasadas"
            description="Pedidos cuya fecha de entrega prevista ya venció."
            :loading="loadingSeguimiento && !seguimiento"
            :error="errorSeguimiento && !seguimiento ? errorSeguimiento : ''"
            :is-empty="!entregasRetrasadasRows.length"
            empty-title="Sin entregas retrasadas"
            empty-description="No tienes entregas fuera de plazo."
            @retry="fetchSeguimiento()"
          >
            <table class="compact-table">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Fecha prevista</th>
                  <th scope="col" class="num">Retraso</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ent in entregasRetrasadasRows" :key="ent.documento_id">
                  <td>
                    <RouterLink
                      :to="`/pedidos/${ent.pedido_id ?? ent.documento_id}`"
                      class="table-link"
                    >
                      Prof. #{{ ent.numero_documento }}
                    </RouterLink>
                  </td>
                  <td>{{ ent.cliente_nombre }}</td>
                  <td>{{ formatDateLaPaz(ent.fecha) }}</td>
                  <td class="num">{{ ent.dias_diferencia ?? 0 }} d</td>
                </tr>
              </tbody>
            </table>
          </AnalyticsTableCard>
        </div>
      </section>
    </div>

    <!-- TAB 4: DISPONIBILIDAD -->
    <div
      v-if="activeTab === 'disponibilidad'"
      class="tab-panel"
      role="tabpanel"
      aria-label="Disponibilidad"
    >
      <section class="section-block" aria-label="Disponibilidad de catálogo">
        <div class="section-block__head-row">
          <div class="section-block__head">
            <h2>Disponibilidad para cotización</h2>
            <p>
              Consulta stock disponible, productos bajo pedido y agotados sin funciones
              administrativas.
            </p>
          </div>
          <div class="inventory-controls">
            <label class="local-filter">
              <span>Categoría</span>
              <select
                v-model="categoriaLocal"
                aria-label="Filtrar categoría de disponibilidad"
                @change="onCategoryChange"
              >
                <option value="">Todas las categorías</option>
                <option v-for="cat in categoryOptions" :key="cat.codigo" :value="cat.codigo">
                  {{ cat.nombre }}
                </option>
              </select>
            </label>
            <RouterLink :to="productosTargetRoute" class="shortcut-link">
              <Boxes :size="15" aria-hidden="true" />
              Ir a catálogo
            </RouterLink>
          </div>
        </div>

        <div class="kpi-grid kpi-grid--compact">
          <MetricKpiCard
            label="Disponibles (con stock)"
            :value="
              errorSeguimiento && !seguimiento
                ? 'No disponible'
                : formatInteger(dispResumen?.con_stock_disponible)
            "
            detail="Modalidad CON_STOCK con existencia"
            to="/productos"
            tone="success"
          />
          <MetricKpiCard
            label="Bajo pedido"
            :value="
              errorSeguimiento && !seguimiento
                ? 'No disponible'
                : formatInteger(dispResumen?.bajo_pedido)
            "
            detail="Se cotizan bajo pedido (no agotados)"
            to="/productos"
          />
          <MetricKpiCard
            label="Agotados"
            :value="
              errorSeguimiento && !seguimiento
                ? 'No disponible'
                : formatInteger(dispResumen?.con_stock_agotado)
            "
            detail="Productos CON_STOCK en cero"
            :tone="(dispResumen?.con_stock_agotado ?? 0) > 0 ? 'danger' : 'default'"
            to="/productos"
          />
          <MetricKpiCard
            label="Con stock bajo"
            :value="
              errorSeguimiento && !seguimiento
                ? 'No disponible'
                : (dispResumen?.sin_stock_minimo ?? 0) > 0 &&
                    (dispResumen?.con_stock_bajo ?? 0) === 0
                  ? 'No evaluable'
                  : formatInteger(dispResumen?.con_stock_bajo)
            "
            :detail="
              (dispResumen?.sin_stock_minimo ?? 0) > 0
                ? `${formatInteger(dispResumen?.sin_stock_minimo)} sin mínimo referencial`
                : 'Según umbral mínimo configurado'
            "
            :tone="(dispResumen?.con_stock_bajo ?? 0) > 0 ? 'warning' : 'default'"
          />
        </div>

        <div class="two-col">
          <BarChartCard
            title="Disponibilidad por categoría"
            description="Separación entre productos con stock, bajo pedido y agotados."
            :labels="dispCatLabels"
            :series="dispCatSeries"
            horizontal
            :height="260"
            :loading="loadingSeguimiento"
            :error="errorSeguimiento && !seguimiento ? errorSeguimiento : ''"
            :value-formatter="formatInteger"
            @retry="fetchSeguimiento()"
          />

          <AnalyticsTableCard
            title="Listado compacto de productos"
            description="Acceso directo al detalle comercial de cada producto."
            :loading="loadingSeguimiento && !seguimiento"
            :error="errorSeguimiento && !seguimiento ? errorSeguimiento : ''"
            :is-empty="!dispProductos.length"
            empty-title="Sin productos para este filtro"
            empty-description="Ajusta la categoría seleccionada para ver productos."
            @retry="fetchSeguimiento()"
          >
            <div v-if="!dispProductos.length">
              <EmptyState title="Sin productos" description="No hay resultados." />
            </div>
            <ul v-else class="product-compact-list">
              <li
                v-for="prod in dispProductos"
                :key="prod.producto_id"
                class="product-compact-item"
              >
                <RouterLink :to="`/productos/${prod.producto_id}`" class="product-compact-link">
                  <div class="product-compact-thumb">
                    <img
                      v-if="productThumbnail(prod)"
                      :src="productThumbnail(prod)!"
                      :alt="prod.nombre"
                      loading="lazy"
                    />
                    <Package v-else :size="18" aria-hidden="true" />
                  </div>
                  <div class="product-compact-info">
                    <strong>{{ prod.nombre }}</strong>
                    <small>
                      {{ prod.sku || 'Sin SKU' }} · {{ prod.categoria_nombre }} ·
                      {{
                        prod.modalidad_abastecimiento === 'BAJO_PEDIDO'
                          ? 'Bajo pedido'
                          : `${formatQuantity(prod.stock)} ${prod.unidad_codigo}`
                      }}
                    </small>
                  </div>
                  <Badge :tone="dispBadge(prod.estado_disponibilidad).tone">
                    {{ dispBadge(prod.estado_disponibilidad).label }}
                  </Badge>
                </RouterLink>
              </li>
            </ul>
          </AnalyticsTableCard>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tienda-dash {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.tienda-dash > *,
.tab-panel > *,
.two-col > * {
  min-width: 0;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.quick-action {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.35rem;
  padding: 0.45rem 0.9rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.quick-action:hover {
  border-color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}

.quick-action--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #ffffff;
}

.quick-action--primary:hover {
  background: var(--color-primary-accent);
  border-color: var(--color-primary-accent);
}

.tab-panel {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.stale-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.9rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-warning);
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  font-size: 0.825rem;
  font-weight: 500;
}

.kpi-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

@media (min-width: 600px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1720px) {
  .kpi-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .kpi-grid--compact {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.kpi-grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(min(13rem, 100%), 1fr));
}

.section-block {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.section-block__head h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.section-block__head p {
  margin: 0.2rem 0 0;
  font-size: 0.84rem;
  color: var(--color-text-secondary);
}

.section-block__head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}

.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr));
  gap: var(--space-4);
}

.inline-select,
.local-filter select {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8125rem;
}

.local-filter {
  display: grid;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.inventory-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
}

.shortcut-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.25rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-primary-accent);
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
}

.shortcut-link:hover {
  border-color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}

.sub-highlight {
  margin: 0 0 var(--space-2);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-danger);
}

.compact-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.compact-table th,
.compact-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

.compact-table th {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.compact-table th.num,
.compact-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.table-link {
  color: var(--color-primary-accent);
  font-weight: 600;
  text-decoration: none;
}

.table-link:hover {
  text-decoration: underline;
}

.product-compact-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
  max-height: 20rem;
  overflow-y: auto;
}

.product-compact-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: inherit;
  text-decoration: none;
}

.product-compact-link:hover {
  border-color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}

.product-compact-thumb {
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  border-radius: 0.45rem;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.product-compact-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-compact-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.1rem;
}

.product-compact-info strong {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-compact-info small {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.notes-foot {
  display: grid;
  gap: var(--space-2);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.notes-foot__title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-text);
}

.notes-foot ul {
  margin: 0;
  padding-left: 1.25rem;
}

.notes-foot__coverage {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-weight: 500;
}
</style>
