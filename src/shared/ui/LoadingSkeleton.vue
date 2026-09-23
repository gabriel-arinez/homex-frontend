<script setup lang="ts">
withDefaults(defineProps<{ lines?: number }>(), { lines: 3 })
</script>
<template>
  <div class="skeleton" aria-busy="true" aria-label="Cargando">
    <span v-for="line in lines" :key="line" />
  </div>
</template>
<style scoped>
.skeleton {
  display: grid;
  gap: var(--space-3);
}
.skeleton span {
  height: 1rem;
  border-radius: 0.25rem;
  background: linear-gradient(
    90deg,
    var(--color-surface-hover),
    var(--color-border),
    var(--color-surface-hover)
  );
  background-size: 200%;
  animation: pulse 1.4s infinite;
}
.skeleton span:last-child {
  width: 65%;
}
@keyframes pulse {
  to {
    background-position: -200% 0;
  }
}
</style>
