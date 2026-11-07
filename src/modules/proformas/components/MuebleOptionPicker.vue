<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Check, ChevronDown, Plus, Search } from '@lucide/vue'

type Opcion = { value: string; label: string }
const props = withDefaults(
  defineProps<{
    modelValue: string
    name: string
    label: string
    options: Opcion[]
    placeholder?: string
    allowCreate?: boolean
    createLabel?: string
    busy?: boolean
  }>(),
  { placeholder: 'Buscar...', allowCreate: false, createLabel: 'Crear' },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  create: [name: string]
}>()
const search = ref('')
const open = ref(false)
const active = ref(-1)
const listId = useId()
const selected = computed(() => props.options.find((x) => x.value === props.modelValue))
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
const matching = computed(() =>
  props.options.filter((x) => norm(x.label).includes(norm(search.value))).slice(0, 20),
)
const canCreate = computed(
  () =>
    props.allowCreate &&
    search.value.trim().length > 0 &&
    !props.options.some((x) => norm(x.label) === norm(search.value)),
)
function choose(option: Opcion) {
  emit('update:modelValue', option.value)
  search.value = ''
  active.value = -1
  open.value = false
}
function create() {
  if (!canCreate.value || props.busy) return
  emit('create', search.value.trim())
  open.value = false
  search.value = ''
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false
    active.value = -1
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    const count = matching.value.length + (canCreate.value ? 1 : 0)
    if (count) active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
  }
  if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    if (active.value >= 0 && active.value < matching.value.length)
      choose(matching.value[active.value]!)
    else if (canCreate.value) create()
    else if (matching.value.length === 1) choose(matching.value[0]!)
  }
}
function close(event: FocusEvent) {
  const root = event.currentTarget as HTMLElement
  if (root.contains(event.relatedTarget as Node | null)) return
  open.value = false
  active.value = -1
}
function buscarOpciones() {
  open.value = true
  active.value = -1
}
function clearSelection() {
  emit('update:modelValue', '')
  search.value = ''
  active.value = -1
  open.value = false
}
</script>
<template>
  <div class="mueble-picker" @focusout="close">
    <label :for="name">{{ label }}</label>
    <div
      class="mueble-picker__input"
      :class="{ 'mueble-picker__input--selected': Boolean(selected) && !open && !search }"
    >
      <Check
        v-if="selected && !open && !search"
        :size="17"
        class="mueble-picker__selected-icon"
        aria-hidden="true"
      />
      <Search v-else :size="17" aria-hidden="true" />
      <input
        :id="name"
        v-model="search"
        type="search"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="open ? listId : undefined"
        :aria-activedescendant="open && active >= 0 ? listId + '-' + active : undefined"
        :placeholder="selected && !open ? selected.label : placeholder"
        @focus="open = true"
        @input="buscarOpciones"
        @keydown="keydown"
      />
      <button
        v-if="selected"
        type="button"
        class="mueble-picker__clear"
        :aria-label="'Quitar ' + selected.label"
        @mousedown.prevent
        @click="clearSelection"
      >
        Quitar
      </button>
      <ChevronDown :size="16" aria-hidden="true" />
    </div>
    <div v-if="open" :id="listId" class="mueble-picker__options" role="listbox" :aria-label="label">
      <button
        v-for="(option, i) in matching"
        :id="listId + '-' + i"
        :key="option.value"
        type="button"
        role="option"
        :aria-selected="option.value === modelValue"
        :class="{ 'is-active': active === i }"
        @click="choose(option)"
      >
        {{ option.label }}
        <Check v-if="option.value === modelValue" :size="15" aria-hidden="true" />
      </button>
      <button
        v-if="canCreate"
        :id="listId + '-' + matching.length"
        type="button"
        role="option"
        :aria-selected="false"
        :class="{ 'is-active': active === matching.length }"
        class="mueble-picker__create"
        :disabled="busy"
        @click="create"
      >
        <Plus :size="17" aria-hidden="true" /> {{ createLabel }} “{{ search.trim() }}”
      </button>
      <p v-if="!matching.length && !canCreate">No se encontraron coincidencias.</p>
    </div>
  </div>
</template>
<style scoped>
.mueble-picker {
  position: relative;
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  max-width: 36rem;
}
.mueble-picker > label {
  font-weight: 600;
}
.mueble-picker__input {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-raised);
  border-radius: var(--radius-control);
  padding: 0 0.75rem;
  min-height: 2.75rem;
  transition: border-color var(--transition-fast);
}
.mueble-picker__input--selected {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border-strong));
  background: color-mix(in srgb, var(--color-primary-soft) 35%, var(--color-surface-raised));
}
.mueble-picker__input:focus-within {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 1px;
}
.mueble-picker__input input {
  width: 100%;
  flex: 1;
  border: 0;
  outline: 0;
  min-width: 0;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.875rem;
}
.mueble-picker__input input::placeholder {
  color: var(--color-text-secondary);
  opacity: 1;
}
.mueble-picker__input--selected input::placeholder {
  color: var(--color-text);
  font-weight: 600;
}
.mueble-picker__input svg {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}
.mueble-picker__input .mueble-picker__selected-icon {
  color: var(--color-success);
}
.mueble-picker__clear {
  flex-shrink: 0;
  padding: 0.22rem 0.55rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.mueble-picker__clear:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.mueble-picker__clear:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
.mueble-picker__options {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 17rem;
  overflow-y: auto;
  padding: 0.35rem;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-raised);
  border-radius: var(--radius-control);
  box-shadow: 0 14px 32px rgb(0 0 0 / 17%);
}
.mueble-picker__options button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  border: 0;
  border-radius: 0.4rem;
  padding: 0.7rem;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.83rem;
  text-align: left;
}
.mueble-picker__options button:hover,
.mueble-picker__options button.is-active {
  background: var(--color-primary-soft);
}
.mueble-picker__options button:focus-visible {
  outline: 2px solid var(--color-primary);
}
.mueble-picker__options .mueble-picker__create {
  color: var(--color-primary-accent);
  justify-content: start;
  font-weight: 650;
}
.mueble-picker__options p {
  padding: 0.3rem 0.7rem;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
</style>
