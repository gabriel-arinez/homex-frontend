<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { Cliente } from '@/generated/api'
import { clientesService, nombreCliente } from '../services/clientesService'
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
const loading = ref(true)
const error = ref('')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const status = ref(typeof route.query.estado === 'string' ? route.query.estado : 'todos')
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 10
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('es')
  return clients.value.filter((client) => {
    const matchesStatus =
      status.value === 'todos' ||
      (status.value === 'activos' ? client.activo !== false : client.activo === false)
    const haystack = [nombreCliente(client), client.celular, client.direccion]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es')
    return matchesStatus && (!query || haystack.includes(query))
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
watch([search, status], () => (page.value = 1))
watch([search, status, page], () => {
  void router.replace({
    query: {
      q: search.value || undefined,
      estado: status.value === 'todos' ? undefined : status.value,
      pagina: page.value > 1 ? page.value : undefined,
    },
  })
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    clients.value = await clientesService.list()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar los clientes.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
const columns = [
  { key: 'nombre', label: 'Cliente' },
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
    />
    <FilterBar>
      <SearchField v-model="search" label="Buscar por nombre, celular o dirección" />
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
    </FilterBar>
    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error"
      ><button type="button" @click="load">Reintentar</button></ErrorState
    >
    <EmptyState
      v-else-if="filtered.length === 0"
      title="Sin resultados"
      description="No hay clientes que coincidan con los filtros."
    />
    <template v-else>
      <p class="results">{{ filtered.length }} cliente{{ filtered.length === 1 ? '' : 's' }}</p>
      <DataTable
        caption="Listado de clientes"
        :columns="columns"
        :rows="visible.map((client) => ({ ...client, nombre: nombreCliente(client) }))"
      >
        <template #cell-nombre="{ row }"
          ><strong>{{ row.nombre }}</strong></template
        >
        <template #cell-celular="{ row }">{{ row.celular || 'Sin celular' }}</template>
        <template #cell-estado="{ row }"
          ><span :class="row.activo === false ? 'inactive' : 'active'">{{
            row.activo === false ? 'Inactivo' : 'Activo'
          }}</span></template
        >
        <template #cell-acciones="{ row }"
          ><RouterLink :to="`/clientes/${row.id}`">Ver detalle</RouterLink></template
        >
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
</style>
