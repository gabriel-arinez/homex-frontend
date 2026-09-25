<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{ filters: Array<{ key: string; label: string }> }>()
const emit = defineEmits<{ remove: [key: string]; clear: [] }>()
</script>

<template>
  <section v-if="filters.length" class="active-filters" aria-label="Filtros activos">
    <span>Filtros activos:</span>
    <button
      v-for="filter in filters"
      :key="filter.key"
      type="button"
      :aria-label="`Quitar filtro: ${filter.label}`"
      @click="emit('remove', filter.key)"
    >
      {{ filter.label }} <X :size="14" aria-hidden="true" />
    </button>
    <button class="clear" type="button" @click="emit('clear')">Limpiar todos</button>
  </section>
</template>

<style scoped>
.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-5);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.active-filters button {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.55rem;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  cursor: pointer;
}
.active-filters .clear {
  color: var(--color-primary-accent);
  border-color: transparent;
  background: transparent;
  font-weight: 700;
}
</style>
