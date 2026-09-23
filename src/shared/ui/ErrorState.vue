<script setup lang="ts">
defineProps<{ title?: string; description?: string }>()
</script>
<template>
  <section class="state" role="alert">
    <strong>{{ title ?? 'No pudimos completar la operación' }}</strong>
    <p>{{ description ?? 'Inténtalo nuevamente.' }}</p>
    <slot />
  </section>
</template>
<style scoped>
.state {
  padding: var(--space-6);
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-card);
  background: var(--color-danger-soft);
}
.state p {
  margin-bottom: 0;
}
</style>
