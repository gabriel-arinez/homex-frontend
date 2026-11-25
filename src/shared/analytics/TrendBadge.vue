<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDownRight, ArrowUpRight, Minus } from '@lucide/vue'
import { formatPercent, toNumber } from './formatters'

const props = withDefaults(
  defineProps<{
    variacionPorcentaje: string | number | null | undefined
    diferencia?: string | number | null
    invertSemantic?: boolean
    label?: string
  }>(),
  {
    diferencia: null,
    invertSemantic: false,
    label: 'vs período anterior',
  },
)

const pct = computed(() => toNumber(props.variacionPorcentaje))

const tone = computed(() => {
  if (pct.value === null || pct.value === 0) return 'neutral'
  const positive = pct.value > 0
  if (props.invertSemantic) return positive ? 'danger' : 'success'
  return positive ? 'success' : 'danger'
})

const formatted = computed(() => {
  if (pct.value === null) return 'Sin base comparable'
  const prefix = pct.value > 0 ? '+' : ''
  return `${prefix}${formatPercent(pct.value)}`
})
</script>

<template>
  <span class="trend-badge" :class="`trend-badge--${tone}`">
    <ArrowUpRight v-if="pct !== null && pct > 0" :size="13" aria-hidden="true" />
    <ArrowDownRight v-else-if="pct !== null && pct < 0" :size="13" aria-hidden="true" />
    <Minus v-else :size="13" aria-hidden="true" />
    <span>{{ formatted }}</span>
    <span v-if="pct !== null && label" class="trend-badge__label">{{ label }}</span>
  </span>
</template>

<style scoped>
.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  width: fit-content;
}

.trend-badge--success {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
}

.trend-badge--danger {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
}

.trend-badge--neutral {
  background: var(--badge-neutral-bg);
  color: var(--badge-neutral-text);
}

.trend-badge__label {
  font-weight: 400;
  opacity: 0.9;
}
</style>
