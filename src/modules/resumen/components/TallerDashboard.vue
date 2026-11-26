<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Hammer,
  Hourglass,
  LayoutDashboard,
  List,
  PlayCircle,
  RefreshCw,
  Wrench,
} from '@lucide/vue'
import type {
  DashboardTallerPlanificacion,
  DashboardTallerResumen,
  ElementoColaPrioridadTaller,
  EventoCalendarioTaller,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import DetailTabs, { type DetailTabItem } from '@/shared/ui/DetailTabs.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import type { AlertRowItem } from '@/shared/analytics/AlertListCard.vue'
import AnalyticsTableCard from '@/shared/analytics/AnalyticsTableCard.vue'
import BarChartCard from '@/shared/analytics/BarChartCard.vue'
import MetricKpiCard from '@/shared/analytics/MetricKpiCard.vue'
import PeriodFilterBar from '@/shared/analytics/PeriodFilterBar.vue'
import PriorityAlertsPanel, {
  type PriorityAlertCategory,
} from '@/shared/analytics/PriorityAlertsPanel.vue'
import StateDistributionCard from '@/shared/analytics/StateDistributionCard.vue'
import {
  formatDateLaPaz,
  formatInteger,
  formatPercent,
  formatPeriodLabel,
  formatQuantity,
  formatTimeLaPaz,
  toNumber,
} from '@/shared/analytics/formatters'
import { dateRangeError } from '@/shared/validation/dateRange'
import { tallerDashboardService } from '../services/tallerDashboardService'

type TallerTabId = 'general' | 'produccion' | 'planificacion'
type PlanificacionVista = 'calendario' | 'listado'

const QUEUE_CATEGORIES: Array<{
  key:
    | 'ENTREGA_VENCIDA'
    | 'ENTREGA_PROXIMA'
    | 'PENDIENTE_INICIAR'
    | 'TERMINADA_PENDIENTE_AUTORIZACION'
    | 'SIN_FECHA_ENTREGA'
  label: string
  countField:
    | 'entrega_vencida'
    | 'entrega_proxima'
    | 'pendiente_iniciar'
    | 'terminada_pendiente_autorizacion'
    | 'sin_fecha_entrega'
  emptyDescription: string
}> = [
  {
    key: 'ENTREGA_VENCIDA',
    label: 'Entregas vencidas',
    countField: 'entrega_vencida',
    emptyDescription: 'No hay órdenes con fecha de entrega vencida.',
  },
  {
    key: 'ENTREGA_PROXIMA',
    label: 'Entregas próximas',
    countField: 'entrega_proxima',
    emptyDescription: 'No hay entregas programadas en los próximos 7 días.',
  },
  {
    key: 'PENDIENTE_INICIAR',
    label: 'Pendientes por iniciar',
    countField: 'pendiente_iniciar',
    emptyDescription: 'No hay órdenes de fabricación pendientes de inicio.',
  },
  {
    key: 'TERMINADA_PENDIENTE_AUTORIZACION',
    label: 'Terminadas por autorizar',
    countField: 'terminada_pendiente_autorizacion',
    emptyDescription: 'No hay órdenes terminadas pendientes de autorización comercial.',
  },
  {
    key: 'SIN_FECHA_ENTREGA',
    label: 'Sin fecha de entrega',
    countField: 'sin_fecha_entrega',
    emptyDescription: 'Todas las órdenes activas cuentan con fecha prevista.',
  },
]

const EVENT_LABELS: Record<string, string> = {
  INICIO_FABRICACION: 'Inicio de fabricación',
  FIN_FABRICACION: 'Fin de fabricación',
  ENTREGA_PREVISTA: 'Entrega prevista',
  ENTREGA_EFECTIVA: 'Entrega efectiva',
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const emit = defineEmits<{ 'open-menu': [] }>()
const session = useSessionStore()

const activeTab = ref<TallerTabId>('general')
const vistaPlanificacion = ref<PlanificacionVista>('calendario')
const fechaDesde = ref<string | null>(null)
const fechaHasta = ref<string | null>(null)
const granularidad = ref<'diaria' | 'semanal' | 'mensual'>('mensual')
const estadoFabricacion = ref<string>('')
const tipoMueble = ref<string>('')

// Estado separado de planificación / calendario (no altera los indicadores históricos)
const calMonth = ref<string>('2026-11')
const calMonthInitialized = ref(false)
const selectedDay = ref<string | null>(null)
const calEventos = ref<EventoCalendarioTaller[]>([])
const calLoading = ref(false)
const calError = ref('')

// Estado separado de listado paginado de eventos (filtros en backend sobre todo el conjunto)
const naturalezaEvento = ref<'' | 'PLANIFICADA' | 'EFECTIVA'>('')
const tipoEvento = ref<string>('')
const entregaDesde = ref<string>('')
const entregaHasta = ref<string>('')
const listadoPage = ref(1)
const LISTADO_PAGE_SIZE = 20

const resumen = ref<DashboardTallerResumen | null>(null)
const planificacion = ref<DashboardTallerPlanificacion | null>(null)
const queueBuckets = ref<Record<string, ElementoColaPrioridadTaller[]>>({})

const loadingResumen = ref(true)
const loadingPlanificacion = ref(true)
const errorResumen = ref('')
const errorPlanificacion = ref('')

const lastUpdatedText = ref('')

let resumenCtrl: AbortController | null = null
let planifCtrl: AbortController | null = null
let calCtrl: AbortController | null = null
let resumenSeq = 0
let planifSeq = 0
let calSeq = 0

const actorName = computed(() => session.identity?.display_name ?? 'Jefe de taller')
const scopeDescription = computed(
  () => `Supervisión productiva y planificación de ${actorName.value}.`,
)
const fechaReferencia = computed(
  () => resumen.value?.fecha_referencia ?? planificacion.value?.fecha_referencia ?? null,
)
const periodScopeLabel = computed(() => {
  if (fechaDesde.value && fechaHasta.value) {
    return `${formatDateLaPaz(fechaDesde.value)} – ${formatDateLaPaz(fechaHasta.value)}`
  }
  return 'Todo el histórico'
})
const anyLoading = computed(
  () => loadingResumen.value || loadingPlanificacion.value || calLoading.value,
)
const entregaDateError = computed(() => dateRangeError(entregaDesde.value, entregaHasta.value))

const staleBlocks = computed(() => {
  const items: string[] = []
  if (errorResumen.value && resumen.value) items.push(`Resumen de taller (${errorResumen.value})`)
  if (errorPlanificacion.value && planificacion.value) {
    items.push(`Planificación (${errorPlanificacion.value})`)
  }
  return items
})

function monthBounds(ym: string): { start: string; end: string } {
  const [yStr, mStr] = ym.split('-')
  const year = Number(yStr)
  const month = Number(mStr)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  }
}

function shiftMonth(ym: string, delta: number): string {
  const [yStr, mStr] = ym.split('-')
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`
}

function buildBaseParams() {
  return {
    fecha_desde: fechaDesde.value,
    fecha_hasta: fechaHasta.value,
    granularidad: granularidad.value,
    estado_fabricacion: estadoFabricacion.value || null,
    tipo_mueble: tipoMueble.value || null,
  }
}

async function hydrateQueueCategories(data: DashboardTallerResumen, signal: AbortSignal) {
  const counts = data.cola_prioridades.resumen_conteos
  const grouped: Record<string, ElementoColaPrioridadTaller[]> = {}
  for (const cfg of QUEUE_CATEGORIES) {
    grouped[cfg.key] = data.cola_prioridades.results.filter(
      (item) => item.categoria_prioridad === cfg.key,
    )
  }
  if (data.cola_prioridades.total > data.cola_prioridades.results.length && counts) {
    const missing = QUEUE_CATEGORIES.filter(
      (cfg) => (counts[cfg.countField] ?? 0) > (grouped[cfg.key]?.length ?? 0),
    )
    if (missing.length) {
      const base = buildBaseParams()
      const extra = await Promise.all(
        missing.map((cfg) =>
          tallerDashboardService
            .getResumen({ ...base, categoria_prioridad: cfg.key, page_size: 20 }, signal)
            .then((res) => [cfg.key, res.cola_prioridades.results] as const),
        ),
      )
      for (const [key, list] of extra) {
        grouped[key] = list
      }
    }
  }
  queueBuckets.value = grouped
}

async function fetchResumen() {
  const seq = ++resumenSeq
  resumenCtrl?.abort()
  const controller = new AbortController()
  resumenCtrl = controller
  loadingResumen.value = true
  errorResumen.value = ''
  try {
    const data = await tallerDashboardService.getResumen(
      { ...buildBaseParams(), page_size: 50 },
      controller.signal,
    )
    if (seq !== resumenSeq) return
    resumen.value = data
    if (!calMonthInitialized.value && data.fecha_referencia) {
      calMonth.value = data.fecha_referencia.slice(0, 7)
      calMonthInitialized.value = true
    }
    await hydrateQueueCategories(data, controller.signal)
  } catch (err) {
    if (seq !== resumenSeq || (err as { name?: string })?.name === 'AbortError') return
    errorResumen.value =
      err instanceof Error ? err.message : 'No se pudo cargar el resumen de taller.'
  } finally {
    if (seq === resumenSeq) loadingResumen.value = false
  }
}

async function fetchPlanificacion(resetPage = false) {
  if (entregaDateError.value) return
  if (resetPage) listadoPage.value = 1
  const seq = ++planifSeq
  planifCtrl?.abort()
  const controller = new AbortController()
  planifCtrl = controller
  loadingPlanificacion.value = true
  errorPlanificacion.value = ''
  try {
    const data = await tallerDashboardService.getPlanificacion(
      {
        ...buildBaseParams(),
        entrega_desde: entregaDesde.value || null,
        entrega_hasta: entregaHasta.value || null,
        naturaleza_evento: naturalezaEvento.value || null,
        tipo_evento: tipoEvento.value || null,
        page: listadoPage.value,
        page_size: LISTADO_PAGE_SIZE,
      },
      controller.signal,
    )
    if (seq !== planifSeq) return
    planificacion.value = data
    if (!calMonthInitialized.value && data.fecha_referencia) {
      calMonth.value = data.fecha_referencia.slice(0, 7)
      calMonthInitialized.value = true
    }
  } catch (err) {
    if (seq !== planifSeq || (err as { name?: string })?.name === 'AbortError') return
    errorPlanificacion.value =
      err instanceof Error ? err.message : 'No se pudo cargar la planificación del taller.'
  } finally {
    if (seq === planifSeq) loadingPlanificacion.value = false
  }
}

async function fetchCalendarMonth() {
  const seq = ++calSeq
  calCtrl?.abort()
  const controller = new AbortController()
  calCtrl = controller
  calLoading.value = true
  calError.value = ''
  try {
    const { start, end } = monthBounds(calMonth.value)
    const base = {
      ...buildBaseParams(),
      entrega_desde: start,
      entrega_hasta: end,
      naturaleza_evento: naturalezaEvento.value || null,
      tipo_evento: tipoEvento.value || null,
      page_size: 50,
    }
    const collected: EventoCalendarioTaller[] = []
    let page = 1
    let total = 0
    do {
      const res = await tallerDashboardService.getPlanificacion(
        { ...base, page },
        controller.signal,
      )
      if (seq !== calSeq) return
      const chunk = res.calendario_eventos.results
      collected.push(...chunk)
      total = res.calendario_eventos.total
      if (!chunk.length) break
      page += 1
    } while (collected.length < total)
    if (seq !== calSeq) return
    calEventos.value = collected
    if (!selectedDay.value || !selectedDay.value.startsWith(calMonth.value)) {
      const ref = fechaReferencia.value
      selectedDay.value =
        ref && ref.startsWith(calMonth.value)
          ? ref
          : (collected[0]?.fecha ?? `${calMonth.value}-01`)
    }
  } catch (err) {
    if (seq !== calSeq || (err as { name?: string })?.name === 'AbortError') return
    calError.value = err instanceof Error ? err.message : 'No se pudo cargar el calendario mensual.'
  } finally {
    if (seq === calSeq) calLoading.value = false
  }
}

async function loadAll() {
  if (dateRangeError(fechaDesde.value ?? '', fechaHasta.value ?? '')) {
    return
  }
  await Promise.all([fetchResumen(), fetchPlanificacion(true), fetchCalendarMonth()])
  if (!errorResumen.value || !errorPlanificacion.value) {
    lastUpdatedText.value = formatTimeLaPaz(new Date())
  }
}

function goMonth(delta: number) {
  calMonth.value = shiftMonth(calMonth.value, delta)
  selectedDay.value = null
  void fetchCalendarMonth()
}

function goReferenceMonth() {
  const ref = fechaReferencia.value
  calMonth.value = ref ? ref.slice(0, 7) : '2026-11'
  selectedDay.value = ref ?? `${calMonth.value}-01`
  void fetchCalendarMonth()
}

function onPlanificacionFilterChange() {
  void Promise.all([fetchPlanificacion(true), fetchCalendarMonth()])
}

function changeListadoPage(nextPage: number) {
  listadoPage.value = nextPage
  void fetchPlanificacion(false)
}

onMounted(() => {
  void loadAll()
})

onBeforeUnmount(() => {
  resumenCtrl?.abort()
  planifCtrl?.abort()
  calCtrl?.abort()
})

const ind = computed(() => resumen.value?.indicadores ?? null)
const analisis = computed(() => planificacion.value?.analisis_fabricacion ?? null)

const tipoMuebleOptions = computed(() =>
  (analisis.value?.muebles_fabricados_por_tipo ?? []).map((t) => ({
    codigo: t.tipo_mueble_codigo,
    nombre: t.tipo_mueble_nombre,
  })),
)

const avgDaysText = computed(() => {
  const days = ind.value?.tiempo_promedio_fabricacion_dias
  if (days === null || days === undefined) return 'No disponible'
  return `${days.toFixed(2).replace('.', ',')} d`
})

const avgActiveAgeText = computed(() => {
  const days = ind.value?.antiguedad_promedio_activas_dias
  if (days === null || days === undefined) return 'No disponible'
  return `${days.toFixed(2).replace('.', ',')} d`
})

// Evolución fabricaciones
const evoLabels = computed(
  () =>
    analisis.value?.evolucion_fabricaciones.map((p) =>
      formatPeriodLabel(p.periodo, granularidad.value),
    ) ?? [],
)
const evoSeries = computed(() => {
  const pts = analisis.value?.evolucion_fabricaciones ?? []
  if (!pts.length) return []
  return [
    { name: 'Iniciadas', data: pts.map((p) => p.iniciadas), colorKey: 'info' as const },
    { name: 'Terminadas', data: pts.map((p) => p.terminadas), colorKey: 'success' as const },
  ]
})

// Muebles fabricados por tipo
const tipoLabels = computed(
  () => analisis.value?.muebles_fabricados_por_tipo.map((m) => m.tipo_mueble_nombre) ?? [],
)
const tipoSeries = computed(() => {
  const list = analisis.value?.muebles_fabricados_por_tipo ?? []
  if (!list.length) return []
  return [
    {
      name: 'Cantidad fabricada',
      data: list.map((m) => toNumber(m.cantidad_fabricada) ?? 0),
      colorKey: 'primary' as const,
    },
  ]
})

// Cola de prioridades
function mapQueueItem(item: ElementoColaPrioridadTaller): AlertRowItem {
  const muebles = item.muebles_solicitados
    .map((m) => `${formatQuantity(m.cantidad)}× ${m.nombre}`)
    .join(', ')
  const fechaTxt = item.fecha_prevista
    ? `Prevista ${formatDateLaPaz(item.fecha_prevista)}`
    : 'Sin fecha prevista'

  let badge = item.estado_nombre
  let tone: AlertRowItem['tone'] = 'info'

  if (item.categoria_prioridad === 'ENTREGA_VENCIDA') {
    badge = `${Math.abs(item.dias_diferencia ?? 0)} d retraso`
    tone = 'danger'
  } else if (item.categoria_prioridad === 'ENTREGA_PROXIMA') {
    badge = item.dias_diferencia === 0 ? 'Hoy' : `En ${item.dias_diferencia ?? 0} d`
    tone = (item.dias_diferencia ?? 0) <= 2 ? 'warning' : 'info'
  } else if (item.categoria_prioridad === 'PENDIENTE_INICIAR') {
    badge = 'Pendiente'
    tone = 'neutral'
  } else if (item.categoria_prioridad === 'TERMINADA_PENDIENTE_AUTORIZACION') {
    badge = 'Por autorizar'
    tone = 'info'
  } else if (item.categoria_prioridad === 'SIN_FECHA_ENTREGA') {
    badge = 'Sin fecha'
    tone = 'warning'
  }

  return {
    id: `${item.categoria_prioridad}-${item.orden_trabajo_id}`,
    title: `OT #${item.numero_ot} · ${item.cliente_nombre}`,
    subtitle: `${muebles || 'Fabricación a medida'} · ${fechaTxt}`,
    badge,
    tone,
    to: `/ordenes-trabajo/${item.orden_trabajo_id}`,
  }
}

