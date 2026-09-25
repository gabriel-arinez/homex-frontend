<template>
  <section class="card"><slot /></section>
</template>
<style scoped>
.card {
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
</style>
