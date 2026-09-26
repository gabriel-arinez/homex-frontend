<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Cliente } from '@/generated/api'
import { clientesService, nombreCliente } from '@/modules/clientes/services/clientesService'
import Button from '@/shared/ui/Button.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    prospectLabel?: string
  }>(),
  {
    label: 'Cliente',
    prospectLabel: 'Prospecto',
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const search = ref('')
const clients = ref<Cliente[]>([])
const selected = ref<Cliente | null>(null)
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
let requestId = 0

const options = computed(() => {
  const unique = new Map<number, Cliente>()
  if (selected.value) unique.set(selected.value.id, selected.value)
  for (const client of clients.value) unique.set(client.id, client)
  return [
    { label: props.prospectLabel, value: '' },
    ...Array.from(unique.values()).map((client) => ({
      label: nombreCliente(client),
      value: String(client.id),
    })),
  ]
})

async function ensureSelected(value = props.modelValue) {
  if (!value) {
    selected.value = null
    return
  }
  const existing = clients.value.find((client) => String(client.id) === value)
  if (existing) {
    selected.value = existing
    return
  }
  try {
    selected.value = await clientesService.get(Number(value))
  } catch {
    selected.value = null
  }
}

async function load(reset = true) {
  const currentRequest = ++requestId
  const targetPage = reset ? 1 : page.value + 1
  loading.value = true
  error.value = ''
  try {
    const response = await clientesService.list({
      activo: true,
      search: search.value.trim() || undefined,
      page: targetPage,
      page_size: 20,
    })
    if (currentRequest !== requestId) return
    page.value = targetPage
    clients.value = reset ? response.results : [...clients.value, ...response.results]
    hasMore.value = Boolean(response.next)
    await ensureSelected()
  } catch (cause) {
    if (currentRequest !== requestId) return
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar los clientes.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    void ensureSelected(value)
  },
)

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="remote-select">
    <div class="search-row">
      <SearchField v-model="search" label="Buscar cliente" @keydown.enter.prevent="load(true)" />
      <Button type="button" variant="secondary" :processing="loading" @click="load(true)">
        Buscar
      </Button>
    </div>
    <Select
      :model-value="modelValue"
      name="cliente-proforma"
      :label
      :options
      @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" @click="load(true)">Reintentar</button>
    </p>
    <Button
      v-if="hasMore"
      type="button"
      variant="secondary"
      :processing="loading"
      @click="load(false)"
    >
      Cargar más clientes
    </Button>
  </div>
</template>

<style scoped>
.remote-select {
  display: grid;
  gap: var(--space-2);
}
.search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: end;
}
[role='alert'] {
  margin: 0;
  color: var(--color-danger);
}
[role='alert'] button {
  margin-left: var(--space-2);
}
@media (max-width: 35rem) {
  .search-row {
    grid-template-columns: 1fr;
  }
}
</style>
