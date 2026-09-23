<script setup lang="ts">
defineProps<{ description?: string }>()
</script>
<template>
  <section class="state">
    <strong>Acceso restringido</strong>
    <p>{{ description ?? 'No tienes permisos para ver este contenido.' }}</p>
  </section>
</template>
<style scoped>
.state {
  padding: var(--space-8);
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.state p {
  color: var(--color-text-secondary);
}
</style>
