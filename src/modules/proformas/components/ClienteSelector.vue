<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Building2, Check, ChevronDown, Search, UserRound, X } from '@lucide/vue'
import type { Cliente } from '@/generated/api'
import { clientesService, nombreCliente } from '@/modules/clientes/services/clientesService'
import { CLIENT_LIMITS, cleanInput } from '@/shared/validation/commercialFields'
import Button from '@/shared/ui/Button.vue'

const props = withDefaults(
  defineProps<{ modelValue?: string; label?: string; prospectLabel?: string }>(),
  { label: 'Cliente', prospectLabel: 'Cliente pendiente' },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [cliente: Cliente | null]
}>()

const inputId = useId()
const listId = useId()
const search = ref('')
const clients = ref<Cliente[]>([])
const selected = ref<Cliente | null>(null)
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
const isOpen = ref(false)
const focusedIndex = ref(-1)
let requestId = 0
let debounce: ReturnType<typeof setTimeout> | undefined
const options = computed(() => {
  const unique = new Map<number, Cliente>()
  for (const client of clients.value) unique.set(client.id, client)
  return Array.from(unique.values())
})

function labelFor(cliente: Cliente) {
  return nombreCliente(cliente)
}

async function ensureSelected(value = props.modelValue) {
  if (!value) {
    selected.value = null
    emit('select', null)
    return
  }
  const client =
    clients.value.find((item) => String(item.id) === value) ??
    (String(selected.value?.id) === value ? selected.value : null)
  if (client) {
    selected.value = client
    emit('select', client)
    return
  }
  try {
    const result = await clientesService.get(Number(value))
    if (props.modelValue !== value) return
    selected.value = result
    emit('select', result)
  } catch {
    if (props.modelValue !== value) return
    selected.value = null
    emit('select', null)
  }
}
function selectValue(cliente: Cliente) {
  selected.value = cliente
  search.value = ''
  isOpen.value = false
  focusedIndex.value = -1
  emit('update:modelValue', String(cliente.id))
  emit('select', cliente)
}
function clearSelected() {
  selected.value = null
  search.value = ''
  emit('update:modelValue', '')
  emit('select', null)
  isOpen.value = true
  void load(true)
}
async function load(reset = true) {
  const currentRequest = ++requestId
  const currentSearch = search.value.trim()
  const targetPage = reset ? 1 : page.value + 1
  loading.value = true
  error.value = ''
  try {
    const response = await clientesService.list({
      activo: true,
      search: currentSearch || undefined,
      page: targetPage,
      page_size: 20,
      orden: 'nombre',
    })
    if (currentRequest !== requestId) return
    page.value = targetPage
    clients.value = reset ? response.results : [...clients.value, ...response.results]
    hasMore.value = Boolean(response.next)
    focusedIndex.value = -1
  } catch (cause) {
    if (currentRequest !== requestId) return
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar los clientes.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}
function changeSearch(event: Event) {
  const element = event.target as HTMLInputElement
  const value = cleanInput(element.value, 'search', CLIENT_LIMITS.search)
  if (value !== element.value) element.value = value
  search.value = value
  isOpen.value = true
  ++requestId
  clients.value = []
  focusedIndex.value = -1
  hasMore.value = false
  error.value = ''
  if (debounce) clearTimeout(debounce)
  loading.value = true
  debounce = setTimeout(() => void load(true), 280)
}
function openList() {
  isOpen.value = true
  if (!clients.value.length && !loading.value) void load(true)
}
function handleKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
    focusedIndex.value = -1
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) openList()
    if (!options.value.length) return
    const direction = event.key === 'ArrowDown' ? 1 : -1
    focusedIndex.value =
      (focusedIndex.value + direction + options.value.length) % options.value.length
  }
  if (event.key === 'Enter' && isOpen.value && focusedIndex.value >= 0) {
    event.preventDefault()
    const option = options.value[focusedIndex.value]
    if (option) selectValue(option)
  }
}
function closeOnBlur(event: FocusEvent) {
  const root = event.currentTarget as HTMLElement
  if (root.contains(event.relatedTarget as Node | null)) return
  isOpen.value = false
  focusedIndex.value = -1
}
watch(
  () => props.modelValue,
  (value) => void ensureSelected(value),
)
onBeforeUnmount(() => {
  ++requestId
  if (debounce) clearTimeout(debounce)
})
void ensureSelected()
</script>

