<script setup lang="ts">
defineProps<{ description?: string }>()
</script>
<template>
  <section class="state">
    <strong>Acceso restringido</strong>
    <p>{{ description ?? 'No tienes permisos para ver este contenido.' }}</p>
    <div v-if="$slots.default" class="state__actions">
      <slot />
    </div>
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
.state__actions {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
</style>
