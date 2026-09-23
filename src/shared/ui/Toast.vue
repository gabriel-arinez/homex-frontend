<script setup lang="ts">
defineProps<{ visible: boolean; message: string; tone?: 'success' | 'danger' }>()
</script>
<template>
  <Teleport to="body"
    ><div
      v-if="visible"
      class="toast"
      :class="`toast--${tone ?? 'success'}`"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </div></Teleport
  >
</template>
<style scoped>
.toast {
  position: fixed;
  z-index: 120;
  right: var(--space-4);
  bottom: var(--space-4);
  max-width: min(24rem, calc(100vw - 2rem));
  padding: 0.75rem 1rem;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  box-shadow: 0 8px 24px var(--color-overlay);
}
.toast--success {
  border-left: 4px solid var(--color-success);
}
.toast--danger {
  border-left: 4px solid var(--color-danger);
}
</style>