<template>
  <div class="client-picker" @focusout="closeOnBlur">
    <label class="client-picker__label" :for="inputId">{{ label }}</label>
    <div class="client-picker__search">
      <Search :size="18" aria-hidden="true" />
      <input
        :id="inputId"
        :value="search"
        :maxlength="CLIENT_LIMITS.search"
        type="search"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="isOpen && options.length ? listId : undefined"
        :aria-activedescendant="
          isOpen && focusedIndex >= 0 ? listId + '-' + focusedIndex : undefined
        "
        placeholder="Buscar por nombre, apellido o empresa..."
        @focus="openList"
        @input="changeSearch"
        @keydown="handleKey"
      />
      <ChevronDown v-if="!search" :size="18" aria-hidden="true" />
    </div>
    <div v-if="selected" class="selected-client">
      <div class="selected-client__identity">
        <Check :size="17" aria-hidden="true" />
        <span
          >Seleccionado: <strong>{{ labelFor(selected) }}</strong></span
        >
      </div>
      <button type="button" aria-label="Quitar cliente seleccionado" @click="clearSelected">
        <X :size="17" aria-hidden="true" />
      </button>
    </div>
    <div
      v-if="isOpen"
      :id="listId"
      class="client-picker__results"
      :role="options.length ? 'listbox' : undefined"
      :aria-label="options.length ? label : undefined"
    >
      <p v-if="loading && !options.length" role="status">Buscando clientes...</p>
      <p v-else-if="error" role="alert">
        {{ error }}
        <button type="button" @click="load(true)">Reintentar</button>
      </p>
      <p v-else-if="!options.length" role="status">
        {{
          search
            ? 'No encontramos clientes que coincidan con tu búsqueda.'
            : 'No hay clientes disponibles.'
        }}
      </p>
      <template v-else>
        <p class="client-picker__intro">
          {{ search ? 'Coincidencias encontradas' : 'Clientes disponibles · orden alfabético' }}
        </p>
        <button
          v-for="(cliente, index) in options"
          :id="listId + '-' + index"
          :key="cliente.id"
          type="button"
          role="option"
          class="client-picker__option"
          :class="{ 'client-picker__option--active': focusedIndex === index }"
          :aria-selected="String(cliente.id) === modelValue"
          @mousedown.prevent
          @click="selectValue(cliente)"
        >
          <Building2
            v-if="cliente.tipo_cliente_info?.codigo === 'EMPRESA'"
            :size="20"
            aria-hidden="true"
          />
          <UserRound v-else :size="20" aria-hidden="true" />
          <span
            ><strong>{{ labelFor(cliente) }}</strong
            ><small>{{ cliente.tipo_cliente_info?.nombre || 'Cliente registrado' }}</small></span
          >
          <Check v-if="String(cliente.id) === modelValue" :size="18" aria-hidden="true" />
        </button>
        <div class="client-picker__footer">
          <span v-if="loading" role="status">Cargando...</span>
          <Button
            v-if="hasMore"
            type="button"
            variant="secondary"
            :processing="loading"
            @mousedown.prevent
            @click="load(false)"
            >Cargar más clientes</Button
          >
        </div>
      </template>
    </div>
    <p class="client-picker__hint">
      Puedes buscar por nombres, apellidos o empresa. Solo se muestran clientes activos que puedes
      utilizar.
    </p>
  </div>
</template>

<style scoped>
.client-picker {
  position: relative;
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}
.client-picker__label {
  font-weight: 600;
}
.client-picker__search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}
.client-picker__search:focus-within {
  box-shadow: var(--focus-ring);
}
.client-picker__search input {
  flex: 1;
  min-width: 0;
  padding: 0.7rem 0;
  border: 0;
  outline: 0;
  color: var(--color-text);
  background: transparent;
}
.client-picker__search svg {
  flex: 0 0 auto;
}
.client-picker__results {
  position: relative;
  display: grid;
  max-height: 19rem;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  box-shadow: 0 8px 24px var(--color-overlay);
}
.client-picker__intro {
  margin: 0;
  padding: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}
.client-picker__results > p[role] {
  margin: 0;
  padding: var(--space-4);
  color: var(--color-text-secondary);
}
.client-picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-top: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}
.client-picker__option:hover,
.client-picker__option--active {
  background: var(--color-primary-soft);
}
.client-picker__option[aria-selected='true'] {
  color: var(--color-primary-accent);
}
.client-picker__option > svg {
  flex: 0 0 auto;
}
.client-picker__option span {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.client-picker__option small {
  color: var(--color-text-secondary);
}
.client-picker__option:focus-visible {
  box-shadow: inset var(--focus-ring);
}
.client-picker__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: var(--space-2);
}
.client-picker__hint {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.selected-client {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-control);
  background: var(--color-primary-soft);
}
.selected-client__identity {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  color: var(--color-text);
}
.selected-client__identity > svg {
  color: var(--color-primary-accent);
  flex: 0 0 auto;
}
.selected-client__identity span {
  overflow-wrap: anywhere;
}
.selected-client button {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}
.selected-client button:hover {
  background: var(--color-surface-hover);
}
@media (max-width: 35rem) {
  .client-picker__option {
    padding: var(--space-3);
  }
}
</style>