const queueCategories = computed<PriorityAlertCategory[]>(() => {
  if (!resumen.value) return []
  const counts = resumen.value.cola_prioridades.resumen_conteos
  return QUEUE_CATEGORIES.map((cfg) => {
    const matches = queueBuckets.value[cfg.key] ?? []
    const totalCount = counts ? counts[cfg.countField] : matches.length
    return {
      key: cfg.key,
      label: cfg.label,
      totalCount,
      items: matches.slice(0, 5).map(mapQueueItem),
      viewAllTo: '/ordenes-trabajo?tipo=fabricacion',
      viewAllLabel: 'Ver órdenes',
      emptyDescription: cfg.emptyDescription,
    }
  })
})

const listadoPagination = computed(() => planificacion.value?.calendario_eventos ?? null)
const listadoEventos = computed(() => listadoPagination.value?.results ?? [])
const listadoTotalPages = computed(() => {
  const total = listadoPagination.value?.total ?? 0
  return Math.max(1, Math.ceil(total / LISTADO_PAGE_SIZE))
})
const resumenNaturaleza = computed(() => listadoPagination.value?.resumen_naturaleza ?? null)

// Calendario mensual interactivo
const calMonthLabel = computed(() => {
  const [yStr = '', mStr = ''] = calMonth.value.split('-')
  const monthName = MONTH_NAMES[Number(mStr) - 1] ?? mStr
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yStr}`
})

const calEventsByDay = computed(() => {
  const map: Record<string, EventoCalendarioTaller[]> = {}
  for (const ev of calEventos.value) {
    if (!map[ev.fecha]) map[ev.fecha] = []
    map[ev.fecha]!.push(ev)
  }
  return map
})

interface CalendarCell {
  iso: string
  dayNumber: number
  inCurrentMonth: boolean
  events: EventoCalendarioTaller[]
}

const calendarCells = computed<CalendarCell[]>(() => {
  const [yStr, mStr] = calMonth.value.split('-')
  const year = Number(yStr)
  const month = Number(mStr)
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const startWeekday = (firstDay.getUTCDay() + 6) % 7 // 0 = Lun .. 6 = Dom
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7
  const pad = (n: number) => String(n).padStart(2, '0')
  const cells: CalendarCell[] = []
  for (let i = 0; i < totalCells; i += 1) {
    const dt = new Date(Date.UTC(year, month - 1, 1 - startWeekday + i))
    const iso = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
    cells.push({
      iso,
      dayNumber: dt.getUTCDate(),
      inCurrentMonth: dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month,
      events: calEventsByDay.value[iso] ?? [],
    })
  }
  return cells
})

const selectedDayEvents = computed(() => {
  if (!selectedDay.value) return []
  return calEventsByDay.value[selectedDay.value] ?? []
})

function eventPillTone(ev: EventoCalendarioTaller): 'info' | 'warning' | 'success' | 'neutral' {
  if (ev.tipo_evento === 'ENTREGA_PREVISTA') return 'warning'
  if (ev.tipo_evento === 'ENTREGA_EFECTIVA' || ev.tipo_evento === 'FIN_FABRICACION')
    return 'success'
  if (ev.tipo_evento === 'INICIO_FABRICACION') return 'info'
  return 'neutral'
}

const tabs = computed<DetailTabItem[]>(() => [
  {
    id: 'general',
    label: 'General',
    icon: LayoutDashboard,
    badge: resumen.value ? resumen.value.cola_prioridades.total : undefined,
  },
  { id: 'produccion', label: 'Producción y tiempos', icon: Wrench },
  { id: 'planificacion', label: 'Planificación y entregas', icon: CalendarClock },
])
</script>

<template>
  <div class="taller-dash">
    <PageHeader
      title="Operación de taller"
      :description="scopeDescription"
      show-menu
      @menu="emit('open-menu')"
    >
      <template #actions>
        <div class="header-actions">
          <span v-if="lastUpdatedText" class="header-updated">
            Actualizado: {{ lastUpdatedText }}
          </span>
          <Button variant="secondary" :disabled="anyLoading" @click="loadAll">
            <RefreshCw :size="15" aria-hidden="true" />Actualizar
          </Button>
          <Badge tone="neutral">
            <Hammer :size="13" aria-hidden="true" />
            Jefatura de taller
          </Badge>
        </div>
      </template>
    </PageHeader>

    <nav class="quick-actions" aria-label="Accesos rápidos de taller">
      <RouterLink to="/ordenes-trabajo" class="quick-action quick-action--primary">
        <Hammer :size="16" aria-hidden="true" />
        <span>Consultar órdenes de trabajo</span>
      </RouterLink>
      <RouterLink to="/ordenes-trabajo?tipo=fabricacion" class="quick-action">
        <FileText :size="16" aria-hidden="true" />
        <span>Ver fabricación a medida</span>
      </RouterLink>
    </nav>

    <PeriodFilterBar
      v-model:fecha-desde="fechaDesde"
      v-model:fecha-hasta="fechaHasta"
      v-model:granularidad="granularidad"
      :fecha-referencia="fechaReferencia"
      :show-seller="false"
      :show-currency="false"
      @apply="loadAll"
    />

    <div class="taller-local-filters">
      <label class="local-filter">
        <span>Estado de fabricación</span>
        <select
          v-model="estadoFabricacion"
          aria-label="Filtrar estado de fabricación"
          @change="loadAll"
        >
          <option value="">Todos</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="TERMINADA">Terminada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
      </label>

      <label v-if="tipoMuebleOptions.length" class="local-filter">
        <span>Tipo de mueble</span>
        <select v-model="tipoMueble" aria-label="Filtrar tipo de mueble" @change="loadAll">
          <option value="">Todos</option>
          <option v-for="t in tipoMuebleOptions" :key="t.codigo" :value="t.codigo">
            {{ t.nombre }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="staleBlocks.length" class="stale-banner" role="status">
      <AlertTriangle :size="15" aria-hidden="true" />
      <span> Mostrando datos anteriores desactualizados en: {{ staleBlocks.join(' · ') }}. </span>
    </div>

    <!-- 6 Indicadores principales de taller (exclusivamente productivos, sin montos) -->
    <section aria-label="Indicadores operativos de taller">
      <LoadingSkeleton v-if="loadingResumen" :lines="4" />
      <ErrorState v-else-if="errorResumen && !resumen" :description="errorResumen">
        <button type="button" @click="fetchResumen()">Reintentar</button>
      </ErrorState>
      <div v-else class="kpi-grid">
        <MetricKpiCard
          label="Carga activa en taller"
          :icon="Wrench"
          :value="formatInteger(ind?.carga_activa_fabricacion)"
          scope-note="Órdenes actuales a medida"
          :detail="`Pendientes: ${formatInteger(ind?.pendientes)} · En proceso: ${formatInteger(ind?.en_proceso)}`"
          to="/ordenes-trabajo?tipo=fabricacion"
          tone="primary"
        />
        <MetricKpiCard
          label="Fabricaciones iniciadas"
          :icon="PlayCircle"
          :value="formatInteger(ind?.fabricaciones_iniciadas_periodo)"
          :scope-note="periodScopeLabel"
          detail="Órdenes que iniciaron proceso"
          to="/ordenes-trabajo?tipo=fabricacion"
        />
        <MetricKpiCard
          label="Fabricaciones terminadas"
          :icon="CheckCircle2"
          :value="formatInteger(ind?.fabricaciones_terminadas_periodo)"
          :scope-note="periodScopeLabel"
          :detail="`Histórico terminadas: ${formatInteger(ind?.terminadas)}`"
          tone="success"
        />
        <MetricKpiCard
          label="Tiempo promedio fabricación"
          :icon="Hourglass"
          :value="avgDaysText"
          :scope-note="`${ind?.ordenes_con_duracion_medible ?? 0} órdenes medibles`"
          :detail="
            ind?.tiempo_promedio_fabricacion_horas !== null &&
            ind?.tiempo_promedio_fabricacion_horas !== undefined
              ? `${ind.tiempo_promedio_fabricacion_horas.toFixed(1).replace('.', ',')} horas promedio`
              : 'Sin duración medible'
          "
        />
        <MetricKpiCard
          label="Entregas próximas (7 días)"
          :icon="Clock"
          :value="formatInteger(ind?.entregas_proximas)"
          scope-note="Órdenes a medida vigentes"
          :detail="`Retrasadas: ${formatInteger(ind?.entregas_retrasadas)}`"
          :tone="(ind?.entregas_retrasadas ?? 0) > 0 ? 'danger' : 'warning'"
          to="/ordenes-trabajo?tipo=fabricacion"
        />
        <MetricKpiCard
          label="Cumplimiento de entregas"
          :icon="CheckCircle2"
          :value="formatPercent(ind?.cumplimiento_entregas_porcentaje)"
          :scope-note="periodScopeLabel"
          :detail="`${formatInteger(ind?.entregas_en_plazo)} en plazo de ${formatInteger(ind?.entregas_evaluables_plazo)} evaluables`"
          tone="success"
        />
      </div>
    </section>

    <DetailTabs
      :model-value="activeTab"
      :tabs="tabs"
      aria-label="Secciones de operación de taller"
      @update:model-value="activeTab = $event as TallerTabId"
    />

    <!-- TAB 1: GENERAL -->
    <div v-if="activeTab === 'general'" class="tab-panel" role="tabpanel" aria-label="General">
      <section class="section-block" aria-label="Cola de prioridades del taller">
        <PriorityAlertsPanel
          title="Cola de prioridades del taller"
          description="Órdenes de fabricación a medida priorizadas por urgencia operativa (sin duplicaciones)."
          count-label="órdenes"
          heading-level="h2"
          :categories="queueCategories"
          :loading="loadingResumen && !resumen"
          :error="errorResumen && !resumen ? errorResumen : ''"
          @retry="fetchResumen()"
        />
      </section>

      <section class="section-block" aria-label="Evolución y estados de taller">
        <div class="two-col">
          <BarChartCard
            title="Evolución de fabricaciones"
            :description="`Órdenes iniciadas vs. terminadas (${granularidad}).`"
            :labels="evoLabels"
            :series="evoSeries"
            :loading="loadingPlanificacion"
            :error="errorPlanificacion && !planificacion ? errorPlanificacion : ''"
            :value-formatter="formatInteger"
            @retry="fetchPlanificacion()"
          />

          <StateDistributionCard
            title="Distribución actual de órdenes de trabajo"
            description="Exclusivamente órdenes de fabricación a medida."
            :items="analisis?.distribucion_ordenes_estado ?? []"
          />
        </div>
      </section>
    </div>

    <!-- TAB 2: PRODUCCIÓN Y TIEMPOS -->
    <div
      v-if="activeTab === 'produccion'"
      class="tab-panel"
      role="tabpanel"
      aria-label="Producción y tiempos"
    >
      <section class="section-block" aria-label="Tiempos operativos y muebles fabricados">
        <div class="kpi-grid kpi-grid--compact">
          <MetricKpiCard
            label="Antigüedad promedio activas"
            :value="avgActiveAgeText"
            :detail="`${formatInteger(ind?.ordenes_con_antiguedad_medible)} órdenes en proceso`"
          />
          <MetricKpiCard
            label="Antigüedad máxima activas"
            :value="
              ind?.antiguedad_maxima_activas_dias !== null &&
              ind?.antiguedad_maxima_activas_dias !== undefined
                ? `${ind.antiguedad_maxima_activas_dias} d`
                : 'No disponible'
            "
            detail="Orden activa con mayor permanencia"
            tone="warning"
          />
          <MetricKpiCard
            label="Entregas efectivas"
            :value="formatInteger(ind?.entregas_efectivas)"
            :scope-note="periodScopeLabel"
            detail="Órdenes de fabricación entregadas"
            tone="success"
          />
          <MetricKpiCard
            label="Órdenes canceladas"
            :value="formatInteger(ind?.canceladas)"
            detail="Contabilizadas por separado"
            tone="danger"
          />
        </div>

        <div class="two-col">
          <BarChartCard
            title="Muebles fabricados por tipo"
            description="Unidades terminadas agrupadas por tipo de mueble."
            :labels="tipoLabels"
            :series="tipoSeries"
            horizontal
            :height="260"
            :loading="loadingPlanificacion"
            :error="errorPlanificacion && !planificacion ? errorPlanificacion : ''"
            :value-formatter="formatQuantity"
            @retry="fetchPlanificacion()"
          />

          <StateDistributionCard
            title="Estado actual de fabricación"
            description="Conteo según estado operativo en taller."
            :items="analisis?.distribucion_ordenes_estado ?? []"
          />
        </div>
      </section>
    </div>

    <!-- TAB 3: PLANIFICACIÓN Y ENTREGAS -->
    <div
      v-if="activeTab === 'planificacion'"
      class="tab-panel"
      role="tabpanel"
      aria-label="Planificación y entregas"
    >
      <section class="section-block" aria-label="Calendario de planificación">
        <div class="planif-toolbar">
          <div class="planif-view-switch" role="group" aria-label="Modo de visualización">
            <button
              type="button"
              class="view-chip"
              :class="{ 'is-active': vistaPlanificacion === 'calendario' }"
              :aria-pressed="vistaPlanificacion === 'calendario'"
              @click="vistaPlanificacion = 'calendario'"
            >
              <Calendar :size="15" aria-hidden="true" />
              Calendario mensual
            </button>
            <button
              type="button"
              class="view-chip"
              :class="{ 'is-active': vistaPlanificacion === 'listado' }"
              :aria-pressed="vistaPlanificacion === 'listado'"
              @click="vistaPlanificacion = 'listado'"
            >
              <List :size="15" aria-hidden="true" />
              Listado de eventos
            </button>
          </div>

          <div class="planif-filters">
            <label class="local-filter">
              <span>Naturaleza</span>
              <select
                v-model="naturalezaEvento"
                aria-label="Filtrar naturaleza de eventos"
                @change="onPlanificacionFilterChange"
              >
                <option value="">Todos los eventos</option>
                <option value="PLANIFICADA">Solo planificados</option>
                <option value="EFECTIVA">Solo efectivos</option>
              </select>
            </label>
            <label class="local-filter">
              <span>Tipo de evento</span>
              <select
                v-model="tipoEvento"
                aria-label="Filtrar tipo de evento"
                @change="onPlanificacionFilterChange"
              >
                <option value="">Todos</option>
                <option value="ENTREGA_PREVISTA">Entrega prevista</option>
                <option value="ENTREGA_EFECTIVA">Entrega efectiva</option>
                <option value="INICIO_FABRICACION">Inicio de fabricación</option>
                <option value="FIN_FABRICACION">Fin de fabricación</option>
              </select>
            </label>
          </div>
        </div>

        <!-- VISTA 1: CALENDARIO MENSUAL INTERACTIVO -->
        <div v-if="vistaPlanificacion === 'calendario'" class="calendar-layout">
          <section class="card calendar-card" aria-label="Calendario mensual de taller">
            <div class="calendar-head">
              <div>
                <h3>{{ calMonthLabel }}</h3>
                <p class="calendar-desc">
                  Navegación mensual independiente del filtro histórico ({{ calEventos.length }}
                  eventos en el mes).
                </p>
              </div>
              <div class="calendar-nav">
                <Button variant="secondary" aria-label="Mes anterior" @click="goMonth(-1)">
                  <ChevronLeft :size="15" aria-hidden="true" />
                </Button>
                <Button variant="secondary" @click="goReferenceMonth"> Mes de referencia </Button>
                <Button variant="secondary" aria-label="Mes siguiente" @click="goMonth(1)">
                  <ChevronRight :size="15" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div class="calendar-legend" aria-label="Leyenda de eventos">
              <span class="legend-item">
                <i class="legend-dot legend-dot--warning" /> Entrega prevista
              </span>
              <span class="legend-item">
                <i class="legend-dot legend-dot--info" /> Inicio fabricación
              </span>
              <span class="legend-item">
                <i class="legend-dot legend-dot--success" /> Fin / Entrega efectiva
              </span>
            </div>

            <LoadingSkeleton v-if="calLoading" :lines="6" />
            <ErrorState v-else-if="calError" :description="calError">
              <button type="button" @click="fetchCalendarMonth()">Reintentar</button>
            </ErrorState>
            <div v-else class="calendar-grid-wrap">
              <div class="calendar-weekdays" aria-hidden="true">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>
              <div class="calendar-grid" role="grid" :aria-label="`Calendario ${calMonthLabel}`">
                <button
                  v-for="cell in calendarCells"
                  :key="cell.iso"
                  type="button"
                  class="calendar-day"
                  :class="{
                    'is-outside': !cell.inCurrentMonth,
                    'is-selected': selectedDay === cell.iso,
                    'is-reference': fechaReferencia === cell.iso,
                  }"
                  :aria-label="`${formatDateLaPaz(cell.iso)}: ${cell.events.length} eventos`"
                  :aria-pressed="selectedDay === cell.iso"
                  @click="selectedDay = cell.iso"
                >
                  <div class="calendar-day__top">
                    <span class="calendar-day__num">{{ cell.dayNumber }}</span>
                    <span v-if="cell.events.length" class="calendar-day__count">
                      {{ cell.events.length }}
                    </span>
                  </div>
                  <div class="calendar-day__pills">
                    <span
                      v-for="(ev, idx) in cell.events.slice(0, 2)"
                      :key="`${ev.orden_trabajo_id}-${ev.tipo_evento}-${idx}`"
                      class="cal-pill"
                      :class="`cal-pill--${eventPillTone(ev)}`"
                    >
                      OT #{{ ev.numero_ot }}
                    </span>
                    <span v-if="cell.events.length > 2" class="cal-pill cal-pill--more">
                      +{{ cell.events.length - 2 }} más
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </section>

          <aside class="card calendar-detail" aria-label="Eventos del día seleccionado">
            <h3>
              {{ selectedDay ? `Día ${formatDateLaPaz(selectedDay)}` : 'Selecciona un día' }}
            </h3>
            <p class="calendar-desc">
              {{ selectedDayEvents.length }} evento(s) registrado(s) en la fecha seleccionada.
            </p>
            <ul v-if="selectedDayEvents.length" class="day-events-list">
              <li
                v-for="(ev, idx) in selectedDayEvents"
                :key="`${ev.orden_trabajo_id}-${ev.tipo_evento}-${idx}`"
                class="day-event-card"
              >
                <div class="day-event-card__head">
                  <RouterLink :to="`/ordenes-trabajo/${ev.orden_trabajo_id}`" class="table-link">
                    OT #{{ ev.numero_ot }}
                  </RouterLink>
                  <Badge :tone="eventPillTone(ev)">
                    {{ ev.naturaleza === 'EFECTIVA' ? 'Efectiva' : 'Planificada' }}
                  </Badge>
                </div>
                <strong>{{ EVENT_LABELS[ev.tipo_evento] ?? ev.tipo_evento }}</strong>
                <small>{{ ev.cliente_nombre }}</small>
                <div class="day-event-card__foot">
                  <StatusBadge :status="ev.estado_codigo" />
                </div>
              </li>
            </ul>
            <p v-else class="calendar-empty">Sin eventos para esta fecha.</p>
          </aside>
        </div>

        <!-- VISTA 2: LISTADO DE EVENTOS PAGINADO -->
        <AnalyticsTableCard
          v-else
          title="Listado de eventos de taller"
          description="Consulta completa y paginada con filtros aplicados en servidor."
          :loading="loadingPlanificacion"
          :error="errorPlanificacion && !planificacion ? errorPlanificacion : ''"
          :is-empty="!listadoEventos.length"
          empty-title="Sin eventos para este filtro"
          empty-description="Ajusta el rango de planificación, naturaleza o tipo de evento."
          @retry="fetchPlanificacion()"
        >
          <template #actions>
            <div class="listado-range">
              <label class="local-filter">
                <span>Planif. desde</span>
                <input
                  v-model="entregaDesde"
                  type="date"
                  aria-label="Planificación desde"
                  @change="fetchPlanificacion(true)"
                />
              </label>
              <label class="local-filter">
                <span>Planif. hasta</span>
                <input
                  v-model="entregaHasta"
                  type="date"
                  aria-label="Planificación hasta"
                  @change="fetchPlanificacion(true)"
                />
              </label>
            </div>
          </template>

          <p v-if="entregaDateError" class="range-error" role="alert">
            {{ entregaDateError }}
          </p>

          <div v-if="resumenNaturaleza" class="listado-summary">
            <span>
              Total conjunto: <strong>{{ listadoPagination?.total ?? 0 }}</strong> eventos
            </span>
            <span>Planificados: {{ resumenNaturaleza.planificados }}</span>
            <span>Efectivos: {{ resumenNaturaleza.efectivos }}</span>
          </div>

          <table class="compact-table">
            <thead>
              <tr>
                <th scope="col">Orden</th>
                <th scope="col">Cliente</th>
                <th scope="col">Evento</th>
                <th scope="col">Naturaleza</th>
                <th scope="col">Fecha</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(ev, idx) in listadoEventos"
                :key="`${ev.orden_trabajo_id}-${ev.tipo_evento}-${idx}`"
              >
                <td>
                  <RouterLink :to="`/ordenes-trabajo/${ev.orden_trabajo_id}`" class="table-link">
                    OT #{{ ev.numero_ot }}
                  </RouterLink>
                </td>
                <td>{{ ev.cliente_nombre }}</td>
                <td>{{ EVENT_LABELS[ev.tipo_evento] ?? ev.tipo_evento }}</td>
                <td>
                  <Badge :tone="ev.naturaleza === 'EFECTIVA' ? 'success' : 'info'">
                    {{ ev.naturaleza === 'EFECTIVA' ? 'Efectiva' : 'Planificada' }}
                  </Badge>
                </td>
                <td>{{ formatDateLaPaz(ev.fecha) }}</td>
                <td>
                  <StatusBadge :status="ev.estado_codigo" />
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="(listadoPagination?.total ?? 0) > LISTADO_PAGE_SIZE" class="listado-pager">
            <span>
              Página {{ listadoPage }} de {{ listadoTotalPages }} ({{
                listadoPagination?.total ?? 0
              }}
              registros)
            </span>
            <div class="listado-pager__btns">
              <Button
                variant="secondary"
                :disabled="listadoPage <= 1 || loadingPlanificacion"
                @click="changeListadoPage(listadoPage - 1)"
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                :disabled="listadoPage >= listadoTotalPages || loadingPlanificacion"
                @click="changeListadoPage(listadoPage + 1)"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </AnalyticsTableCard>
      </section>
    </div>
  </div>
</template>

<style scoped>
.taller-dash {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.taller-dash > *,
.tab-panel > *,
.two-col > * {
  min-width: 0;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.header-updated {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
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

.taller-local-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.local-filter {
  display: grid;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.local-filter select,
.inline-select {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8125rem;
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
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

.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr));
  gap: var(--space-4);
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

.table-link {
  color: var(--color-primary-accent);
  font-weight: 600;
  text-decoration: none;
}

.table-link:hover {
  text-decoration: underline;
}

.planif-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}

.planif-view-switch {
  display: inline-flex;
  gap: var(--space-1);
  padding: 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}

.view-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  padding: 0.35rem 0.75rem;
  border: 0;
  border-radius: calc(var(--radius-control) - 2px);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}

.view-chip.is-active {
  background: var(--color-primary);
  color: #ffffff;
}

.planif-filters,
.listado-range {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.local-filter input[type='date'] {
  min-height: 2.2rem;
  padding: 0.3rem 0.55rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.84rem;
}

.range-error {
  margin: 0 0 var(--space-2);
  color: var(--color-danger);
  font-size: 0.84rem;
  font-weight: 600;
}

.calendar-layout {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 1100px) {
  .calendar-layout {
    grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
    align-items: start;
  }
}

.calendar-card,
.calendar-detail {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-3);
}

.calendar-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.calendar-head h3,
.calendar-detail h3 {
  margin: 0;
  font-size: 1rem;
}

.calendar-desc {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.calendar-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.legend-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  display: inline-block;
}

.legend-dot--warning {
  background: var(--color-warning);
}

.legend-dot--info {
  background: var(--color-info);
}

.legend-dot--success {
  background: var(--color-success);
}

.calendar-grid-wrap {
  display: grid;
  gap: var(--space-1);
  overflow-x: auto;
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
  min-width: 34rem;
}

.calendar-weekdays span {
  text-align: center;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  padding-bottom: 0.2rem;
}

.calendar-day {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 4.9rem;
  padding: 0.4rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.calendar-day:hover {
  border-color: var(--color-primary-accent);
}

.calendar-day.is-outside {
  opacity: 0.45;
}

.calendar-day.is-reference {
  border-color: var(--color-info);
}

.calendar-day.is-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent);
}

.calendar-day__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 700;
}

.calendar-day__count {
  font-size: 0.7rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.calendar-day__pills {
  display: grid;
  gap: 0.18rem;
}

.cal-pill {
  display: block;
  padding: 0.08rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.69rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cal-pill--warning {
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
}

.cal-pill--info {
  background: color-mix(in srgb, var(--color-info) 16%, transparent);
  color: var(--color-info);
}

.cal-pill--success {
  background: color-mix(in srgb, var(--color-success) 16%, transparent);
  color: var(--color-success);
}

.cal-pill--neutral,
.cal-pill--more {
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.day-events-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
  max-height: 26rem;
  overflow-y: auto;
}

.day-event-card {
  display: grid;
  gap: 0.25rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  font-size: 0.84rem;
}

.day-event-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.calendar-empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.listado-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  font-size: 0.84rem;
  color: var(--color-text-secondary);
}

.listado-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-3);
  font-size: 0.84rem;
  color: var(--color-text-secondary);
}

.listado-pager__btns {
  display: flex;
  gap: var(--space-2);
}
</style>
