<script setup lang="ts">
defineProps<{ label: string; pressed?: boolean }>()
</script>
<template>
  <button type="button" class="icon-button" :aria-label="label" :aria-pressed="pressed">
    <slot />
  </button>
</template>
<style scoped>
.icon-button {
  display: inline-grid;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  cursor: pointer;
}
.icon-button:hover {
  background: var(--color-surface-hover);
}
</style>
