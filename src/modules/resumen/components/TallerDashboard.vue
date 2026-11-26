<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Hammer,
  Hourglass,
  LayoutDashboard,
  PlayCircle,
  RefreshCw,
  Wrench,
} from '@lucide/vue'
import type {
  DashboardTallerPlanificacion,
  DashboardTallerResumen,
  ElementoColaPrioridadTaller,
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

const QUEUE_CATEGORIES: Array<{
  key: string
  label: string
  emptyDescription: string
}> = [
  {
    key: 'ENTREGA_VENCIDA',
    label: 'Entregas vencidas',
    emptyDescription: 'No hay órdenes con fecha de entrega vencida.',
  },
  {
    key: 'ENTREGA_PROXIMA',
    label: 'Entregas próximas',
    emptyDescription: 'No hay entregas programadas en los próximos 7 días.',
  },
  {
    key: 'EN_PROCESO_SIN_FECHA',
    label: 'En proceso sin fecha',
    emptyDescription: 'Todas las órdenes en proceso cuentan con fecha prevista.',
  },
  {
    key: 'PENDIENTE_INICIAR',
    label: 'Pendientes por iniciar',
    emptyDescription: 'No hay órdenes de fabricación pendientes de inicio.',
  },
]

const EVENT_LABELS: Record<string, string> = {
  INICIO_FABRICACION: 'Inicio de fabricación',
  FIN_FABRICACION: 'Fin de fabricación',
  ENTREGA_PREVISTA: 'Entrega prevista',
  ENTREGA_EFECTIVA: 'Entrega efectiva',
}

const emit = defineEmits<{ 'open-menu': [] }>()
const session = useSessionStore()

const activeTab = ref<TallerTabId>('general')
const fechaDesde = ref<string | null>(null)
const fechaHasta = ref<string | null>(null)
const granularidad = ref<'diaria' | 'semanal' | 'mensual'>('mensual')
const estadoFabricacion = ref<string>('')
const tipoMueble = ref<string>('')
const naturalezaEvento = ref<'' | 'PLANIFICADA' | 'EFECTIVA'>('')

const resumen = ref<DashboardTallerResumen | null>(null)
const planificacion = ref<DashboardTallerPlanificacion | null>(null)

const loadingResumen = ref(true)
const loadingPlanificacion = ref(true)
const errorResumen = ref('')
const errorPlanificacion = ref('')

const lastUpdatedText = ref('')

let resumenCtrl: AbortController | null = null
let planifCtrl: AbortController | null = null
let resumenSeq = 0
let planifSeq = 0

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
const anyLoading = computed(() => loadingResumen.value || loadingPlanificacion.value)

const staleBlocks = computed(() => {
  const items: string[] = []
  if (errorResumen.value && resumen.value) items.push(`Resumen de taller (${errorResumen.value})`)
  if (errorPlanificacion.value && planificacion.value) {
    items.push(`Planificación (${errorPlanificacion.value})`)
  }
  return items
})

function buildParams() {
  return {
    fecha_desde: fechaDesde.value,
    fecha_hasta: fechaHasta.value,
    granularidad: granularidad.value,
    estado_fabricacion: estadoFabricacion.value || null,
    tipo_mueble: tipoMueble.value || null,
    page_size: 50,
  }
}

async function fetchResumen() {
  const seq = ++resumenSeq
  resumenCtrl?.abort()
  const controller = new AbortController()
  resumenCtrl = controller
  loadingResumen.value = true
  errorResumen.value = ''
  try {
    const data = await tallerDashboardService.getResumen(buildParams(), controller.signal)
    if (seq !== resumenSeq) return
    resumen.value = data
  } catch (err) {
    if (seq !== resumenSeq || (err as { name?: string })?.name === 'AbortError') return
    errorResumen.value =
      err instanceof Error ? err.message : 'No se pudo cargar el resumen de taller.'
  } finally {
    if (seq === resumenSeq) loadingResumen.value = false
  }
}

async function fetchPlanificacion() {
  const seq = ++planifSeq
  planifCtrl?.abort()
  const controller = new AbortController()
  planifCtrl = controller
  loadingPlanificacion.value = true
  errorPlanificacion.value = ''
  try {
    const data = await tallerDashboardService.getPlanificacion(buildParams(), controller.signal)
    if (seq !== planifSeq) return
    planificacion.value = data
  } catch (err) {
    if (seq !== planifSeq || (err as { name?: string })?.name === 'AbortError') return
    errorPlanificacion.value =
      err instanceof Error ? err.message : 'No se pudo cargar la planificación del taller.'
  } finally {
    if (seq === planifSeq) loadingPlanificacion.value = false
  }
}

async function loadAll() {
  if (dateRangeError(fechaDesde.value ?? '', fechaHasta.value ?? '')) {
    return
  }
  await Promise.all([fetchResumen(), fetchPlanificacion()])
  if (!errorResumen.value || !errorPlanificacion.value) {
    lastUpdatedText.value = formatTimeLaPaz(new Date())
  }
}

onMounted(() => {
  void loadAll()
})

onBeforeUnmount(() => {
  resumenCtrl?.abort()
  planifCtrl?.abort()
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
    badge = `${item.dias_diferencia ?? 0} d retraso`
    tone = 'danger'
  } else if (item.categoria_prioridad === 'ENTREGA_PROXIMA') {
    badge = item.dias_diferencia === 0 ? 'Hoy' : `En ${item.dias_diferencia ?? 0} d`
    tone = (item.dias_diferencia ?? 0) <= 2 ? 'warning' : 'info'
  } else if (item.categoria_prioridad === 'EN_PROCESO_SIN_FECHA') {
    badge = 'Sin fecha'
    tone = 'warning'
  } else if (item.categoria_prioridad === 'PENDIENTE_INICIAR') {
    badge = 'Pendiente'
    tone = 'neutral'
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

const colaResults = computed(() => resumen.value?.cola_prioridades.results ?? [])
const queueCategories = computed<PriorityAlertCategory[]>(() => {
  if (!resumen.value) return []
  return QUEUE_CATEGORIES.map((cfg) => {
    const matches = colaResults.value.filter((item) => item.categoria_prioridad === cfg.key)
    return {
      key: cfg.key,
      label: cfg.label,
      totalCount: matches.length,
      items: matches.slice(0, 5).map(mapQueueItem),
      viewAllTo: '/ordenes-trabajo?tipo=fabricacion',
      viewAllLabel: 'Ver órdenes',
      emptyDescription: cfg.emptyDescription,
    }
  })
})

const filteredEventos = computed(() => {
  const list = planificacion.value?.calendario_eventos.results ?? []
  if (!naturalezaEvento.value) return list
  return list.filter((e) => e.naturaleza === naturalezaEvento.value)
})

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
        <AnalyticsTableCard
          title="Calendario de eventos de taller"
          description="Separa eventos planificados (fecha prevista) de eventos efectivos (historial real)."
          :loading="loadingPlanificacion"
          :error="errorPlanificacion && !planificacion ? errorPlanificacion : ''"
          :is-empty="!filteredEventos.length"
          empty-title="Sin eventos para este filtro"
          empty-description="Ajusta el período o la naturaleza de eventos."
          @retry="fetchPlanificacion()"
        >
          <template #actions>
            <select
              v-model="naturalezaEvento"
              class="inline-select"
              aria-label="Filtrar naturaleza de eventos"
            >
              <option value="">Todos los eventos</option>
              <option value="PLANIFICADA">Solo planificados</option>
              <option value="EFECTIVA">Solo efectivos</option>
            </select>
          </template>

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
                v-for="(ev, idx) in filteredEventos"
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
</style>
