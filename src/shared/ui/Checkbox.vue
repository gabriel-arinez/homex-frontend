<script setup lang="ts">
defineProps<{ modelValue?: boolean; label: string; name: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>
<template>
  <label class="choice"
    ><input
      :name
      type="checkbox"
      :checked="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
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
