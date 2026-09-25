<script setup lang="ts">
defineProps<{ modelValue?: string; value: string; label: string; name: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <label class="choice"
    ><input
      :name
      :value
      type="radio"
      :checked="modelValue === value"
      @change="emit('update:modelValue', value)"
    /><span>{{ label }}</span></label
  >
</template>
<style scoped>
.choice {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
.choice input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--color-primary);
}
</style>
