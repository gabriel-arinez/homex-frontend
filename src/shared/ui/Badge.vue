<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }>(), {
  tone: 'neutral',
})
</script>
<template>
  <span class="badge" :class="`badge--${tone}`"><slot /></span>
</template>
<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge--neutral {
  color: var(--color-text-secondary);
  background: var(--color-surface-hover);
}
.badge--success {
  color: var(--color-success);
  background: var(--color-success-soft);
}
.badge--warning {
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.badge--danger {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.badge--info {
  color: var(--color-info);
  background: var(--color-info-soft);
}
</style>
