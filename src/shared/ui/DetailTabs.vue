<script setup lang="ts">
import type { Component } from 'vue'

export interface DetailTabItem {
  id: string
  label: string
  icon: Component
  badge?: string | number
}

defineProps<{
  tabs: DetailTabItem[]
  modelValue: string
  ariaLabel?: string
}>()

defineEmits<{
  'update:modelValue': [id: string]
}>()
</script>

<template>
  <nav class="detail-tabs" role="tablist" :aria-label="ariaLabel || 'Secciones del documento'">
    <button
      v-for="(tab, index) in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :class="{ active: modelValue === tab.id }"
      @click="$emit('update:modelValue', tab.id)"
    >
      <span class="detail-tab__icon">
        <component :is="tab.icon" :size="18" aria-hidden="true" />
      </span>
      <span class="detail-tab__label">
        <small>{{ String(index + 1).padStart(2, '0') }}</small>
        <span>{{ tab.label }}</span>
      </span>
      <span v-if="tab.badge !== undefined" class="detail-tab__badge">{{ tab.badge }}</span>
    </button>
  </nav>
</template>

<style scoped>
.detail-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(11rem, 100%), 1fr));
  gap: 0.65rem;
}
.detail-tabs button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  min-height: 4.1rem;
  padding: 0.75rem 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.detail-tabs button:hover {
  border-color: var(--color-border-strong);
}
.detail-tabs button:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.detail-tabs button.active {
  background: color-mix(in srgb, var(--color-primary-soft) 55%, var(--color-surface));
  color: var(--color-text);
  border-color: var(--color-primary);
  box-shadow: inset 0 -3px 0 var(--color-primary);
}
.detail-tab__icon {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  flex: none;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
}
.detail-tabs button.active .detail-tab__icon {
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.detail-tab__label {
  display: grid;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}
.detail-tab__label small {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
}
.detail-tab__label span {
  font-size: 0.92rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.detail-tab__badge {
  flex: none;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  font-size: 0.76rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.detail-tabs button.active .detail-tab__badge {
  border-color: color-mix(in srgb, var(--color-primary) 28%, transparent);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
@media (max-width: 38rem) {
  .detail-tabs {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
