<script setup lang="ts">
defineProps<{ page: number; totalPages: number }>()
const emit = defineEmits<{ change: [page: number] }>()
</script>
<template>
  <nav class="pagination" aria-label="Paginación">
    <button type="button" :disabled="page <= 1" @click="emit('change', page - 1)">Anterior</button
    ><span>Página {{ page }} de {{ totalPages }}</span
    ><button type="button" :disabled="page >= totalPages" @click="emit('change', page + 1)">
      Siguiente
    </button>
  </nav>
</template>
<style scoped>
.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.pagination button {
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  cursor: pointer;
}
.pagination button:disabled {
  opacity: 0.5;
}
</style>
