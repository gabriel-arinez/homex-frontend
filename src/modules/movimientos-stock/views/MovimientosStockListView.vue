<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MovimientoStock, ValorCatalogoPublico } from '@/generated/api'
import { movimientosStockService } from '../services/movimientosStockService'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import DataTable from '@/shared/ui/DataTable.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import FilterBar from '@/shared/ui/FilterBar.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Pagination from '@/shared/ui/Pagination.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'

const emit = defineEmits<{ openMenu: [] }>()
const rows = ref<MovimientoStock[]>([])
const types = ref<ValorCatalogoPublico[]>([])
const total = ref(0)
const loading = ref(true)
const referenceLoading = ref(true)
const error = ref('')
const referenceError = ref('')
const search = ref('')
const type = ref('')
const pedido = ref('')
const producto = ref('')
const fechaDesde = ref('')
const fechaHasta = ref('')
const page = ref(1)
const pageSize = 20
let requestId = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const activeFilters = computed(() => [
  ...(search.value.trim() ? [{ key: 'search', label: `Búsqueda: ${search.value.trim()}` }] : []),
  ...(type.value
    ? [
        {
          key: 'type',
          label: `Tipo: ${types.value.find((item) => item.codigo === type.value)?.nombre ?? type.value}`,
        },
      ]
    : []),
  ...(pedido.value ? [{ key: 'pedido', label: `Pedido #${pedido.value}` }] : []),
  ...(producto.value ? [{ key: 'producto', label: `Producto #${producto.value}` }] : []),
  ...(fechaDesde.value ? [{ key: 'desde', label: `Desde: ${fechaDesde.value}` }] : []),
  ...(fechaHasta.value ? [{ key: 'hasta', label: `Hasta: ${fechaHasta.value}` }] : []),
])

function removeFilter(key: string) {
  if (key === 'search') search.value = ''
  if (key === 'type') type.value = ''
  if (key === 'pedido') pedido.value = ''
  if (key === 'producto') producto.value = ''
  if (key === 'desde') fechaDesde.value = ''
  if (key === 'hasta') fechaHasta.value = ''
}
function clearFilters() {
  search.value = ''
  type.value = ''
  pedido.value = ''
  producto.value = ''
  fechaDesde.value = ''
  fechaHasta.value = ''
}
async function loadReferences() {
  referenceLoading.value = true
  referenceError.value = ''
  try {
    types.value = await movimientosStockService.types()
  } catch (cause) {
    referenceError.value =
      cause instanceof Error ? cause.message : 'No se pudieron cargar los tipos de movimiento.'
  } finally {
    referenceLoading.value = false
  }
}
async function load() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await movimientosStockService.list({
      search: search.value.trim() || undefined,
      tipo_movimiento: type.value || undefined,
      pedido: pedido.value ? Number(pedido.value) : undefined,
      producto: producto.value ? Number(producto.value) : undefined,
      fecha_desde: fechaDesde.value || undefined,
      fecha_hasta: fechaHasta.value || undefined,
      page: page.value,
      page_size: pageSize,
    })
    if (currentRequest !== requestId) return
    rows.value = result.results
    total.value = result.count
  } catch (cause) {
    if (currentRequest !== requestId) return
    rows.value = []
    total.value = 0
    error.value =
      cause instanceof Error ? cause.message : 'No se pudieron cargar los movimientos de stock.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch([search, type, pedido, producto, fechaDesde, fechaHasta], () => {
  if (page.value !== 1) page.value = 1
  void load()
})
watch(page, () => void load())
onMounted(() => {
  void load()
  void loadReferences()
})

const columns = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'producto', label: 'Producto' },
  { key: 'cantidad', label: 'Cantidad' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'observaciones', label: 'Observaciones' },
]
</script>

<template>
  <div>
    <PageHeader
      title="Movimientos de stock"
      description="Historial inmutable generado por las operaciones comerciales de HOMEX."
      show-menu
      @menu="emit('openMenu')"
    />
    <FilterBar>
      <SearchField v-model="search" label="Buscar por SKU, producto u observación" />
      <Select
        v-model="type"
        name="tipo-movimiento"
        label="Tipo"
        :disabled="referenceLoading || Boolean(referenceError)"
        :options="[
          { label: 'Todos', value: '' },
          ...types.map((item) => ({ label: item.nombre, value: item.codigo })),
        ]"
      />
      <TextField v-model="pedido" name="pedido-movimiento" label="Pedido" type="number" min="1" />
      <TextField
        v-model="producto"
        name="producto-movimiento"
        label="Producto"
        type="number"
        min="1"
      />
      <TextField v-model="fechaDesde" name="fecha-desde" label="Desde" type="date" />
      <TextField v-model="fechaHasta" name="fecha-hasta" label="Hasta" type="date" />
    </FilterBar>
    <p v-if="referenceError" class="error" role="alert">
      {{ referenceError }}
      <button type="button" @click="loadReferences">Reintentar tipos</button>
    </p>
    <ActiveFilters :filters="activeFilters" @remove="removeFilter" @clear="clearFilters" />
    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="!rows.length"
      title="Sin movimientos"
      description="No hay movimientos que coincidan con los filtros aplicados."
    />
    <template v-else>
      <p class="results">{{ total }} movimiento{{ total === 1 ? '' : 's' }}</p>
      <DataTable caption="Historial de movimientos de stock" :columns="columns" :rows="rows">
        <template #cell-fecha="{ row }">{{
          new Date(String(row.fecha)).toLocaleString('es-BO')
        }}</template>
        <template #cell-tipo="{ row }">{{ row.tipo_movimiento_info.nombre }}</template>
        <template #cell-producto="{ row }">
          <strong>{{ row.producto_resumen.nombre }}</strong>
          <small>{{ row.producto_resumen.sku || `#${row.producto}` }}</small>
        </template>
        <template #cell-cantidad="{ row }">
          <strong :class="Number(row.cantidad) < 0 ? 'out' : 'in'">
            {{ Number(row.cantidad) > 0 ? '+' : '' }}{{ row.cantidad }}
          </strong>
        </template>
        <template #cell-pedido="{ row }">{{ row.pedido ? `#${row.pedido}` : 'Sin pedido' }}</template>
        <template #cell-observaciones="{ row }">{{ row.observaciones || '—' }}</template>
      </DataTable>
      <Pagination :page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>

<style scoped>
.filter-bar {
  margin-bottom: var(--space-4);
}
.results,
small {
  color: var(--color-text-secondary);
}
small {
  display: block;
  margin-top: 0.2rem;
}
.in {
  color: var(--color-success);
}
.out,
.error {
  color: var(--color-danger);
}
.pagination {
  margin-top: var(--space-5);
}
</style>
