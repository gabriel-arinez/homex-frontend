<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Check, ChevronDown, Plus, Search } from '@lucide/vue'

type Opcion = { value: string; label: string }
const props = withDefaults(defineProps<{
  modelValue: string
  name: string
  label: string
  options: Opcion[]
  placeholder?: string
  allowCreate?: boolean
  createLabel?: string
  busy?: boolean
}>(), { placeholder: 'Buscar...', allowCreate: false, createLabel: 'Crear' })
const emit = defineEmits<{
  'update:modelValue': [value: string]
  create: [name: string]
}>()
const search = ref('')
const open = ref(false)
const active = ref(-1)
const listId = useId()
const selected = computed(() => props.options.find((x) => x.value === props.modelValue))
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
const matching = computed(() => props.options.filter((x) => norm(x.label).includes(norm(search.value))).slice(0, 20))
const canCreate = computed(() => props.allowCreate && search.value.trim().length > 0 && !props.options.some((x) => norm(x.label) === norm(search.value)))
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
  if (event.key === 'Escape') { open.value = false; active.value = -1; return }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    const count = matching.value.length + (canCreate.value ? 1 : 0)
    if (count) active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
  }
  if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    if (active.value >= 0 && active.value < matching.value.length) choose(matching.value[active.value]!)
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
</script>
<template>
  <div class="mueble-picker" @focusout="close">
    <label :for="name">{{ label }}</label>
    <div class="mueble-picker__input">
      <Search :size="17" aria-hidden="true" />
      <input
        :id="name"
        v-model="search"
        type="search"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="open ? listId : undefined"
        :aria-activedescendant="open && active >= 0 && active < matching.length ? listId + '-' + active : undefined"
        :placeholder="selected && !open ? selected.label : placeholder"
        @focus="open = true"
        @input="open = true; active = -1"
        @keydown="keydown"
      />
      <ChevronDown :size="16" aria-hidden="true" />
    </div>
    <div v-if="selected" class="mueble-picker__selected">
      <Check :size="15" aria-hidden="true" /> {{ selected.label }}
      <button type="button" :aria-label="'Quitar ' + selected.label" @click="emit('update:modelValue', '')">Quitar</button>
    </div>
    <div v-if="open" :id="listId" class="mueble-picker__options" role="listbox" :aria-label="label">
      <button
        v-for="(option, i) in matching" :id="listId + '-' + i" :key="option.value" type="button" role="option"
        :aria-selected="option.value === modelValue" :class="{ 'is-active': active === i }" @click="choose(option)"
      >{{ option.label }} <Check v-if="option.value === modelValue" :size="15" aria-hidden="true" /></button>
      <button v-if="canCreate" type="button" class="mueble-picker__create" :disabled="busy" @click="create">
        <Plus :size="17" aria-hidden="true" /> {{ createLabel }} “{{ search.trim() }}”
      </button>
      <p v-if="!matching.length && !canCreate">No se encontraron coincidencias.</p>
    </div>
  </div>
</template>
<style scoped>
.mueble-picker { position: relative; display: grid; gap: .55rem; min-width: 0; max-width: 36rem; }
.mueble-picker > label { font-weight: 650; font-size: .85rem; }
.mueble-picker__input { display:flex; align-items:center; gap:.65rem; border:1px solid var(--color-border-strong); background:var(--color-surface); border-radius:var(--radius-control); padding:0 .8rem; min-height:2.75rem; }
.mueble-picker__input:focus-within { outline:2px solid var(--color-primary-accent); outline-offset:1px; }
.mueble-picker__input input { width:100%; flex:1; border:0; outline:0; min-width:0; background:transparent; color:var(--color-text); font:inherit; font-size:.87rem; }
.mueble-picker__input svg { flex-shrink:0; color:var(--color-text-secondary); }
.mueble-picker__selected { display:flex; gap:.45rem; align-items:center; flex-wrap:wrap; font-size:.77rem; color:var(--color-text-secondary); }
.mueble-picker__selected button { background:none; border:0; color:var(--color-primary-accent); font:inherit; cursor:pointer; text-decoration:underline; }
.mueble-picker__options { position:absolute; top:100%; left:0; right:0; z-index:20; max-height:17rem; overflow-y:auto; padding:.35rem; border:1px solid var(--color-border-strong); background:var(--color-surface-raised); border-radius:var(--radius-control); box-shadow:0 14px 32px rgb(0 0 0 / 17%); }
.mueble-picker__options button { display:flex; align-items:center; justify-content:space-between; gap:.5rem; width:100%; border:0; border-radius:.4rem; padding:.7rem; color:var(--color-text); background:transparent; cursor:pointer; font:inherit; font-size:.83rem; text-align:left; }
.mueble-picker__options button:hover,.mueble-picker__options button.is-active { background:var(--color-primary-soft); }
.mueble-picker__options button:focus-visible { outline:2px solid var(--color-primary); }
.mueble-picker__options .mueble-picker__create { color:var(--color-primary-accent); justify-content:start; font-weight:650; }
.mueble-picker__options p { padding:.3rem .7rem; color:var(--color-text-secondary); font-size:.8rem; }
</style>
