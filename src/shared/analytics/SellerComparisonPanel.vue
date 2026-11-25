<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ComparacionVendedor } from '@/generated/api'
import Card from '@/shared/ui/Card.vue'
import ClientAvatar from '@/shared/ui/ClientAvatar.vue'
import CreatorTag from '@/shared/ui/CreatorTag.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import BarChartCard from './BarChartCard.vue'
import { formatInteger, formatMoney, formatPercent, toNumber } from './formatters'

type SellerMetricKey =
  | 'conversion_comercial'
  | 'proformas_formalizadas'
  | 'pedidos_generados'
  | 'importe_pedidos_no_cancelados'
  | 'cobros_validos'
  | 'saldo_pendiente'

const props = withDefaults(
  defineProps<{
    sellers: ComparacionVendedor[]
    selectedCurrency?: string
    loading?: boolean
    error?: string
  }>(),
  {
    selectedCurrency: '',
    loading: false,
    error: '',
  },
)

const emit = defineEmits<{ retry: [] }>()

const metric = ref<SellerMetricKey>('proformas_formalizadas')

const availableCurrencies = computed(() => {
  const set = new Set<string>()
  for (const s of props.sellers) {
    for (const m of s.montos_por_moneda) set.add(m.moneda)
  }
  return Array.from(set).sort()
})

const activeCurrency = computed(() => {
  if (props.selectedCurrency) return props.selectedCurrency
  return availableCurrencies.value[0] ?? 'BOB'
})

const isMonetaryMetric = computed(
  () =>
    metric.value === 'importe_pedidos_no_cancelados' ||
    metric.value === 'cobros_validos' ||
    metric.value === 'saldo_pendiente',
)

const metricLabels: Record<SellerMetricKey, string> = {
  proformas_formalizadas: 'Proformas formalizadas',
  pedidos_generados: 'Pedidos derivados de cohorte',
  conversion_comercial: 'Conversión comercial (%)',
  importe_pedidos_no_cancelados: 'Importe de pedidos vigentes',
  cobros_validos: 'Cobros acumulados',
  saldo_pendiente: 'Saldo pendiente',
}

function sellerAmount(seller: ComparacionVendedor, moneda: string) {
  return seller.montos_por_moneda.find((m) => m.moneda === moneda)
}

const chartLabels = computed(() => props.sellers.map((s) => s.vendedor_nombre))

const chartSeries = computed(() => {
  const key = metric.value
  const data = props.sellers.map((s) => {
    if (key === 'proformas_formalizadas') return s.proformas_formalizadas
    if (key === 'pedidos_generados') return s.pedidos_generados
    if (key === 'conversion_comercial') return toNumber(s.conversion_comercial) ?? 0
    const row = sellerAmount(s, activeCurrency.value)
    return toNumber(row?.[key]) ?? 0
  })
  return [
    {
      name: isMonetaryMetric.value
        ? `${metricLabels[key]} (${activeCurrency.value})`
        : metricLabels[key],
      data,
      colorKey: key === 'saldo_pendiente' ? ('warning' as const) : ('primary' as const),
    },
  ]
})

function chartValueFormatter(val: number): string {
  if (metric.value === 'conversion_comercial') return formatPercent(val)
  if (isMonetaryMetric.value) return formatMoney(val, activeCurrency.value)
  return formatInteger(val)
}
</script>

<template>
  <div class="seller-panel">
    <BarChartCard
      :title="`Comparación por vendedor — ${metricLabels[metric]}`"
      :description="
        isMonetaryMetric
          ? `Valores expresados en ${activeCurrency} sin mezclar otras monedas.`
          : 'Indicadores comerciales por vendedor según los filtros activos.'
      "
      :labels="chartLabels"
      :series="chartSeries"
      horizontal
      :height="Math.max(220, sellers.length * 56 + 60)"
      :loading="loading"
      :error="error"
      :value-formatter="chartValueFormatter"
      @retry="emit('retry')"
    >
      <template #controls>
        <label class="seller-panel__select">
          <span>Indicador</span>
          <select v-model="metric" aria-label="Indicador de comparación de vendedores">
            <option v-for="(label, key) in metricLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </label>
      </template>
    </BarChartCard>

    <Card>
      <div class="seller-panel__head">
        <h3>Detalle por vendedor</h3>
        <span v-if="availableCurrencies.length > 1" class="seller-panel__note">
          Montos separados por moneda ({{ availableCurrencies.join(' / ') }})
        </span>
      </div>

      <ErrorState v-if="error" :description="error">
        <button type="button" @click="emit('retry')">Reintentar</button>
      </ErrorState>
      <EmptyState
        v-else-if="!sellers.length"
        title="Sin actividad de vendedores"
        description="No se registraron operaciones de vendedores en el período seleccionado."
      />
      <div
        v-else
        class="seller-panel__table-wrap"
        tabindex="0"
        role="region"
        aria-label="Tabla comparativa por vendedor"
      >
        <table class="seller-table">
          <thead>
            <tr>
              <th scope="col">Vendedor</th>
              <th scope="col">Formalizadas</th>
              <th scope="col">Pedidos</th>
              <th scope="col">Conversión</th>
              <th scope="col">Importe vigente</th>
              <th scope="col">Cobros acumulados</th>
              <th scope="col">Saldo pendiente</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="seller in sellers" :key="seller.vendedor_id">
              <td>
                <div class="seller-cell">
                  <ClientAvatar
                    :name="seller.vendedor_nombre"
                    :id="seller.vendedor_id"
                    :size="28"
                  />
                  <CreatorTag :name="seller.vendedor_nombre" />
                </div>
              </td>
              <td class="num">{{ formatInteger(seller.proformas_formalizadas) }}</td>
              <td class="num">{{ formatInteger(seller.pedidos_generados) }}</td>
              <td class="num">{{ formatPercent(seller.conversion_comercial) }}</td>
              <td class="num">
                <template v-if="seller.montos_por_moneda.length">
                  <div v-for="m in seller.montos_por_moneda" :key="m.moneda">
                    {{ formatMoney(m.importe_pedidos_no_cancelados, m.moneda) }}
                  </div>
                </template>
                <span v-else>—</span>
              </td>
              <td class="num">
                <template v-if="seller.montos_por_moneda.length">
                  <div v-for="m in seller.montos_por_moneda" :key="m.moneda">
                    {{ formatMoney(m.cobros_validos, m.moneda) }}
                  </div>
                </template>
                <span v-else>—</span>
              </td>
              <td class="num">
                <template v-if="seller.montos_por_moneda.length">
                  <div v-for="m in seller.montos_por_moneda" :key="m.moneda">
                    {{ formatMoney(m.saldo_pendiente, m.moneda) }}
                  </div>
                </template>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.seller-panel {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.seller-panel > * {
  min-width: 0;
}

.seller-panel__select {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.seller-panel__select select {
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.seller-panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.seller-panel__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.seller-panel__note {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.seller-panel__table-wrap {
  overflow-x: auto;
}

.seller-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.seller-table th,
.seller-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: middle;
}

.seller-table th {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.seller-table td.num,
.seller-table th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.seller-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
