<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { Cliente, ValorCatalogoPublico } from '@/generated/api'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { clientesService, nombreCliente } from '../services/clientesService'
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

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const clients = ref<Cliente[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const status = ref(typeof route.query.estado === 'string' ? route.query.estado : 'todos')
const type = ref(typeof route.query.tipo === 'string' ? route.query.tipo : 'todos')
const types = ref<ValorCatalogoPublico[]>([])
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 10
let requestId = 0
let restoringRoute = false

const statusLabels: Record<string, string> = {
  todos: 'Todos',
  activos: 'Activos',
  inactivos: 'Inactivos',
}
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const hasFilters = computed(
  () => Boolean(search.value.trim()) || status.value !== 'todos' || type.value !== 'todos',
)
const activeFilters = computed(() => [
  ...(search.value.trim() ? [{ key: 'search', label: `Búsqueda: ${search.value.trim()}` }] : []),
  ...(status.value !== 'todos'
    ? [{ key: 'status', label: `Estado: ${statusLabels[status.value] ?? status.value}` }]
    : []),
  ...(type.value !== 'todos'
    ? [
        {
          key: 'type',
          label: `Tipo: ${types.value.find((item) => String(item.id) === type.value)?.nombre ?? type.value}`,
        },
      ]
    : []),
])

function removeFilter(key: string) {
  if (key === 'search') search.value = ''
  if (key === 'status') status.value = 'todos'
  if (key === 'type') type.value = 'todos'
}
function clearFilters() {
  search.value = ''
  status.value = 'todos'
  type.value = 'todos'
}

function activeFilter() {
  if (status.value === 'activos') return true
  if (status.value === 'inactivos') return false
  return undefined
}

function syncRoute() {
  void router.replace({
    query: {
      q: search.value || undefined,
      estado: status.value === 'todos' ? undefined : status.value,
      pagina: page.value > 1 ? page.value : undefined,
      tipo: type.value === 'todos' ? undefined : type.value,
    },
  })
}

async function load() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const response = await clientesService.list({
      search: search.value.trim() || undefined,
      activo: activeFilter(),
      page: page.value,
      page_size: pageSize,
      tipo_cliente: type.value === 'todos' ? undefined : Number(type.value),
    })
    if (currentRequest !== requestId) return
    clients.value = response.results
    total.value = response.count
  } catch (cause) {
    if (currentRequest !== requestId) return
    clients.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar los clientes.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch([search, status, type], () => {
  if (restoringRoute) return
  if (page.value !== 1) {
    page.value = 1
    return
  }
  syncRoute()
  void load()
})
watch(page, () => {
  if (restoringRoute) return
  syncRoute()
  void load()
})
watch(
  () => route.fullPath,
  async () => {
    const q = typeof route.query.q === 'string' ? route.query.q : ''
    const estado = typeof route.query.estado === 'string' ? route.query.estado : 'todos'
    const tipo = typeof route.query.tipo === 'string' ? route.query.tipo : 'todos'
    const pagina = Math.max(1, Number(route.query.pagina) || 1)
    if (
      q === search.value &&
      estado === status.value &&
      tipo === type.value &&
      pagina === page.value
    )
      return
    restoringRoute = true
    search.value = q
    status.value = estado
    type.value = tipo
    page.value = pagina
    await nextTick()
    restoringRoute = false
    void load()
  },
)
onMounted(() => {
  void load()
  void proformasService
    .options('TIPO_CLIENTE')
    .then((value) => (types.value = value))
    .catch(() => (types.value = []))
})

const columns = [
  { key: 'nombre', label: 'Cliente' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'celular', label: 'Celular' },
  { key: 'estado', label: 'Estado' },
  { key: 'acciones', label: 'Acciones' },
]
</script>

<template>
  <div>
    <PageHeader
      title="Clientes"
      description="Consulta y administra los clientes registrados."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><RouterLink class="primary-link" to="/clientes/nuevo">Nuevo cliente</RouterLink></template
      ></PageHeader
    >
    <FilterBar>
      <SearchField v-model="search" label="Buscar por nombre, empresa o celular" />
      <Select
        v-model="status"
        name="estado-cliente"
        label="Estado"
        :options="[
          { label: 'Todos', value: 'todos' },
          { label: 'Activos', value: 'activos' },
          { label: 'Inactivos', value: 'inactivos' },
        ]"
      />
      <Select
        v-model="type"
        name="tipo-cliente"
        label="Tipo de cliente"
        :options="[
          { label: 'Todos', value: 'todos' },
          ...types.map((item) => ({ label: item.nombre, value: String(item.id) })),
        ]"
      />
    </FilterBar>
    <ActiveFilters :filters="activeFilters" @remove="removeFilter" @clear="clearFilters" />
    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="clients.length === 0"
      :title="hasFilters ? 'Sin resultados' : 'Sin clientes'"
      :description="
        hasFilters
          ? 'No hay clientes que coincidan con la búsqueda y los filtros.'
          : 'No hay clientes registrados para mostrar.'
      "
    />
    <template v-else>
      <p class="results">{{ total }} cliente{{ total === 1 ? '' : 's' }}</p>
      <DataTable
        caption="Listado de clientes"
        :columns="columns"
        :rows="
          clients.map((client) => ({
            ...client,
            nombre: nombreCliente(client),
            tipo: client.tipo_cliente_info?.nombre ?? `Tipo #${client.tipo_cliente}`,
          }))
        "
      >
        <template #cell-nombre="{ row }"
          ><strong>{{ row.nombre }}</strong></template
        >
        <template #cell-celular="{ row }">{{ row.celular || 'Sin celular' }}</template>
        <template #cell-tipo="{ row }">{{ row.tipo }}</template>
        <template #cell-estado="{ row }">
          <span :class="row.activo === false ? 'inactive' : 'active'">{{
            row.activo === false ? 'Inactivo' : 'Activo'
          }}</span>
        </template>
        <template #cell-acciones="{ row }">
          <RouterLink :to="`/clientes/${row.id}`">Ver detalle</RouterLink>
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
.pagination {
  margin-top: var(--space-5);
}
.active {
  color: var(--color-success);
}
.inactive {
  color: var(--color-text-muted);
}
a {
  color: var(--color-primary-accent);
  font-weight: 600;
}
.primary-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.625rem 1rem;
  color: white;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  text-decoration: none;
}
</style>
