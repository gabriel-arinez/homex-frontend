<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Producto } from '@/generated/api'
import { productosService } from '@/modules/productos/services/productosService'
import Button from '@/shared/ui/Button.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'

const props = defineProps<{ modelValue?: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [value: Producto | null]
}>()

const search = ref('')
const products = ref<Producto[]>([])
const selected = ref<Producto | null>(null)
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
let requestId = 0

const options = computed(() => {
  const unique = new Map<number, Producto>()
  if (selected.value) unique.set(selected.value.id, selected.value)
  for (const product of products.value) unique.set(product.id, product)
  return [
    { label: 'Seleccionar producto', value: '' },
    ...Array.from(unique.values()).map((product) => ({
      label: `${product.sku || 'Sin SKU'} · ${product.nombre}`,
      value: String(product.id),
    })),
  ]
})

async function ensureSelected(value = props.modelValue) {
  if (!value) {
    selected.value = null
    return
  }
  const existing = products.value.find((product) => String(product.id) === value)
  if (existing) {
    selected.value = existing
    return
  }
  try {
    selected.value = await productosService.get(Number(value))
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
    const response = await productosService.list({
      activo: true,
      search: search.value.trim() || undefined,
      page: targetPage,
      page_size: 20,
    })
    if (currentRequest !== requestId) return
    page.value = targetPage
    products.value = reset ? response.results : [...products.value, ...response.results]
    hasMore.value = Boolean(response.next)
    await ensureSelected()
  } catch (cause) {
    if (currentRequest !== requestId) return
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar los productos.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function choose(value: string) {
  emit('update:modelValue', value)
  const product = products.value.find((item) => String(item.id) === value) ?? selected.value
  emit('select', value ? product : null)
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
      <SearchField
        v-model="search"
        label="Buscar producto por SKU o nombre"
        @keydown.enter.prevent="load(true)"
      />
      <Button type="button" variant="secondary" :processing="loading" @click="load(true)">
        Buscar
      </Button>
    </div>
    <Select
      :model-value="modelValue"
      name="producto-linea"
      label="Producto de catálogo"
      :options
      @update:model-value="choose"
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
      Cargar más productos
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
