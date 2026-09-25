<script setup lang="ts">
import { Search } from '@lucide/vue'
defineProps<{ modelValue?: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <label class="search"
    ><span class="sr-only">{{ label ?? 'Buscar' }}</span
    ><Search :size="18" aria-hidden="true" /><input
      type="search"
      :value="modelValue"
      :placeholder="label ?? 'Buscar'"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  /></label>
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
</style>
