<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Calendar, RefreshCw } from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
import { buildPeriodPreset, formatDateLaPaz, type PeriodPresetKey } from './formatters'

export interface SellerOption {
  id: number
  nombre: string
}

const props = withDefaults(
  defineProps<{
    fechaReferencia: string | null
    fechaDesde: string | null
    fechaHasta: string | null
    granularidad: 'diaria' | 'semanal' | 'mensual'
    vendedorId?: number | null
    vendedores?: SellerOption[]
    moneda?: string
    monedas?: string[]
    loading?: boolean
    lastUpdatedText?: string
    showSeller?: boolean
    showCurrency?: boolean
  }>(),
  {
    vendedorId: null,
    vendedores: () => [],
    moneda: '',
    monedas: () => ['BOB', 'USD'],
    loading: false,
    lastUpdatedText: '',
    showSeller: true,
    showCurrency: true,
  },
)

const emit = defineEmits<{
  'update:fechaDesde': [value: string | null]
  'update:fechaHasta': [value: string | null]
  'update:granularidad': [value: 'diaria' | 'semanal' | 'mensual']
  'update:vendedorId': [value: number | null]
  'update:moneda': [value: string]
  apply: []
  refresh: []
}>()

const preset = ref<PeriodPresetKey>('todo')

const presets: Array<{ key: PeriodPresetKey; label: string }> = [
  { key: 'todo', label: 'Todo el período' },
  { key: 'este_mes', label: 'Mes en curso' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: 'ultimos_30_dias', label: 'Últimos 30 días' },
  { key: 'ultimos_7_dias', label: 'Últimos 7 días' },
  { key: 'personalizado', label: 'Personalizado' },
]

const invalidRange = computed(() =>
  Boolean(props.fechaDesde && props.fechaHasta && props.fechaDesde > props.fechaHasta),
)

watch(
  () => [props.fechaDesde, props.fechaHasta],
  ([desde, hasta]) => {
    if (!desde && !hasta) {
      preset.value = 'todo'
    }
  },
)

function onPresetChange(next: PeriodPresetKey) {
  preset.value = next
  if (next === 'personalizado') return
  const refDate = props.fechaReferencia || new Date().toISOString().slice(0, 10)
  const range = buildPeriodPreset(next, refDate)
  emit('update:fechaDesde', range.fecha_desde)
  emit('update:fechaHasta', range.fecha_hasta)
  emit('apply')
}

function onCustomDateChange(kind: 'desde' | 'hasta', value: string) {
  preset.value = 'personalizado'
  const clean = value.trim() || null
  if (kind === 'desde') emit('update:fechaDesde', clean)
  else emit('update:fechaHasta', clean)
  if (!invalidRange.value) emit('apply')
}

function onSellerChange(value: string) {
  emit('update:vendedorId', value ? Number(value) : null)
  emit('apply')
}

function onCurrencyChange(value: string) {
  emit('update:moneda', value)
  emit('apply')
}

function onGranularityChange(value: string) {
  emit('update:granularidad', value as 'diaria' | 'semanal' | 'mensual')
  emit('apply')
}
</script>

<template>
  <section class="period-bar" aria-label="Filtros analíticos del dashboard">
    <div class="period-bar__controls">
      <label class="period-bar__field">
        <span>Período</span>
        <select
          :value="preset"
          aria-label="Selector de período"
          @change="onPresetChange(($event.target as HTMLSelectElement).value as PeriodPresetKey)"
        >
          <option v-for="item in presets" :key="item.key" :value="item.key">
            {{ item.label }}
          </option>
        </select>
      </label>

      <label class="period-bar__field">
        <span>Desde</span>
        <input
          type="date"
          aria-label="Fecha desde"
          :value="fechaDesde ?? ''"
          @change="onCustomDateChange('desde', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="period-bar__field">
        <span>Hasta</span>
        <input
          type="date"
          aria-label="Fecha hasta"
          :value="fechaHasta ?? ''"
          @change="onCustomDateChange('hasta', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="period-bar__field">
        <span>Granularidad</span>
        <select
          :value="granularidad"
          aria-label="Granularidad temporal"
          @change="onGranularityChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="diaria">Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
        </select>
      </label>

      <label v-if="showSeller" class="period-bar__field">
        <span>Vendedor</span>
        <select
          :value="vendedorId ?? ''"
          aria-label="Filtrar por vendedor"
          @change="onSellerChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Todos los vendedores</option>
          <option v-for="v in vendedores" :key="v.id" :value="v.id">{{ v.nombre }}</option>
        </select>
      </label>

      <label v-if="showCurrency" class="period-bar__field">
        <span>Moneda</span>
        <select
          :value="moneda"
          aria-label="Filtrar por moneda"
          @change="onCurrencyChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Todas (separadas)</option>
          <option v-for="m in monedas" :key="m" :value="m">{{ m }}</option>
        </select>
      </label>
    </div>

    <div class="period-bar__meta">
      <div class="period-bar__dates">
        <span v-if="fechaReferencia" class="period-bar__chip">
          <Calendar :size="14" aria-hidden="true" />
          Corte: {{ formatDateLaPaz(fechaReferencia) }}
        </span>
        <span v-if="lastUpdatedText" class="period-bar__updated">
          Actualizado: {{ lastUpdatedText }}
        </span>
        <span v-if="invalidRange" class="period-bar__error" role="alert">
          La fecha inicial no puede superar la fecha final.
        </span>
      </div>
      <Button variant="secondary" :disabled="loading" @click="emit('refresh')">
        <RefreshCw :size="15" aria-hidden="true" />Actualizar
      </Button>
    </div>
  </section>
</template>

<style scoped>
.period-bar {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.period-bar__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(10rem, 100%), 1fr));
  gap: var(--space-3);
}

.period-bar__field {
  display: grid;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.period-bar__field select,
.period-bar__field input {
  width: 100%;
  min-height: 2.25rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 500;
}

.period-bar__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.period-bar__dates {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.period-bar__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  color: var(--color-text);
}

.period-bar__error {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
