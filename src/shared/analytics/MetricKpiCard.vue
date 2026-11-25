<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import TrendBadge from './TrendBadge.vue'

withDefaults(
  defineProps<{
    label: string
    value: string
    icon?: Component
    scopeNote?: string
    detail?: string
    approximate?: boolean
    variationPct?: string | number | null
    showVariation?: boolean
    to?: RouteLocationRaw
    tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  }>(),
  {
    icon: undefined,
    scopeNote: '',
    detail: '',
    approximate: false,
    variationPct: null,
    showVariation: false,
    to: undefined,
    tone: 'default',
  },
)
</script>

<template>
  <component
    :is="to ? RouterLink : 'article'"
    :to="to"
    class="metric-kpi"
    :class="[`metric-kpi--${tone}`, { 'metric-kpi--link': Boolean(to) }]"
  >
    <div class="metric-kpi__top">
      <span class="metric-kpi__label">
        <component :is="icon" v-if="icon" :size="15" class="metric-kpi__icon" aria-hidden="true" />
        {{ label }}
      </span>
      <span
        v-if="approximate"
        class="metric-kpi__approx"
        title="Contiene registros históricos aproximados"
      >
        ~ aprox.
      </span>
    </div>
    <strong class="metric-kpi__value">{{ value }}</strong>
    <p v-if="scopeNote" class="metric-kpi__scope">{{ scopeNote }}</p>
    <TrendBadge v-if="showVariation" :variacion-porcentaje="variationPct" />
    <small v-if="detail" class="metric-kpi__detail">{{ detail }}</small>
  </component>
</template>

<style scoped>
.metric-kpi {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
  min-height: 7.75rem;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.metric-kpi--link:hover {
  border-color: var(--color-primary-accent);
  background: var(--color-surface-raised);
}

.metric-kpi--primary {
  border-top: 3px solid var(--color-primary);
}

.metric-kpi--success {
  border-top: 3px solid var(--color-success);
}

.metric-kpi--warning {
  border-top: 3px solid var(--color-warning);
}

.metric-kpi--danger {
  border-top: 3px solid var(--color-danger);
}

.metric-kpi__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.metric-kpi__label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.metric-kpi__icon {
  flex: none;
  color: var(--color-text-secondary);
}

.metric-kpi__approx {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  white-space: nowrap;
}

.metric-kpi__value {
  font-size: 1.65rem;
  line-height: 2rem;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.metric-kpi__scope {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.metric-kpi__detail {
  margin-top: auto;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}
</style>
