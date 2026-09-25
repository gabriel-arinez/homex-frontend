<script setup lang="ts">
defineProps<{ title: string; description: string }>()
</script>
<template>
  <section class="state">
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
    <slot />
  </section>
</template>
<style scoped>
.state {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-10) var(--space-4);
  text-align: center;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-card);
}
.state p {
  max-width: 32rem;
  margin: 0;
  color: var(--color-text-secondary);
}
</style>
