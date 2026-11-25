<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Clock3, History } from '@lucide/vue'
import { presentarFecha, type PresentacionFecha } from '@/shared/date/presentacionFecha'

const props = defineProps<{
  presentation?: PresentacionFecha
  timestamp?: string | null
  date?: string
  now?: number
  hideMissingHour?: boolean
}>()

const resolved = computed<PresentacionFecha>(() => {
  if (props.presentation) return props.presentation
  const fallbackDate = props.date ?? (props.timestamp ? props.timestamp.slice(0, 10) : '')
  return presentarFecha(props.timestamp, fallbackDate, props.now)
})
</script>

<template>
  <div
    class="date-pres creation-cell"
    :class="{ 'date-pres--historical': resolved.historica }"
    :title="resolved.historica ? 'Registro histórico sin hora registrada' : undefined"
  >
    <div
      class="date-pres__primary creation-primary"
      :class="{
        'date-pres__primary--recent': resolved.reciente,
        'creation-primary--recent': resolved.reciente,
      }"
    >
      <History v-if="resolved.mostrarFechaSeparada" :size="15" aria-hidden="true" />
      <Calendar v-else :size="15" aria-hidden="true" />
      <strong>{{ resolved.principal }}</strong>
    </div>

    <div v-if="resolved.hora" class="date-pres__meta creation-hour">
      <Clock3 :size="13" aria-hidden="true" />
      <time :datetime="timestamp ?? undefined">{{ resolved.hora }}</time>
    </div>
    <span v-else-if="!hideMissingHour" class="date-pres__meta creation-hour"
      >Hora no registrada</span
    >

    <div v-if="resolved.mostrarFechaSeparada" class="date-pres__date creation-date">
      <Calendar :size="13" aria-hidden="true" />
      <span>{{ resolved.fecha }}</span>
    </div>
  </div>
</template>

<style scoped>
.date-pres {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
}
.date-pres__primary {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text);
  font-size: 0.86rem;
}
.date-pres__primary svg {
  flex: none;
  color: var(--color-text-secondary);
}
.date-pres__primary--recent svg {
  color: var(--color-primary-accent);
}
.date-pres__meta,
.date-pres__date {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  color: var(--color-text-secondary);
  font-size: 0.77rem;
  font-variant-numeric: tabular-nums;
}
.date-pres__meta svg,
.date-pres__date svg {
  flex: none;
  opacity: 0.8;
}
</style>
