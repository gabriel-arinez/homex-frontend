<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/shared/ui/Card.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import { formatInteger } from './formatters'

export interface StateDistributionItem {
  codigo: string
  nombre: string
  cantidad: number
}

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    items: StateDistributionItem[]
    emptyText?: string
  }>(),
  {
    description: '',
    emptyText: 'Sin registros para esta distribución.',
  },
)

const total = computed(() => props.items.reduce((sum, x) => sum + x.cantidad, 0))
const max = computed(() => Math.max(1, ...props.items.map((x) => x.cantidad)))

const rows = computed(() =>
  props.items.map((item) => ({
    ...item,
    width: item.cantidad === 0 ? 0 : Math.max(4, Math.round((item.cantidad / max.value) * 100)),
    share: total.value > 0 ? ((item.cantidad / total.value) * 100).toFixed(1) : '0.0',
  })),
)
</script>

<template>
  <Card>
    <div class="state-dist__head">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description" class="state-dist__desc">{{ description }}</p>
      </div>
      <span class="state-dist__total">Total: {{ formatInteger(total) }}</span>
    </div>

    <EmptyState v-if="!items.length" title="Sin datos" :description="emptyText" />
    <ul v-else class="state-dist__list">
      <li v-for="row in rows" :key="row.codigo" class="state-dist__row">
        <div class="state-dist__meta">
          <StatusBadge :status="row.codigo" :label="row.nombre" />
          <span class="state-dist__count">
            <strong>{{ formatInteger(row.cantidad) }}</strong>
            <small>({{ row.share }}%)</small>
          </span>
        </div>
        <div class="state-dist__track" aria-hidden="true">
          <div class="state-dist__fill" :style="{ width: `${row.width}%` }" />
        </div>
      </li>
    </ul>
  </Card>
</template>

<style scoped>
.state-dist__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.state-dist__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.state-dist__desc {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.state-dist__total {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.state-dist__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.state-dist__row {
  display: grid;
  gap: 0.35rem;
}

.state-dist__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.state-dist__count {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  font-variant-numeric: tabular-nums;
}

.state-dist__count small {
  color: var(--color-text-secondary);
}

.state-dist__track {
  height: 0.45rem;
  border-radius: 999px;
  background: var(--color-surface-hover);
  overflow: hidden;
}

.state-dist__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-primary);
  transition: width var(--transition-fast);
}
</style>
