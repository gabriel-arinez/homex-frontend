<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { ProformaListado, ValorCatalogoPublico } from '@/generated/api'
import { proformasService } from '../services/proformasService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Button from '@/shared/ui/Button.vue'
import FilterBar from '@/shared/ui/FilterBar.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import DataTable from '@/shared/ui/DataTable.vue'
import Pagination from '@/shared/ui/Pagination.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  router = useRouter(),
  rows = ref<ProformaListado[]>([]),
  states = ref<ValorCatalogoPublico[]>([]),
  loading = ref(true),
  error = ref(''),
  search = ref(''),
  state = ref(''),
  page = ref(1),
  total = ref(0),
  size = 10
const pages = computed(() => Math.max(1, Math.ceil(total.value / size)))
const displayRows = computed(() =>
    rows.value.map((row) => ({
      ...row,
      clienteNombre: row.cliente_resumen?.nombre || row.cliente_resumen?.empresa || 'Prospecto',
      estadoNombre: row.estado_info.nombre,
      monedaCodigo: row.moneda_info.codigo,
    })),
  ),
  filters = computed(() => [
    ...(search.value ? [{ key: 'q', label: `Búsqueda: ${search.value}` }] : []),
    ...(state.value
      ? [
          {
            key: 'state',
            label: `Estado: ${states.value.find((x) => x.codigo === state.value)?.nombre ?? state.value}`,
          },
        ]
      : []),
  ])
const money = (v: string, c: string) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: c }).format(Number(v))
async function load() {
  loading.value = true
  error.value = ''
  try {
    const r = await proformasService.list({
      search: search.value || undefined,
      estado: state.value || undefined,
      page: page.value,
      page_size: size,
    })
    rows.value = r.results
    total.value = r.count
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las proformas.'
  } finally {
    loading.value = false
  }
}
function remove(k: string) {
  if (k === 'q') search.value = ''
  else state.value = ''
}
function clear() {
  search.value = ''
  state.value = ''
}
watch([search, state], () => {
  page.value = 1
  void load()
})
watch(page, load)
onMounted(async () => {
  try {
    states.value = await proformasService.options('ESTADO_PROFORMA')
  } finally {
    await load()
  }
})
const columns = [
  { key: 'numero', label: 'Número' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'estado', label: 'Estado' },
  { key: 'total', label: 'Total' },
  { key: 'acciones', label: 'Acciones' },
]
</script>
<template>
  <div>
    <PageHeader
      title="Proformas"
      description="Cotizaciones comerciales de HOMEX."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><Button @click="router.push('/proformas/nueva')">Nueva proforma</Button></template
      ></PageHeader
    ><FilterBar
      ><SearchField v-model="search" label="Buscar por número, título o cliente" /><Select
        v-model="state"
        name="estado-proforma"
        label="Estado"
        :options="[
          { label: 'Todos', value: '' },
          ...states.map((x) => ({ label: x.nombre, value: x.codigo })),
        ]" /></FilterBar
    ><ActiveFilters :filters @remove="remove" @clear="clear" /><LoadingSkeleton
      v-if="loading"
      :lines="6"
    /><ErrorState v-else-if="error" :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><EmptyState
      v-else-if="!rows.length"
      :title="filters.length ? 'Sin resultados' : 'Sin proformas'"
      description="No hay proformas para mostrar."
    /><template v-else
      ><p>{{ total }} proforma{{ total === 1 ? '' : 's' }}</p>
      <DataTable caption="Listado de proformas" :columns :rows="displayRows"
        ><template #cell-numero="{ row }">#{{ row.numero }}</template
        ><template #cell-cliente="{ row }">{{ row.clienteNombre }}</template
        ><template #cell-estado="{ row }">{{ row.estadoNombre }}</template
        ><template #cell-total="{ row }">{{
          money(String(row.total), String(row.monedaCodigo))
        }}</template
        ><template #cell-acciones="{ row }"
          ><RouterLink :to="`/proformas/${row.id}`">Ver detalle</RouterLink></template
        ></DataTable
      ><Pagination :page :total-pages="pages" @change="page = $event"
    /></template>
  </div>
</template>
<style scoped>
.filter-bar {
  margin-bottom: var(--space-4);
}
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
.pagination {
  margin-top: var(--space-5);
}
</style>
