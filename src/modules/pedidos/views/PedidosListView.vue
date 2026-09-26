<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Pedido, ValorCatalogoPublico } from '@/generated/api'
import { pedidosService } from '../services/pedidosService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import DataTable from '@/shared/ui/DataTable.vue'
import Select from '@/shared/ui/Select.vue'
import FilterBar from '@/shared/ui/FilterBar.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  rows = ref<Pedido[]>([]),
  states = ref<ValorCatalogoPublico[]>([]),
  loading = ref(true),
  error = ref(''),
  state = ref('')
const name = (id: number) => states.value.find((x) => x.id === id)?.nombre ?? `Estado ${id}`
const filtered = computed(() =>
  state.value ? rows.value.filter((x) => String(x.estado) === state.value) : rows.value,
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[rows.value, states.value] = await Promise.all([
      pedidosService.list(),
      pedidosService.options('ESTADO_PEDIDO'),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
const columns = [
  { key: 'id', label: 'Pedido' },
  { key: 'fecha', label: 'Confirmación' },
  { key: 'estado', label: 'Estado' },
  { key: 'proforma', label: 'Proforma' },
  { key: 'acciones', label: 'Acciones' },
]
</script>
<template>
  <div>
    <PageHeader
      title="Pedidos"
      description="Pedidos confirmados y su estado operativo real."
      show-menu
      @menu="emit('openMenu')"
    /><FilterBar
      ><Select
        v-model="state"
        name="estado-pedido"
        label="Estado"
        :options="[
          { label: 'Todos', value: '' },
          ...states.map((x) => ({ label: x.nombre, value: String(x.id) })),
        ]" /></FilterBar
    ><LoadingSkeleton v-if="loading" :lines="6" /><ErrorState v-else-if="error" :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><EmptyState
      v-else-if="!filtered.length"
      title="Sin pedidos"
      description="No hay pedidos para mostrar."
    /><DataTable v-else caption="Listado de pedidos" :columns :rows="filtered"
      ><template #cell-id="{ row }">#{{ row.id }}</template
      ><template #cell-fecha="{ row }">{{
        new Date(String(row.fecha_confirmacion)).toLocaleString('es-BO')
      }}</template
      ><template #cell-estado="{ row }">{{ name(Number(row.estado)) }}</template
      ><template #cell-proforma="{ row }"
        ><RouterLink :to="`/proformas/${row.proforma}`">#{{ row.proforma }}</RouterLink></template
      ><template #cell-acciones="{ row }"
        ><RouterLink :to="`/pedidos/${row.id}`">Ver detalle</RouterLink></template
      ></DataTable
    >
  </div>
</template>
<style scoped>
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
.filter-bar {
  margin-bottom: var(--space-4);
}
</style>
