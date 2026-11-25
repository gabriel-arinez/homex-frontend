<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { FormFieldChange } from '@/shared/forms/useFormChanges'

defineProps<{
  changes?: FormFieldChange[]
}>()
</script>

<template>
  <div v-if="changes?.length" class="change-summary" aria-label="Resumen de cambios pendientes">
    <p class="change-summary__heading">
      {{ changes.length === 1 ? '1 campo modificado:' : `${changes.length} campos modificados:` }}
    </p>
    <ul class="change-summary__list">
      <li v-for="item in changes" :key="item.key" class="change-summary__item">
        <span class="change-summary__label">{{ item.label }}</span>
        <span class="change-summary__values">
          <span class="change-summary__before">{{ item.before }}</span>
          <ArrowRight :size="13" class="change-summary__arrow" aria-hidden="true" />
          <span class="change-summary__after">{{ item.after }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.change-summary {
  margin-top: 0.85rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-subtle, var(--color-surface));
  display: grid;
  gap: 0.5rem;
}

.change-summary__heading {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text);
}

.change-summary__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.45rem;
  max-height: 11rem;
  overflow-y: auto;
}

.change-summary__item {
  display: grid;
  gap: 0.15rem;
  font-size: 0.8rem;
  line-height: 1.35;
}

.change-summary__label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.change-summary__values {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  overflow-wrap: anywhere;
}

.change-summary__before {
  color: var(--color-text-secondary);
  text-decoration: line-through;
}

.change-summary__arrow {
  flex: none;
  color: var(--color-text-secondary);
}

.change-summary__after {
  color: var(--color-text);
  font-weight: 600;
}
</style>
