<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertTriangle, Boxes, ClipboardCheck, ShieldCheck } from '@lucide/vue'
import type {
  DashboardAdminComercial,
  DashboardAdminResumen,
  FinanzasAdmin,
  InventarioAdmin,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Badge from '@/shared/ui/Badge.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import MetricKpiCard from '@/shared/analytics/MetricKpiCard.vue'
import PeriodFilterBar, { type SellerOption } from '@/shared/analytics/PeriodFilterBar.vue'
import BarChartCard from '@/shared/analytics/BarChartCard.vue'
import LineAreaChartCard from '@/shared/analytics/LineAreaChartCard.vue'
import DonutChartCard from '@/shared/analytics/DonutChartCard.vue'
import StateDistributionCard from '@/shared/analytics/StateDistributionCard.vue'
import SellerComparisonPanel from '@/shared/analytics/SellerComparisonPanel.vue'
import AnalyticsTableCard from '@/shared/analytics/AnalyticsTableCard.vue'
import AlertListCard, { type AlertRowItem } from '@/shared/analytics/AlertListCard.vue'
import {
  formatDateLaPaz,
  formatInteger,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatTimeLaPaz,
  toNumber,
} from '@/shared/analytics/formatters'
import { adminDashboardService } from '../services/adminDashboardService'

const emit = defineEmits<{ 'open-menu': [] }>()
const session = useSessionStore()

const fechaDesde = ref<string | null>(null)
const fechaHasta = ref<string | null>(null)
const granularidad = ref<'diaria' | 'semanal' | 'mensual'>('mensual')
const vendedorId = ref<number | null>(null)
const moneda = ref<string>('')
const categoriaLocal = ref<string>('')
const estadoFabricacionLocal = ref<string>('')

const resumen = ref<DashboardAdminResumen | null>(null)
const comercial = ref<DashboardAdminComercial | null>(null)
const finanzas = ref<FinanzasAdmin | null>(null)
const inventario = ref<InventarioAdmin | null>(null)

const loadingResumen = ref(true)
const loadingComercial = ref(true)
const loadingFinanzas = ref(true)
const loadingInventario = ref(true)

const errorResumen = ref('')
const errorComercial = ref('')
const errorFinanzas = ref('')
const errorInventario = ref('')

const lastUpdatedText = ref('')
const vendedoresCache = ref<SellerOption[]>([])
const activeMoneyChartCurrency = ref<string>('BOB')
const activeDonutCurrency = ref<string>('BOB')
const activeSoldUnitKey = ref<string>('')

let activeController: AbortController | null = null

const scopeDescription = computed(() => {
  const actor = session.identity?.display_name ?? 'Administrador'
  return `Supervisión administrativa global de ${actor}.`
})

const fechaReferencia = computed(
  () => resumen.value?.fecha_referencia ?? comercial.value?.fecha_referencia ?? null,
)

const hasPeriodFilter = computed(() => Boolean(fechaDesde.value && fechaHasta.value))

const periodScopeLabel = computed(() => {
  if (fechaDesde.value && fechaHasta.value) {
    return `${formatDateLaPaz(fechaDesde.value)} – ${formatDateLaPaz(fechaHasta.value)}`
  }
  return 'Todo el histórico disponible'
})

const anyLoading = computed(
  () =>
    loadingResumen.value ||
    loadingComercial.value ||
    loadingFinanzas.value ||
    loadingInventario.value,
)

function buildBaseParams() {
  return {
    fecha_desde: fechaDesde.value,
    fecha_hasta: fechaHasta.value,
    granularidad: granularidad.value,
    vendedor: vendedorId.value,
    moneda: moneda.value || null,
  }
}

async function fetchResumen(signal?: AbortSignal) {
  loadingResumen.value = true
  errorResumen.value = ''
  try {
    resumen.value = await adminDashboardService.getResumen(
      {
        ...buildBaseParams(),
        categoria: categoriaLocal.value || null,
        estado_fabricacion: estadoFabricacionLocal.value || null,
        page_size: 10,
      },
      signal,
    )
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return
    errorResumen.value = err instanceof Error ? err.message : 'No se pudo cargar el resumen.'
  } finally {
    loadingResumen.value = false
  }
}

async function fetchComercial(signal?: AbortSignal) {
  loadingComercial.value = true
  errorComercial.value = ''
  try {
    const data = await adminDashboardService.getComercial(buildBaseParams(), signal)
    comercial.value = data
    if (!vendedorId.value && data.vendedores.length) {
      vendedoresCache.value = data.vendedores.map((v) => ({
        id: v.vendedor_id,
        nombre: v.vendedor_nombre,
      }))
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return
    errorComercial.value =
      err instanceof Error ? err.message : 'No se pudo cargar el bloque comercial.'
  } finally {
    loadingComercial.value = false
  }
}

async function fetchFinanzas(signal?: AbortSignal) {
  loadingFinanzas.value = true
  errorFinanzas.value = ''
  try {
    const data = await adminDashboardService.getFinanzas(
      { ...buildBaseParams(), page_size: 10 },
      signal,
    )
    finanzas.value = data
    const firstCurrency = data.por_moneda[0]?.moneda
    if (firstCurrency && !data.por_moneda.some((m) => m.moneda === activeDonutCurrency.value)) {
      activeDonutCurrency.value = firstCurrency
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return
    errorFinanzas.value =
      err instanceof Error ? err.message : 'No se pudo cargar el bloque financiero.'
  } finally {
    loadingFinanzas.value = false
  }
}

async function fetchInventario(signal?: AbortSignal) {
  loadingInventario.value = true
  errorInventario.value = ''
  try {
    const data = await adminDashboardService.getInventario(
      {
        fecha_desde: fechaDesde.value,
        fecha_hasta: fechaHasta.value,
        moneda: moneda.value || null,
        categoria: categoriaLocal.value || null,
        page_size: 20,
      },
      signal,
    )
    inventario.value = data
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return
    errorInventario.value = err instanceof Error ? err.message : 'No se pudo cargar el inventario.'
  } finally {
    loadingInventario.value = false
  }
}

async function loadAll() {
  if (fechaDesde.value && fechaHasta.value && fechaDesde.value > fechaHasta.value) {
    return
  }
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller
  await Promise.all([
    fetchResumen(controller.signal),
    fetchComercial(controller.signal),
    fetchFinanzas(controller.signal),
    fetchInventario(controller.signal),
  ])
  if (!controller.signal.aborted) {
    lastUpdatedText.value = formatTimeLaPaz(new Date())
  }
}

function onCategoryChange() {
  void fetchInventario()
  void fetchResumen()
}

onMounted(() => {
  void loadAll()
})

onBeforeUnmount(() => {
  activeController?.abort()
})

// Indicadores principales
const indComercial = computed(
  () => resumen.value?.comercial ?? comercial.value?.indicadores ?? null,
)
const finMonedas = computed(
  () => finanzas.value?.por_moneda ?? resumen.value?.finanzas.por_moneda ?? [],
)
const primaryFin = computed(() => {
  if (moneda.value) {
    return finMonedas.value.find((m) => m.moneda === moneda.value) ?? finMonedas.value[0] ?? null
  }
  return finMonedas.value[0] ?? null
})

const hasApproximateCohort = computed(
  () => (indComercial.value?.cobertura_formalizacion.aproximadas_por_fecha ?? 0) > 0,
)

const compAnterior = computed(() => indComercial.value?.comparaciones_periodo_anterior ?? null)

const secondaryFinSummary = computed(() => {
  const others = finMonedas.value.filter((m) => m.moneda !== primaryFin.value?.moneda)
  if (!others.length) return ''
  return others
    .map((m) => `${m.moneda}: ${formatMoney(m.importe_pedidos_no_cancelados, m.moneda)}`)
    .join(' · ')
})

// Evolución comercial
const evoConteoLabels = computed(
  () => comercial.value?.evolucion.puntos_conteo.map((p) => p.periodo) ?? [],
)
const evoConteoSeries = computed(() => {
  const pts = comercial.value?.evolucion.puntos_conteo ?? []
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
  () => comercial.value?.evolucion.series_monetarias.map((s) => s.moneda) ?? [],
)

const selectedEvoCurrency = computed(() => {
  if (moneda.value) return moneda.value
  if (availableEvoCurrencies.value.includes(activeMoneyChartCurrency.value)) {
    return activeMoneyChartCurrency.value
  }
  return availableEvoCurrencies.value[0] ?? 'BOB'
})

const evoMonetariaSerie = computed(() =>
  comercial.value?.evolucion.series_monetarias.find((s) => s.moneda === selectedEvoCurrency.value),
)

const evoMoneyLabels = computed(() => evoMonetariaSerie.value?.puntos.map((p) => p.periodo) ?? [])
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

// Finanzas: anillo + evolución de cobros
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

const cobrosEvoSerie = computed(
  () =>
    finanzas.value?.evolucion_cobros.find((e) => e.moneda === donutCurrency.value) ??
    finanzas.value?.evolucion_cobros[0] ??
    null,
)
const cobrosEvoLabels = computed(() => cobrosEvoSerie.value?.puntos.map((p) => p.periodo) ?? [])
const cobrosEvoSeries = computed(() => {
  const pts = cobrosEvoSerie.value?.puntos ?? []
  if (!pts.length) return []
  return [
    {
      name: `Cobros válidos (${cobrosEvoSerie.value?.moneda ?? 'BOB'})`,
      data: pts.map((p) => toNumber(p.monto_cobrado) ?? 0),
      colorKey: 'success' as const,
      area: true,
    },
  ]
})

// Producción
const prod = computed(() => resumen.value?.produccion ?? null)
const fabricacionesPendientes = computed(
  () =>
    prod.value?.ordenes_fabricacion_por_estado.find((e) => e.codigo === 'PENDIENTE')?.cantidad ?? 0,
)

// Inventario
const invResumen = computed(() => inventario.value?.resumen ?? resumen.value?.inventario ?? null)
const invCatLabels = computed(
  () => inventario.value?.por_categoria.map((c) => c.categoria_nombre) ?? [],
)
const invCatSeries = computed(() => {
  const cats = inventario.value?.por_categoria ?? []
  if (!cats.length) return []
  return [
    { name: 'Con stock', data: cats.map((c) => c.con_stock), colorKey: 'info' as const },
    { name: 'Bajo pedido', data: cats.map((c) => c.bajo_pedido), colorKey: 'warning' as const },
    { name: 'Agotados', data: cats.map((c) => c.agotados), colorKey: 'primary' as const },
  ]
})

const soldUnits = computed(() => {
  const list = inventario.value?.mas_vendidos.results ?? []
  const map = new Map<string, string>()
  for (const item of list) {
    const key = `${item.categoria_codigo}::${item.unidad_codigo}`
    if (!map.has(key)) {
      map.set(key, `${item.categoria_nombre} (${item.unidad_nombre})`)
    }
  }
  return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
})

const selectedSoldUnitKey = computed(() => {
  if (soldUnits.value.some((u) => u.key === activeSoldUnitKey.value)) {
    return activeSoldUnitKey.value
  }
  return soldUnits.value[0]?.key ?? ''
})

const filteredMasVendidos = computed(() => {
  const list = inventario.value?.mas_vendidos.results ?? []
  if (!selectedSoldUnitKey.value) return list.slice(0, 8)
  return list
    .filter(
      (item) => `${item.categoria_codigo}::${item.unidad_codigo}` === selectedSoldUnitKey.value,
    )
    .slice(0, 8)
})

const masVendidosLabels = computed(() => filteredMasVendidos.value.map((p) => p.nombre))
const masVendidosSeries = computed(() => {
  if (!filteredMasVendidos.value.length) return []
  return [
    {
      name: 'Cantidad vendida',
      data: filteredMasVendidos.value.map((p) => toNumber(p.cantidad_vendida) ?? 0),
      colorKey: 'primary' as const,
    },
  ]
})

// Alertas prioritarias
const alertas = computed(() => resumen.value?.alertas ?? null)
const alertProformas = computed<AlertRowItem[]>(() =>
  (alertas.value?.proformas_proximas_vencer ?? []).map((p) => ({
    id: p.proforma_id,
    title: `Proforma #${p.numero} · ${p.cliente_nombre}`,
    subtitle: `${p.vendedor_nombre} · Vence ${formatDateLaPaz(p.fecha_vencimiento)} · ${formatMoney(p.total, p.moneda)}`,
    badge: p.dias_restantes === 0 ? 'Vence hoy' : `${p.dias_restantes} d`,
    tone: p.dias_restantes <= 2 ? 'danger' : 'warning',
    to: `/proformas/${p.proforma_id}`,
  })),
)
const alertPedidosRetrasados = computed<AlertRowItem[]>(() =>
  (alertas.value?.pedidos_retrasados ?? []).map((p) => ({
    id: p.pedido_id,
    title: `Pedido Prof. #${p.proforma_numero} · ${p.cliente_nombre}`,
    subtitle: `${p.vendedor_nombre} · Prevista ${formatDateLaPaz(p.fecha_entrega_prevista)}`,
    badge: `${p.dias_retraso} d retraso`,
    tone: 'danger',
    to: `/pedidos/${p.pedido_id}`,
  })),
)
const alertFabricacionesRetrasadas = computed<AlertRowItem[]>(() =>
  (alertas.value?.fabricaciones_retrasadas ?? []).map((f) => ({
    id: f.orden_trabajo_id,
    title: `OT #${f.numero_ot} · ${f.cliente_nombre}`,
    subtitle: `Estado ${f.estado_codigo} · Prevista ${formatDateLaPaz(f.fecha_entrega_prevista)}`,
    badge: `${f.dias_retraso} d retraso`,
    tone: 'danger',
    to: `/ordenes-trabajo/${f.orden_trabajo_id}`,
  })),
)
const alertSaldosEntregados = computed<AlertRowItem[]>(() => {
  const rows: AlertRowItem[] = []
  for (const group of alertas.value?.saldos_pedidos_entregados_por_moneda ?? []) {
    for (const p of group.pedidos) {
      rows.push({
        id: `${group.moneda}-${p.pedido_id}`,
        title: `Prof. #${p.proforma_numero} · ${p.cliente_nombre}`,
        subtitle: `Entregado ${formatDateLaPaz(p.fecha_entrega_efectiva)}`,
        badge: formatMoney(p.saldo_pendiente, group.moneda),
        tone: 'warning',
        to: `/pedidos/${p.pedido_id}`,
      })
    }
  }
  return rows
})
const alertStockBajo = computed<AlertRowItem[]>(() =>
  (alertas.value?.productos_stock_bajo ?? []).map((p) => ({
    id: p.producto_id,
    title: `${p.sku ? `${p.sku} · ` : ''}${p.nombre}`,
    subtitle: `Stock actual: ${formatQuantity(p.stock)} ${p.unidad_codigo}`,
    badge: p.estado_stock === 'AGOTADO' ? 'Agotado' : 'Stock bajo',
    tone: p.estado_stock === 'AGOTADO' ? 'danger' : 'warning',
    to: `/productos/${p.producto_id}`,
  })),
)
const alertSinMinimo = computed<AlertRowItem[]>(() =>
  (alertas.value?.productos_sin_stock_minimo ?? []).map((p) => ({
    id: p.producto_id,
    title: `${p.sku ? `${p.sku} · ` : ''}${p.nombre}`,
    subtitle: `Stock actual: ${formatQuantity(p.stock)} ${p.unidad_codigo} · Umbral sin configurar`,
    badge: 'Sin mínimo',
    tone: 'neutral',
    to: `/productos/${p.producto_id}`,
  })),
)
</script>

<template>
  <div class="admin-dash">
    <PageHeader
      title="Resumen general"
      :description="scopeDescription"
      show-menu
      @menu="emit('open-menu')"
    >
      <template #actions>
        <Badge v-if="session.entornoEvaluacion" tone="info">Modo demostración</Badge>
        <Badge tone="neutral">
          <ShieldCheck :size="13" aria-hidden="true" />
          Supervisión administrativa
        </Badge>
      </template>
    </PageHeader>

    <PeriodFilterBar
      v-model:fecha-desde="fechaDesde"
      v-model:fecha-hasta="fechaHasta"
      v-model:granularidad="granularidad"
      v-model:vendedor-id="vendedorId"
      v-model:moneda="moneda"
      :fecha-referencia="fechaReferencia"
      :vendedores="vendedoresCache"
      :loading="anyLoading"
      :last-updated-text="lastUpdatedText"
      @apply="loadAll"
      @refresh="loadAll"
    />

    <!-- Indicadores principales (6 tarjetas) -->
    <section aria-label="Indicadores principales">
      <LoadingSkeleton v-if="loadingResumen && !resumen" :lines="4" />
      <ErrorState v-else-if="errorResumen && !resumen" :description="errorResumen">
        <button type="button" @click="fetchResumen()">Reintentar</button>
      </ErrorState>
      <div v-else class="kpi-grid">
        <MetricKpiCard
          label="Proformas formalizadas"
          :value="formatInteger(indComercial?.proformas_formalizadas)"
          :scope-note="periodScopeLabel"
          :approximate="hasApproximateCohort"
          :show-variation="hasPeriodFilter && Boolean(compAnterior)"
          :variation-pct="compAnterior?.proformas_formalizadas.variacion_porcentaje"
          :detail="`Borradores: ${formatInteger(indComercial?.borradores)} · Total: ${formatInteger(indComercial?.total_proformas)}`"
          to="/proformas"
          tone="primary"
        />
        <MetricKpiCard
          label="Pedidos confirmados en el período"
          :value="formatInteger(indComercial?.pedidos_confirmados_periodo)"
          :scope-note="`Confirmados (${periodScopeLabel})`"
          :show-variation="hasPeriodFilter && Boolean(compAnterior)"
          :variation-pct="compAnterior?.pedidos_confirmados_periodo.variacion_porcentaje"
          :detail="`Vigentes no cancelados: ${formatInteger(indComercial?.pedidos_no_cancelados)}`"
          to="/pedidos"
        />
        <MetricKpiCard
          label="Conversión por cohorte"
          :value="formatPercent(indComercial?.tasa_conversion_cohorte)"
          :scope-note="periodScopeLabel"
          :approximate="hasApproximateCohort"
          :detail="`${formatInteger(indComercial?.pedidos_derivados_cohorte)} pedidos derivados de ${formatInteger(indComercial?.proformas_formalizadas)} formalizadas`"
        />
        <MetricKpiCard
          label="Importe de pedidos no cancelados"
          :value="
            primaryFin
              ? formatMoney(primaryFin.importe_pedidos_no_cancelados, primaryFin.moneda)
              : 'Sin datos'
          "
          :scope-note="`Confirmados (${periodScopeLabel})`"
          :detail="secondaryFinSummary || `Cartera vigente ${primaryFin?.moneda ?? ''}`"
          to="/pedidos"
        />
        <MetricKpiCard
          label="Cobros acumulados (cartera)"
          :value="
            primaryFin
              ? formatMoney(primaryFin.cobros_acumulados_cartera_vigente, primaryFin.moneda)
              : 'Sin datos'
          "
          :scope-note="`Avance: ${formatPercent(primaryFin?.porcentaje_cobrado)}`"
          :detail="
            primaryFin
              ? `Cobros realizados en el período: ${formatMoney(primaryFin.cobros_validos_periodo, primaryFin.moneda)}`
              : ''
          "
          to="/recibos"
          tone="success"
        />
        <MetricKpiCard
          label="Saldo pendiente"
          :value="
            primaryFin ? formatMoney(primaryFin.saldo_pendiente, primaryFin.moneda) : 'Sin datos'
          "
          :scope-note="`Cartera vigente (${periodScopeLabel})`"
          :detail="
            finanzas?.cobros_pedidos_cancelados.length
              ? `Cobros en pedidos cancelados (separados): ${finanzas.cobros_pedidos_cancelados.map((c) => formatMoney(c.importe, c.moneda)).join(', ')}`
              : 'Sin cobros asociados a pedidos cancelados'
          "
          to="/pedidos"
          tone="warning"
        />
      </div>
    </section>

    <!-- Evolución comercial -->
    <section class="section-block" aria-label="Evolución comercial">
      <div class="section-block__head">
        <h2>Evolución comercial</h2>
        <p>Conteos e importes monetarios presentados en escalas independientes.</p>
      </div>
      <div class="two-col">
        <BarChartCard
          title="Proformas formalizadas vs. pedidos confirmados"
          :description="`Serie ${granularidad} de actividad comercial.`"
          :labels="evoConteoLabels"
          :series="evoConteoSeries"
          :loading="loadingComercial"
          :error="errorComercial"
          :value-formatter="formatInteger"
          @retry="fetchComercial()"
        />
        <LineAreaChartCard
          title="Importes vigentes y cobros registrados"
          :description="`Serie monetaria ${granularidad} en ${selectedEvoCurrency}.`"
          :labels="evoMoneyLabels"
          :series="evoMoneySeries"
          :loading="loadingComercial"
          :error="errorComercial"
          :value-formatter="(v) => formatMoney(v, selectedEvoCurrency)"
          @retry="fetchComercial()"
        >
          <template v-if="availableEvoCurrencies.length > 1 && !moneda" #controls>
            <select
              v-model="activeMoneyChartCurrency"
              class="inline-select"
              aria-label="Moneda de evolución comercial"
            >
              <option v-for="c in availableEvoCurrencies" :key="c" :value="c">{{ c }}</option>
            </select>
          </template>
        </LineAreaChartCard>
      </div>
    </section>

    <!-- Desempeño de vendedores -->
    <section class="section-block" aria-label="Desempeño de vendedores">
      <div class="section-block__head">
        <h2>Desempeño de vendedores</h2>
        <p>Comparativa por vendedor sin mezclar monedas ni establecer rankings de productividad.</p>
      </div>
      <SellerComparisonPanel
        :sellers="comercial?.vendedores ?? []"
        :selected-currency="moneda"
        :loading="loadingComercial"
        :error="errorComercial"
        @retry="fetchComercial()"
      />
    </section>

    <!-- Finanzas -->
    <section class="section-block" aria-label="Finanzas">
      <div class="section-block__head">
        <h2>Finanzas y conciliación de cartera</h2>
        <p>Estado de cobros acumulados, saldos pendientes por moneda y evolución de recaudación.</p>
      </div>
      <div class="two-col">
        <DonutChartCard
          :title="`Cobros acumulados vs. saldo pendiente (${donutCurrency})`"
          description="Conciliación de la cartera vigente filtrada."
          :slices="donutSlices"
          :loading="loadingFinanzas"
          :error="errorFinanzas"
          :value-formatter="(v) => formatMoney(v, donutCurrency)"
          @retry="fetchFinanzas()"
        >
          <template v-if="finMonedas.length > 1 && !moneda" #controls>
            <select
              v-model="activeDonutCurrency"
              class="inline-select"
              aria-label="Moneda de composición financiera"
            >
              <option v-for="m in finMonedas" :key="m.moneda" :value="m.moneda">
                {{ m.moneda }}
              </option>
            </select>
          </template>
        </DonutChartCard>

        <LineAreaChartCard
          :title="`Evolución temporal de cobros (${cobrosEvoSerie?.moneda ?? donutCurrency})`"
          description="Recibos emitidos válidos sobre pedidos no cancelados."
          :labels="cobrosEvoLabels"
          :series="cobrosEvoSeries"
          :loading="loadingFinanzas"
          :error="errorFinanzas"
          :value-formatter="(v) => formatMoney(v, cobrosEvoSerie?.moneda ?? donutCurrency)"
          @retry="fetchFinanzas()"
        />
      </div>

      <div class="two-col">
        <AnalyticsTableCard
          title="Clientes con mayores saldos pendientes"
          description="Agrupados por cliente y moneda sin sumar divisas distintas."
          :loading="loadingFinanzas"
          :error="errorFinanzas"
          :is-empty="!finanzas?.clientes_mayores_saldos_por_moneda.length"
          @retry="fetchFinanzas()"
        >
          <div class="currency-rankings">
            <div
              v-for="group in finanzas?.clientes_mayores_saldos_por_moneda ?? []"
              :key="group.moneda"
              class="currency-rankings__group"
            >
              <h4>Moneda {{ group.moneda }}</h4>
              <table class="compact-table">
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Pedidos</th>
                    <th scope="col" class="num">Saldo pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="cli in group.clientes"
                    :key="`${group.moneda}-${cli.cliente_id ?? cli.cliente_nombre}`"
                  >
                    <td>
                      <RouterLink
                        v-if="cli.cliente_id"
                        :to="`/clientes/${cli.cliente_id}`"
                        class="table-link"
                      >
                        {{ cli.cliente_nombre }}
                      </RouterLink>
                      <span v-else>{{ cli.cliente_nombre }}</span>
                    </td>
                    <td>{{ formatInteger(cli.cantidad_pedidos) }}</td>
                    <td class="num">{{ formatMoney(cli.saldo_pendiente, group.moneda) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </AnalyticsTableCard>

        <AnalyticsTableCard
          title="Pedidos entregados que mantienen saldo"
          description="Seguimiento de pedidos entregados con saldo por cobrar."
          :loading="loadingFinanzas"
          :error="errorFinanzas"
          :is-empty="!finanzas?.pedidos_entregados_con_saldo.results.length"
          empty-title="Sin saldos en pedidos entregados"
          empty-description="Todos los pedidos entregados del filtro están saldados."
          @retry="fetchFinanzas()"
        >
          <table class="compact-table">
            <thead>
              <tr>
                <th scope="col">Proforma</th>
                <th scope="col">Cliente</th>
                <th scope="col">Entrega</th>
                <th scope="col" class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ped in finanzas?.pedidos_entregados_con_saldo.results ?? []"
                :key="ped.pedido_id"
              >
                <td>
                  <RouterLink :to="`/pedidos/${ped.pedido_id}`" class="table-link">
                    #{{ ped.proforma_numero }}
                  </RouterLink>
                </td>
                <td>{{ ped.cliente_nombre }}</td>
                <td>{{ formatDateLaPaz(ped.fecha_entrega_efectiva) }}</td>
                <td class="num">{{ formatMoney(ped.saldo_pendiente, ped.moneda) }}</td>
              </tr>
            </tbody>
          </table>
        </AnalyticsTableCard>
      </div>
    </section>

    <!-- Supervisión comercial y productiva -->
    <section class="section-block" aria-label="Supervisión comercial y productiva">
      <div class="section-block__head-row">
        <div class="section-block__head">
          <h2>Supervisión comercial y productiva</h2>
          <p>
            Distribuciones actuales de proformas, pedidos y órdenes de trabajo (fabricación vs.
            catálogo).
          </p>
        </div>
        <label class="local-filter">
          <span>Estado de fabricación</span>
          <select
            v-model="estadoFabricacionLocal"
            aria-label="Filtrar estado de fabricación"
            @change="fetchResumen()"
          >
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="TERMINADA">Terminada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </label>
      </div>

      <div class="kpi-grid kpi-grid--compact">
        <MetricKpiCard
          label="Fabricaciones pendientes"
          :value="formatInteger(fabricacionesPendientes)"
          detail="Órdenes a medida sin iniciar"
          to="/ordenes-trabajo"
        />
        <MetricKpiCard
          label="Fabricaciones activas"
          :value="formatInteger(prod?.fabricaciones_activas)"
          detail="Órdenes a medida en proceso"
          to="/ordenes-trabajo"
        />
        <MetricKpiCard
          label="Entregas próximas (7 días)"
          :value="formatInteger(prod?.entregas_proximas)"
          detail="Catálogo y fabricación pendientes"
          to="/ordenes-trabajo"
        />
        <MetricKpiCard
          label="Entregas efectivas"
          :value="formatInteger(prod?.entregas_efectivas)"
          :scope-note="periodScopeLabel"
          :detail="`Retrasadas: ${formatInteger(prod?.entregas_retrasadas)}`"
          :tone="(prod?.entregas_retrasadas ?? 0) > 0 ? 'danger' : 'default'"
        />
        <MetricKpiCard
          label="Cumplimiento de entregas"
          :value="formatPercent(prod?.cumplimiento_entregas_porcentaje)"
          scope-note="Respecto a fecha programada disponible"
          :detail="`${formatInteger(prod?.entregas_en_plazo)} en plazo de ${formatInteger(prod?.entregas_evaluables_plazo)} evaluables`"
          tone="success"
        />
      </div>

      <div class="two-col">
        <StateDistributionCard
          title="Distribución actual de proformas"
          description="Conteo según estado actual."
          :items="indComercial?.distribucion_proformas_estado ?? []"
        />
        <StateDistributionCard
          title="Distribución actual de pedidos"
          description="Conteo según estado actual."
          :items="indComercial?.distribucion_pedidos_estado ?? []"
        />
        <StateDistributionCard
          title="Órdenes funcionales de fabricación"
          description="Exclusivamente ítems de fabricación a medida."
          :items="prod?.ordenes_fabricacion_por_estado ?? []"
        />
        <StateDistributionCard
          title="Órdenes técnicas de catálogo"
          description="Contabilizadas por separado de taller."
          :items="prod?.ordenes_tecnicas_por_estado ?? []"
        />
      </div>
    </section>

    <!-- Inventario -->
    <section class="section-block" aria-label="Inventario">
      <div class="section-block__head-row">
        <div class="section-block__head">
          <h2>Inventario y productos</h2>
          <p>
            Disponibilidad comercial, umbrales configurados y productos más vendidos por unidad.
          </p>
        </div>
        <div class="inventory-controls">
          <label class="local-filter">
            <span>Categoría</span>
            <select
              v-model="categoriaLocal"
              aria-label="Filtrar categoría de inventario"
              @change="onCategoryChange"
            >
              <option value="">Todas las categorías</option>
              <option value="SILLA">Silla</option>
              <option value="PISO_FLOTANTE">Piso flotante</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          <RouterLink
            :to="categoriaLocal ? `/productos?categoria=${categoriaLocal}` : '/productos'"
            class="shortcut-link"
          >
            <Boxes :size="15" aria-hidden="true" />
            Ir a productos
          </RouterLink>
        </div>
      </div>

      <div class="kpi-grid kpi-grid--compact">
        <MetricKpiCard
          label="Productos activos"
          :value="formatInteger(invResumen?.total_activos)"
          :detail="`Con stock: ${formatInteger(invResumen?.con_stock)} · Bajo pedido: ${formatInteger(invResumen?.bajo_pedido)}`"
          to="/productos"
        />
        <MetricKpiCard
          label="Agotados"
          :value="formatInteger(invResumen?.agotados)"
          detail="Productos CON_STOCK en cero"
          :tone="(invResumen?.agotados ?? 0) > 0 ? 'danger' : 'default'"
          to="/productos"
        />
        <MetricKpiCard
          label="Stock bajo"
          :value="
            (invResumen?.sin_stock_minimo ?? 0) > 0 && (invResumen?.stock_bajo ?? 0) === 0
              ? 'No evaluable'
              : formatInteger(invResumen?.stock_bajo)
          "
          :detail="
            (invResumen?.sin_stock_minimo ?? 0) > 0
              ? `${formatInteger(invResumen?.sin_stock_minimo)} productos CON_STOCK sin mínimo configurado`
              : 'Según stock mínimo configurado'
          "
          :tone="(invResumen?.stock_bajo ?? 0) > 0 ? 'warning' : 'default'"
        />
        <MetricKpiCard
          label="CON_STOCK sin mínimo"
          :value="formatInteger(invResumen?.sin_stock_minimo)"
          detail="Requieren umbral mínimo para alertas"
          :tone="(invResumen?.sin_stock_minimo ?? 0) > 0 ? 'warning' : 'success'"
          to="/productos"
        />
      </div>

      <div class="two-col">
        <BarChartCard
          title="Productos por categoría"
          description="Distribución por modalidad de abastecimiento y agotados."
          :labels="invCatLabels"
          :series="invCatSeries"
          horizontal
          :height="260"
          :loading="loadingInventario"
          :error="errorInventario"
          :value-formatter="formatInteger"
          @retry="fetchInventario()"
        />

        <BarChartCard
          title="Productos más vendidos"
          description="Separados por categoría y unidad de medida para evitar mezclar escalas."
          :labels="masVendidosLabels"
          :series="masVendidosSeries"
          horizontal
          :height="260"
          :loading="loadingInventario"
          :error="errorInventario"
          :value-formatter="formatQuantity"
          @retry="fetchInventario()"
        >
          <template v-if="soldUnits.length > 1" #controls>
            <select
              v-model="activeSoldUnitKey"
              class="inline-select"
              aria-label="Categoría y unidad de productos más vendidos"
            >
              <option v-for="u in soldUnits" :key="u.key" :value="u.key">{{ u.label }}</option>
            </select>
          </template>
        </BarChartCard>
      </div>
    </section>

    <!-- Alertas prioritarias -->
    <section class="section-block" aria-label="Alertas prioritarias">
      <div class="section-block__head">
        <h2>Alertas prioritarias</h2>
        <p>Registros concretos que requieren atención operativa y seguimiento directo.</p>
      </div>
      <div class="alerts-grid">
        <AlertListCard
          title="Proformas próximas a vencer"
          :total-count="alertas?.totales.proformas_proximas_vencer ?? 0"
          :items="alertProformas"
          view-all-to="/proformas"
          view-all-label="Ver proformas"
        />
        <AlertListCard
          title="Pedidos retrasados"
          :total-count="alertas?.totales.pedidos_retrasados ?? 0"
          :items="alertPedidosRetrasados"
          view-all-to="/pedidos"
          view-all-label="Ver pedidos"
        />
        <AlertListCard
          title="Fabricaciones retrasadas"
          :total-count="alertas?.totales.fabricaciones_retrasadas ?? 0"
          :items="alertFabricacionesRetrasadas"
          view-all-to="/ordenes-trabajo"
          view-all-label="Ver órdenes"
        />
        <AlertListCard
          title="Pedidos entregados con saldo"
          :total-count="alertas?.totales.saldos_pedidos_entregados ?? 0"
          :items="alertSaldosEntregados"
          view-all-to="/pedidos"
          view-all-label="Ver pedidos"
        />
        <AlertListCard
          title="Productos agotados o stock bajo"
          :total-count="alertas?.totales.productos_stock_bajo ?? 0"
          :items="alertStockBajo"
          view-all-to="/productos"
          view-all-label="Ver productos"
        />
        <AlertListCard
          title="Productos sin mínimo configurado"
          :total-count="alertas?.totales.productos_sin_stock_minimo ?? 0"
          :items="alertSinMinimo"
          view-all-to="/productos"
          view-all-label="Configurar en productos"
        />
      </div>
    </section>

    <Card v-if="indComercial?.limitaciones.length">
      <div class="notes-foot">
        <div class="notes-foot__title">
          <AlertTriangle :size="15" aria-hidden="true" />
          <strong>Notas metodológicas del escenario</strong>
        </div>
        <ul>
          <li v-for="note in indComercial.limitaciones" :key="note">{{ note }}</li>
        </ul>
        <p class="notes-foot__coverage">
          <ClipboardCheck :size="14" aria-hidden="true" />
          Cobertura de formalización:
          {{ formatInteger(indComercial.cobertura_formalizacion.con_marca_temporal) }} con marca
          temporal,
          {{ formatInteger(indComercial.cobertura_formalizacion.aproximadas_por_fecha) }}
          aproximadas por fecha comercial,
          {{
            formatInteger(indComercial.cobertura_formalizacion.anuladas_sin_evidencia_formalizacion)
          }}
          anuladas sin evidencia persistida.
        </p>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.admin-dash {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.admin-dash > *,
.two-col > *,
.alerts-grid > * {
  min-width: 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
  gap: var(--space-4);
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
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text);
}

.section-block__head p {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
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

.alerts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
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

.currency-rankings {
  display: grid;
  gap: var(--space-4);
}

.currency-rankings__group h4 {
  margin: 0 0 var(--space-2);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-secondary);
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
