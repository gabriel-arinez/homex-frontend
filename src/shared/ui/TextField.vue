<script setup lang="ts">
import { cleanInput, type InputRule } from '@/shared/validation/commercialFields'

const props = defineProps<{
  modelValue?: string
  label: string
  name: string
  type?: string
  error?: string
  placeholder?: string
  autocomplete?: string
  hint?: string
  disabled?: boolean
  min?: string
  max?: string
  step?: string
  maxLength?: number
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'text' | 'search'
  inputRule?: InputRule
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>()
function update(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.isComposing) return
  const raw = input.value
  const cleaned = cleanInput(raw, props.inputRule, props.maxLength)
  if (raw !== cleaned) input.value = cleaned
  emit('update:modelValue', cleaned)
}
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
      :disabled
      :min
      :max
      :step
      :maxlength="maxLength"
      :inputmode="inputMode"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${name}-error` : hint ? `${name}-hint` : undefined"
      @input="update"
      @compositionend="update"
      @blur="emit('blur')"
    /><small v-if="error" :id="`${name}-error`" class="error" role="alert">{{ error }}</small
    ><small v-else-if="hint" :id="`${name}-hint`" class="hint">{{ hint }}</small></label
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
.field .error {
  color: var(--color-danger);
  font-weight: 400;
}
.field .hint {
  color: var(--color-text-secondary);
  font-weight: 400;
}
.field input:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
</style>
