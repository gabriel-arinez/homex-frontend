<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { OrdenTrabajo, ValorCatalogoPublico } from '@/generated/api'
import { ordenesTrabajoService } from '../services/ordenesTrabajoService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import DataTable from '@/shared/ui/DataTable.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  rows = ref<OrdenTrabajo[]>([]),
  states = ref<ValorCatalogoPublico[]>([]),
  loading = ref(true),
  error = ref('')
const name = (id: number) => states.value.find((x) => x.id === id)?.nombre ?? `Estado ${id}`
async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[rows.value, states.value] = await Promise.all([
      ordenesTrabajoService.list(),
      ordenesTrabajoService.options('ESTADO_ORDEN_TRABAJO'),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las órdenes.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
const columns = [
  { key: 'numero', label: 'Número' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'estado', label: 'Estado' },
  { key: 'acciones', label: 'Acciones' },
]
</script>
<template>
  <div>
    <PageHeader
      title="Órdenes de trabajo"
      description="Preparación y fabricación asociada a pedidos confirmados."
      show-menu
      @menu="emit('openMenu')"
    /><LoadingSkeleton v-if="loading" :lines="6" /><ErrorState
      v-else-if="error"
      :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><EmptyState
      v-else-if="!rows.length"
      title="Sin órdenes"
      description="No hay órdenes de trabajo para mostrar."
    /><DataTable v-else caption="Órdenes de trabajo" :columns :rows
      ><template #cell-numero="{ row }">OT #{{ row.numero }}</template
      ><template #cell-pedido="{ row }"
        ><RouterLink :to="`/pedidos/${row.pedido}`">#{{ row.pedido }}</RouterLink></template
      ><template #cell-estado="{ row }">{{ name(Number(row.estado)) }}</template
      ><template #cell-acciones="{ row }"
        ><RouterLink :to="`/ordenes-trabajo/${row.id}`">Ver detalle</RouterLink></template
      ></DataTable
    >
  </div>
</template>
<style scoped>
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
</style>
