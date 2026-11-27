<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Calendar, SlidersHorizontal } from '@lucide/vue'
import { dateRangeError, isValidDate, localToday } from '@/shared/validation/dateRange'
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
    showSeller?: boolean
    showCurrency?: boolean
  }>(),
  {
    vendedorId: null,
    vendedores: () => [],
    moneda: '',
    monedas: () => ['BOB', 'USD'],
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
}>()

const preset = ref<PeriodPresetKey>('todo')
const mobileExpanded = ref(false)
const invalidDesdeInput = ref(false)
const invalidHastaInput = ref(false)

const presets: Array<{ key: PeriodPresetKey; label: string }> = [
  { key: 'todo', label: 'Todo el período' },
  { key: 'este_mes', label: 'Mes en curso' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: 'ultimos_30_dias', label: 'Últimos 30 días' },
  { key: 'ultimos_7_dias', label: 'Últimos 7 días' },
  { key: 'personalizado', label: 'Personalizado' },
]

const activePeriodSummary = computed(() => {
  if (props.fechaDesde && props.fechaHasta) {
    return `${formatDateLaPaz(props.fechaDesde)} – ${formatDateLaPaz(props.fechaHasta)}`
  }
  return presets.find((p) => p.key === preset.value)?.label ?? 'Todo el período'
})

const maxDate = computed(() => props.fechaReferencia || localToday())
const desdeMax = computed(() =>
  props.fechaHasta && props.fechaHasta < maxDate.value ? props.fechaHasta : maxDate.value,
)
const desdeError = computed(() => {
  if (invalidDesdeInput.value) return 'Ingresa una fecha válida.'
  const from = props.fechaDesde ?? ''
  if (!from) return ''
  if (!isValidDate(from)) return 'Ingresa una fecha válida.'
  if (maxDate.value && from > maxDate.value) return 'La fecha no puede ser futura.'
  if (props.fechaHasta && isValidDate(props.fechaHasta) && from > props.fechaHasta) {
    return 'La fecha inicial no puede ser posterior a la fecha final.'
  }
  return ''
})
const hastaError = computed(() => {
  if (invalidHastaInput.value) return 'Ingresa una fecha válida.'
  const to = props.fechaHasta ?? ''
  if (!to) return ''
  if (!isValidDate(to)) return 'Ingresa una fecha válida.'
  if (maxDate.value && to > maxDate.value) return 'La fecha no puede ser futura.'
  if (props.fechaDesde && isValidDate(props.fechaDesde) && props.fechaDesde > to) {
    return 'La fecha final no puede ser anterior a la fecha inicial.'
  }
  return ''
})
const rangeError = computed(() => {
  if (invalidDesdeInput.value || invalidHastaInput.value) return 'Ingresa una fecha válida.'
  return dateRangeError(props.fechaDesde ?? '', props.fechaHasta ?? '', maxDate.value)
})

watch(
  () => [props.fechaDesde, props.fechaHasta],
  ([desde, hasta]) => {
    if (!desde && !hasta && !invalidDesdeInput.value && !invalidHastaInput.value) {
      preset.value = 'todo'
    }
  },
)

function onPresetChange(next: PeriodPresetKey) {
  preset.value = next
  invalidDesdeInput.value = false
  invalidHastaInput.value = false
  if (next === 'personalizado') return
  const refDate = props.fechaReferencia || localToday()
  const range = buildPeriodPreset(next, refDate)
  emit('update:fechaDesde', range.fecha_desde)
  emit('update:fechaHasta', range.fecha_hasta)
  emit('apply')
}

