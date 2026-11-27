<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Calendar, FileSpreadsheet, Filter } from '@lucide/vue'
import { isValidDate, localToday } from '@/shared/validation/dateRange'
import Button from '@/shared/ui/Button.vue'
import Modal from '@/shared/ui/Modal.vue'
import { buildTrayExportFilename, exportRangeError } from './exportExcel'

export type ActiveExportFilter = {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description?: string
    prefix: string
    initialFrom?: string
    initialTo?: string
    activeFilters?: ActiveExportFilter[]
    filenameSegments?: Array<string | number | null | undefined>
    busy?: boolean
    errorMessage?: string
  }>(),
  {
    title: 'Exportar a Excel',
    description: 'Selecciona un rango de fechas obligatorio para generar el reporte.',
    initialFrom: '',
    initialTo: '',
    activeFilters: () => [],
    filenameSegments: () => [],
    busy: false,
    errorMessage: '',
  },
)

const emit = defineEmits<{
  close: []
  confirm: [range: { fechaDesde: string; fechaHasta: string }]
}>()

const from = ref('')
const to = ref('')
const badFrom = ref(false)
const badTo = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    from.value = (props.initialFrom ?? '').trim()
    to.value = (props.initialTo ?? '').trim()
    badFrom.value = false
    badTo.value = false
  },
  { immediate: true },
)

const today = computed(() => localToday())
const fromMax = computed(() => (to.value && to.value < today.value ? to.value : today.value))
const toMin = computed(() => from.value || undefined)

const fromError = computed(() => {
  if (badFrom.value) return 'Ingresa una fecha válida.'
  if (!from.value) return 'La fecha inicial es obligatoria.'
  if (!isValidDate(from.value)) return 'Ingresa una fecha válida.'
  if (from.value > today.value) return 'La fecha no puede ser futura.'
  if (to.value && isValidDate(to.value) && from.value > to.value) {
    return 'La fecha inicial no puede ser posterior a la fecha final.'
  }
  return ''
})

const toError = computed(() => {
  if (badTo.value) return 'Ingresa una fecha válida.'
  if (!to.value) return 'La fecha final es obligatoria.'
  if (!isValidDate(to.value)) return 'Ingresa una fecha válida.'
  if (to.value > today.value) return 'La fecha no puede ser futura.'
  if (from.value && isValidDate(from.value) && to.value < from.value) {
    return 'La fecha final no puede ser anterior a la fecha inicial.'
  }
  return ''
})

const rangeError = computed(() => {
  if (badFrom.value || badTo.value) return 'Ingresa una fecha válida.'
  return exportRangeError(from.value, to.value, today.value)
})

const visibleFilters = computed(() =>
  props.activeFilters.filter((f) => Boolean(f.value && f.value.trim())),
)

const predictedFilename = computed(() =>
  buildTrayExportFilename(
    props.prefix,
    props.filenameSegments,
    from.value || 'YYYY-MM-DD',
    to.value || 'YYYY-MM-DD',
  ),
)

function onDateInput(kind: 'from' | 'to', el: HTMLInputElement) {
  const bad = Boolean(el.validity?.badInput)
  if (kind === 'from') {
    badFrom.value = bad
    from.value = el.value.trim()
  } else {
    badTo.value = bad
    to.value = el.value.trim()
  }
}

function submit() {
  if (rangeError.value || props.busy) return
  emit('confirm', { fechaDesde: from.value, fechaHasta: to.value })
}
</script>

<template>
  <Modal :open="open" :title="title" :description="description" @close="emit('close')">
    <template #title-icon>
      <FileSpreadsheet :size="20" aria-hidden="true" />
    </template>

    <div class="export-modal">
      <div class="export-modal__dates">
        <label
          class="export-modal__field"
          :class="{ 'export-modal__field--error': Boolean(fromError) }"
        >
          <span>
            <Calendar :size="14" aria-hidden="true" />
            Fecha inicial *
          </span>
          <input
            type="date"
            name="export_fecha_desde"
            aria-label="Fecha inicial para exportar"
            :value="from"
            :max="fromMax"
            :aria-invalid="Boolean(fromError) || undefined"
            required
            @input="onDateInput('from', $event.target as HTMLInputElement)"
            @change="onDateInput('from', $event.target as HTMLInputElement)"
          />
          <small v-if="fromError" class="export-modal__error" role="alert">
            {{ fromError }}
          </small>
        </label>

        <label
          class="export-modal__field"
          :class="{ 'export-modal__field--error': Boolean(toError) }"
        >
          <span>
            <Calendar :size="14" aria-hidden="true" />
            Fecha final *
          </span>
          <input
            type="date"
            name="export_fecha_hasta"
            aria-label="Fecha final para exportar"
            :value="to"
            :min="toMin"
            :max="today"
            :aria-invalid="Boolean(toError) || undefined"
            required
            @input="onDateInput('to', $event.target as HTMLInputElement)"
            @change="onDateInput('to', $event.target as HTMLInputElement)"
          />
          <small v-if="toError" class="export-modal__error" role="alert">
            {{ toError }}
          </small>
        </label>
      </div>

      <section class="export-modal__summary" aria-label="Resumen de filtros activos">
        <div class="export-modal__summary-title">
          <Filter :size="14" aria-hidden="true" />
          <strong>Filtros activos</strong>
        </div>
        <ul v-if="visibleFilters.length" class="export-modal__chips">
          <li v-for="filter in visibleFilters" :key="filter.label" class="export-modal__chip">
            <span>{{ filter.label }}:</span> <strong>{{ filter.value }}</strong>
          </li>
        </ul>
        <p v-else class="export-modal__empty">
          Sin filtros adicionales; se exportarán todos los registros dentro del rango seleccionado.
        </p>
      </section>

      <div class="export-modal__filename">
        <span>Archivo previsto</span>
        <code>{{ predictedFilename }}</code>
      </div>

      <p v-if="errorMessage" class="export-modal__error" role="alert">
        {{ errorMessage }}
      </p>
    </div>

    <template #footer>
      <div class="export-modal__actions">
        <Button type="button" variant="secondary" :disabled="busy" @click="emit('close')">
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          :disabled="Boolean(rangeError) || busy"
          :processing="busy"
          processing-label="Exportando…"
          @click="submit"
        >
          Exportar Excel
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.export-modal {
  display: grid;
  gap: var(--space-4);
}

.export-modal__dates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-3);
}

.export-modal__field {
  display: grid;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.export-modal__field > span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.export-modal__field input {
  width: 100%;
  min-height: 2.5rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.export-modal__field--error input {
  border-color: var(--color-danger);
}

.export-modal__error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.78rem;
  font-weight: 600;
}

.export-modal__summary {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}

.export-modal__summary-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--color-text);
}

.export-modal__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.export-modal__chip {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.export-modal__chip strong {
  color: var(--color-text);
}

.export-modal__empty {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.export-modal__filename {
  display: grid;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.export-modal__filename code {
  padding: 0.45rem 0.65rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 0.8rem;
  word-break: break-all;
}

.export-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
