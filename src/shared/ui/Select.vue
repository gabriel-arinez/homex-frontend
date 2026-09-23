<script setup lang="ts">
defineProps<{
  modelValue?: string
  label: string
  name: string
  options: Array<{ label: string; value: string }>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <label class="select"
    ><span>{{ label }}</span
    ><select
      :id="name"
      :name
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select></label
  >
</template>
<style scoped>
.select {
  display: grid;
  gap: var(--space-2);
  font-weight: 600;
}
.select select {
  min-height: 2.75rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
</style>
