<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { Producto } from '@/generated/api'
import { productosService } from '../services/productosService'
import ProductImage from '../components/ProductImage.vue'
import Button from '@/shared/ui/Button.vue'
import DataTable from '@/shared/ui/DataTable.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import FilterBar from '@/shared/ui/FilterBar.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Pagination from '@/shared/ui/Pagination.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const products = ref<Producto[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const status = ref(typeof route.query.estado === 'string' ? route.query.estado : 'activos')
const view = ref(route.query.vista === 'lista' ? 'lista' : 'grid')
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 12
let requestId = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const hasFilters = computed(() => Boolean(search.value.trim()) || status.value !== 'todos')

function activeFilter() {
  if (status.value === 'activos') return true
  if (status.value === 'inactivos') return false
  return undefined
}

function syncRoute() {
  void router.replace({
    query: {
      q: search.value || undefined,
      estado: status.value === 'activos' ? undefined : status.value,
      vista: view.value === 'grid' ? undefined : view.value,
      pagina: page.value > 1 ? page.value : undefined,
    },
  })
}

async function load() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const response = await productosService.list({
      search: search.value.trim() || undefined,
      activo: activeFilter(),
      page: page.value,
      page_size: pageSize,
    })
    if (currentRequest !== requestId) return
    products.value = response.results
    total.value = response.count
  } catch (cause) {
    if (currentRequest !== requestId) return
    products.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch([search, status], () => {
  if (page.value !== 1) {
    page.value = 1
    return
  }
  syncRoute()
  void load()
})
watch(page, () => {
  syncRoute()
  void load()
})
watch(view, syncRoute)
onMounted(load)

const columns = [
  { key: 'producto', label: 'Producto' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'precio', label: 'Precio' },
  { key: 'stock', label: 'Stock' },
  { key: 'acciones', label: 'Acciones' },
]
const money = (value: string) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value))
</script>

<template>
  <div>
    <PageHeader
      title="Productos"
      description="Catálogo comercial y disponibilidad general."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button :variant="view === 'grid' ? 'primary' : 'secondary'" @click="view = 'grid'">
          Cuadrícula
        </Button>
        <Button :variant="view === 'lista' ? 'primary' : 'secondary'" @click="view = 'lista'">
          Lista
        </Button>
      </template>
    </PageHeader>
    <FilterBar>
      <SearchField v-model="search" label="Buscar por SKU o nombre" />
      <Select
        v-model="status"
        name="estado-producto"
        label="Estado"
        :options="[
          { label: 'Activos', value: 'activos' },
          { label: 'Todos', value: 'todos' },
          { label: 'Inactivos', value: 'inactivos' },
        ]"
      />
    </FilterBar>
    <LoadingSkeleton v-if="loading" :lines="8" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="products.length === 0"
      :title="hasFilters ? 'Sin resultados' : 'Sin productos'"
      :description="
        hasFilters
          ? 'No hay productos que coincidan con la búsqueda y los filtros.'
          : 'No hay productos registrados para mostrar.'
      "
    />
    <template v-else>
      <p class="results">{{ total }} producto{{ total === 1 ? '' : 's' }}</p>
      <div v-if="view === 'grid'" class="product-grid">
        <article v-for="product in products" :key="product.id" class="product-card">
          <span class="category">Categoría #{{ product.categoria }}</span>
          <ProductImage :image="product.imagen_principal" :alt="product.nombre" />
          <div class="body">
            <small>{{ product.sku || 'Sin SKU' }}</small>
            <h2>
              <RouterLink :to="`/productos/${product.id}`">{{ product.nombre }}</RouterLink>
            </h2>
            <p>Unidad registrada #{{ product.unidad_stock }}</p>
            <div class="commercial">
              <strong>{{ money(product.precio_vigente) }}</strong>
              <span>Stock: {{ product.stock }}</span>
            </div>
            <small>
              Comprometido: {{ product.demanda_pendiente }} · Referencial:
              {{ product.disponibilidad_referencial }}
            </small>
          </div>
        </article>
      </div>
      <DataTable v-else caption="Listado de productos" :columns="columns" :rows="products">
        <template #cell-producto="{ row }">
          <strong>{{ row.nombre }}</strong
          ><br /><small>{{ row.sku || 'Sin SKU' }}</small>
        </template>
        <template #cell-categoria="{ row }">#{{ row.categoria }}</template>
        <template #cell-precio="{ row }">{{ money(String(row.precio_vigente)) }}</template>
        <template #cell-stock="{ row }">
          {{ row.stock }} <small>(ref. {{ row.disponibilidad_referencial }})</small>
        </template>
        <template #cell-acciones="{ row }">
          <RouterLink :to="`/productos/${row.id}`">Ver detalle</RouterLink>
        </template>
      </DataTable>
      <Pagination :page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>

<style scoped>
.filter-bar {
  margin-bottom: var(--space-6);
}
.results {
  color: var(--color-text-secondary);
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-5);
}
.product-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.product-card :deep(.product-image) {
  border-radius: 0;
}
.category {
  position: absolute;
  z-index: 1;
  margin: var(--space-3);
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--color-surface);
  font-size: 0.7rem;
  font-weight: 700;
}
.body {
  padding: var(--space-4);
}
h2 {
  margin: 0.25rem 0;
  font-size: 1.05rem;
}
a {
  color: var(--color-primary-accent);
}
.body p {
  margin: 0.3rem 0;
  color: var(--color-text-secondary);
}
.commercial {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.pagination {
  margin-top: var(--space-6);
}
@media (max-width: 24rem) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
