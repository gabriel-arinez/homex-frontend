<script setup lang="ts">
import { useId } from 'vue'
import { Search, X } from '@lucide/vue'

defineProps<{ modelValue?: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const inputId = useId()
</script>

<template>
  <div class="search">
    <label class="sr-only" :for="inputId">{{ label ?? 'Buscar' }}</label>
    <Search :size="18" aria-hidden="true" />
    <input
      :id="inputId"
      type="search"
      :value="modelValue"
      :placeholder="label ?? 'Buscar'"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      type="button"
      :aria-label="`Limpiar ${label ?? 'búsqueda'}`"
      @click="emit('update:modelValue', '')"
    >
      <X :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.search {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--space-2);
  padding: 0 0.75rem;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.search:focus-within {
  box-shadow: var(--focus-ring);
}
.search input {
  min-width: 0;
  flex: 1;
  color: var(--color-text);
  border: 0;
  background: transparent;
  outline: 0;
}
.search button {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}
</style>
