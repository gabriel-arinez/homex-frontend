<script setup lang="ts">
defineProps<{
  modelValue?: string
  label: string
  name: string
  type?: string
  error?: string
  placeholder?: string
  autocomplete?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <label class="field"
    ><span>{{ label }}</span
    ><input
      :id="name"
      :name
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder
      :autocomplete
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${name}-error` : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    /><small v-if="error" :id="`${name}-error`" role="alert">{{ error }}</small></label
  >
</template>
<style scoped>
.field {
  display: grid;
  gap: var(--space-2);
  font-weight: 600;
}
.field input {
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.field input[aria-invalid='true'] {
  border-color: var(--color-danger);
}
.field small {
  color: var(--color-danger);
  font-weight: 400;
}
</style>
