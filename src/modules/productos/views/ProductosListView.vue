<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { DescuentoProducto, Producto, ProductoPiso, ProductoSilla } from '@/generated/api'
import { activeDiscount, presentation, productosService } from '../services/productosService'
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
const products = ref<Producto[]>([]),
  chairs = ref<ProductoSilla[]>([]),
  floors = ref<ProductoPiso[]>([]),
  discounts = ref<DescuentoProducto[]>([])
const loading = ref(true),
  error = ref('')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const type = ref(typeof route.query.tipo === 'string' ? route.query.tipo : 'todos')
const status = ref(typeof route.query.estado === 'string' ? route.query.estado : 'activos')
const view = ref(route.query.vista === 'lista' ? 'lista' : 'grid')
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 12
const enriched = computed(() =>
  products.value.map((product) => ({
    product,
    presentation: presentation(product.id, chairs.value, floors.value),
    discount: activeDiscount(product.id, discounts.value),
  })),
)
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('es')
  return enriched.value.filter((item) => {
    const active =
      status.value === 'todos' ||
      (status.value === 'activos' ? item.product.activo !== false : item.product.activo === false)
    const kind = type.value === 'todos' || item.presentation.type === type.value
    const text = [item.product.sku, item.product.nombre, item.presentation.detail]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es')
    return active && kind && (!q || text.includes(q))
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
watch([search, type, status], () => (page.value = 1))
watch(
  [search, type, status, view, page],
  () =>
    void router.replace({
      query: {
        q: search.value || undefined,
        tipo: type.value === 'todos' ? undefined : type.value,
        estado: status.value === 'activos' ? undefined : status.value,
        vista: view.value === 'grid' ? undefined : view.value,
        pagina: page.value > 1 ? page.value : undefined,
      },
    }),
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[products.value, chairs.value, floors.value, discounts.value] = await Promise.all([
      productosService.list(),
      productosService.chairs(),
      productosService.floors(),
      productosService.discounts(),
    ])
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
const columns = [
  { key: 'producto', label: 'Producto' },
  { key: 'tipo', label: 'Tipo' },
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
      ><template #actions
        ><Button :variant="view === 'grid' ? 'primary' : 'secondary'" @click="view = 'grid'"
          >Cuadrícula</Button
        ><Button :variant="view === 'lista' ? 'primary' : 'secondary'" @click="view = 'lista'"
          >Lista</Button
        ></template
      ></PageHeader
    ><FilterBar
      ><SearchField v-model="search" label="Buscar por SKU, nombre o presentación" /><Select
        v-model="type"
        name="tipo-producto"
        label="Tipo"
        :options="[
          { label: 'Todos', value: 'todos' },
          { label: 'Sillas', value: 'SILLA' },
          { label: 'Pisos flotantes', value: 'PISO FLOTANTE' },
          { label: 'Otros', value: 'OTRO' },
        ]" /><Select
        v-model="status"
        name="estado-producto"
        label="Estado"
        :options="[
          { label: 'Activos', value: 'activos' },
          { label: 'Todos', value: 'todos' },
          { label: 'Inactivos', value: 'inactivos' },
        ]" /></FilterBar
    ><LoadingSkeleton v-if="loading" :lines="8" /><ErrorState v-else-if="error" :description="error"
      ><button type="button" @click="load">Reintentar</button></ErrorState
    ><EmptyState
      v-else-if="filtered.length === 0"
      title="Sin productos"
      description="No hay productos que coincidan con los filtros."
    /><template v-else
      ><p class="results">{{ filtered.length }} producto{{ filtered.length === 1 ? '' : 's' }}</p>
      <div v-if="view === 'grid'" class="product-grid">
        <article v-for="item in visible" :key="item.product.id" class="product-card">
          <span class="category">{{ item.presentation.type }}</span
          ><ProductImage :image="item.product.imagen_principal" :alt="item.product.nombre" />
          <div class="body">
            <small>{{ item.product.sku || 'Sin SKU' }}</small>
            <h2>
              <RouterLink :to="`/productos/${item.product.id}`">{{
                item.product.nombre
              }}</RouterLink>
            </h2>
            <p>{{ item.presentation.detail || 'Sin presentación adicional' }}</p>
            <p v-if="item.discount" class="promotion">Promoción vigente</p>
            <div class="commercial">
              <strong>{{ money(item.product.precio_vigente) }}</strong
              ><span>Stock: {{ item.product.stock }}</span>
            </div>
            <small
              >Comprometido: {{ item.product.demanda_pendiente }} · Referencial:
              {{ item.product.disponibilidad_referencial }}</small
            >
          </div>
        </article>
      </div>
      <DataTable
        v-else
        caption="Listado de productos"
        :columns="columns"
        :rows="visible.map((item) => ({ ...item.product, tipo: item.presentation.type }))"
        ><template #cell-producto="{ row }"
          ><strong>{{ row.nombre }}</strong
          ><br /><small>{{ row.sku || 'Sin SKU' }}</small></template
        ><template #cell-precio="{ row }">{{ money(String(row.precio_vigente)) }}</template
        ><template #cell-stock="{ row }"
          >{{ row.stock }} <small>(ref. {{ row.disponibilidad_referencial }})</small></template
        ><template #cell-acciones="{ row }"
          ><RouterLink :to="`/productos/${row.id}`">Ver detalle</RouterLink></template
        ></DataTable
      ><Pagination :page="page" :total-pages="totalPages" @change="page = $event"
    /></template>
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
.promotion {
  color: var(--color-success) !important;
  font-weight: 700;
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
