<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    name: string
    label: string
    placeholder?: string
    error?: string
    hint?: string
    maxLength?: number
    rows?: number
    disabled?: boolean
  }>(),
  { rows: 4 },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
}>()
const length = computed(() => Array.from(props.modelValue ?? '').length)
function update(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="textarea-field">
    <label :for="name">{{ label }}</label>
    <textarea
      :id="name"
      :name
      :value="modelValue"
      :placeholder
      :rows
      :disabled
      :maxlength="maxLength"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${name}-error` : hint ? `${name}-hint` : undefined"
      @input="update"
      @blur="emit('blur')"
    />
    <div class="textarea-field__footer">
      <small v-if="error" :id="`${name}-error`" class="textarea-field__error" role="alert">{{
        error
      }}</small>
      <small v-else-if="hint" :id="`${name}-hint`" class="textarea-field__hint">{{ hint }}</small>
      <small v-if="maxLength !== undefined" class="textarea-field__counter"
        >{{ length }} / {{ maxLength }} caracteres</small
      >
    </div>
  </div>
</template>

<style scoped>
.textarea-field {
  display: grid;
  min-width: 0;
  gap: var(--space-2);
}
.textarea-field label {
  color: var(--color-text);
  font-weight: 600;
}
.textarea-field textarea {
  width: 100%;
  min-width: 0;
  min-height: 6.75rem;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  line-height: 1.6;
  resize: vertical;
}
.textarea-field textarea:hover {
  border-color: var(--color-text-muted);
}
.textarea-field textarea:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 1px;
}
.textarea-field textarea[aria-invalid='true'] {
  border-color: var(--color-danger);
}
.textarea-field textarea:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
.textarea-field__footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.textarea-field__hint,
.textarea-field__counter {
  color: var(--color-text-secondary);
}
.textarea-field__counter {
  margin-left: auto;
  white-space: nowrap;
}
.textarea-field__error {
  color: var(--color-danger);
}
</style>
