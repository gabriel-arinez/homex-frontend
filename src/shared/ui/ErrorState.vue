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
.state :deep(button) {
  min-height: 2.75rem;
  margin-top: var(--space-3);
  padding: 0.5rem 0.75rem;
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  cursor: pointer;
}
.state :deep(button:hover) {
  background: var(--color-surface-hover);
}
.state :deep(button:focus-visible) {
  outline: 0;
  box-shadow: var(--focus-ring);
}
</style>
