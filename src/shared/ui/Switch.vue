<script setup lang="ts">
defineProps<{ modelValue?: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>
<template>
  <button
    type="button"
    class="switch"
    role="switch"
    :aria-checked="modelValue"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span aria-hidden="true" /><b>{{ label }}</b>
  </button>
</template>
<style scoped>
.switch {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--space-2);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.switch > span {
  width: 2.5rem;
  height: 1.5rem;
  padding: 0.2rem;
  border-radius: 999px;
  background: var(--color-border-strong);
}
.switch > span::after {
  display: block;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: white;
  content: '';
  transition: transform var(--transition-fast);
}
.switch[aria-checked='true'] > span {
  background: var(--color-primary);
}
.switch[aria-checked='true'] > span::after {
  transform: translateX(1rem);
}
</style>
