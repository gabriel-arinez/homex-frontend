<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  { variant: 'primary', type: 'button' },
)
</script>
<template>
  <button class="button" :class="`button--${variant}`" :type :disabled><slot /></button>
</template>
<style scoped>
.button {
  min-height: 2.75rem;
  padding: 0.625rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.button--primary {
  color: white;
  background: var(--color-primary);
}
.button--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
.button--secondary {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-surface);
}
.button--secondary:hover:not(:disabled) {
  background: var(--color-surface-hover);
}
.button--danger {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
</style>