function onCustomDateInput(kind: 'desde' | 'hasta', el: HTMLInputElement) {
  preset.value = 'personalizado'
  const bad = Boolean(el.validity?.badInput)
  if (kind === 'desde') invalidDesdeInput.value = bad
  else invalidHastaInput.value = bad
  const clean = el.value.trim() || null
  const nextDesde = kind === 'desde' ? clean : props.fechaDesde
  const nextHasta = kind === 'hasta' ? clean : props.fechaHasta
  if (kind === 'desde') emit('update:fechaDesde', clean)
  else emit('update:fechaHasta', clean)
  if (
    !bad &&
    !invalidDesdeInput.value &&
    !invalidHastaInput.value &&
    !dateRangeError(nextDesde ?? '', nextHasta ?? '', maxDate.value)
  ) {
    emit('apply')
  }
}

function onSellerChange(value: string) {
  emit('update:vendedorId', value ? Number(value) : null)
  if (!rangeError.value) emit('apply')
}

function onCurrencyChange(value: string) {
  emit('update:moneda', value)
  if (!rangeError.value) emit('apply')
}

function onGranularityChange(value: string) {
  emit('update:granularidad', value as 'diaria' | 'semanal' | 'mensual')
  if (!rangeError.value) emit('apply')
}
</script>

<template>
  <section class="period-bar" aria-label="Filtros analíticos del dashboard">
    <div class="period-bar__mobile-summary">
      <div class="period-bar__mobile-period">
        <Calendar :size="14" aria-hidden="true" />
        <span
          >Período: <strong>{{ activePeriodSummary }}</strong></span
        >
      </div>
      <button
        type="button"
        class="period-bar__toggle"
        :aria-expanded="mobileExpanded"
        aria-controls="admin-period-filters"
        @click="mobileExpanded = !mobileExpanded"
      >
        <SlidersHorizontal :size="14" aria-hidden="true" />
        {{ mobileExpanded ? 'Ocultar filtros' : 'Filtros' }}
      </button>
    </div>

    <div
      id="admin-period-filters"
      class="period-bar__controls"
      :class="{ 'is-expanded': mobileExpanded }"
    >
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

      <label class="period-bar__field" :class="{ 'period-bar__field--error': Boolean(desdeError) }">
        <span>Desde</span>
        <input
          type="date"
          aria-label="Fecha desde"
          :value="fechaDesde ?? ''"
          :max="desdeMax"
          :aria-invalid="Boolean(desdeError) || undefined"
          @change="onCustomDateInput('desde', $event.target as HTMLInputElement)"
        />
        <small v-if="desdeError" class="period-bar__field-error" role="alert">
          {{ desdeError }}
        </small>
      </label>

      <label class="period-bar__field" :class="{ 'period-bar__field--error': Boolean(hastaError) }">
        <span>Hasta</span>
        <input
          type="date"
          aria-label="Fecha hasta"
          :value="fechaHasta ?? ''"
          :min="fechaDesde || undefined"
          :max="maxDate"
          :aria-invalid="Boolean(hastaError) || undefined"
          @change="onCustomDateInput('hasta', $event.target as HTMLInputElement)"
        />
        <small v-if="hastaError" class="period-bar__field-error" role="alert">
          {{ hastaError }}
        </small>
      </label>

      <label class="period-bar__field">
        <span>Agrupar por</span>
        <select
          :value="granularidad"
          aria-label="Agrupar por"
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

    <div v-if="rangeError && !desdeError && !hastaError" class="period-bar__meta">
      <span class="period-bar__error" role="alert">
        {{ rangeError }}
      </span>
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

.period-bar__mobile-summary {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.period-bar__mobile-period {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.period-bar__mobile-period strong {
  color: var(--color-text);
}

.period-bar__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  color: var(--color-text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.period-bar__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(10rem, 100%), 1fr));
  gap: var(--space-3);
}

@media (max-width: 767px) {
  .period-bar__mobile-summary {
    display: flex;
  }

  .period-bar__controls {
    display: none;
  }

  .period-bar__controls.is-expanded {
    display: grid;
  }
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

.period-bar__field--error input {
  border-color: var(--color-danger);
}

.period-bar__field-error {
  color: var(--color-danger);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
}
</style>
