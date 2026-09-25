<script setup lang="ts">
defineProps<{ label: string; value: string; detail?: string }>()
</script>
<template>
  <article class="kpi">
    <span>{{ label }}</span
    ><strong>{{ value }}</strong
    ><small v-if="detail">{{ detail }}</small>
  </article>
</template>
<style scoped>
.kpi {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.kpi span,
.kpi small {
  color: var(--color-text-secondary);
}
.kpi strong {
  font-size: 1.75rem;
  line-height: 2.25rem;
}
</style>
