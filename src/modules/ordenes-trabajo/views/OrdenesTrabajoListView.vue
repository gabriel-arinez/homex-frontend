<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { OrdenTrabajo } from '@/generated/api'
import { ordenesTrabajoService } from '../services/ordenesTrabajoService'
import DataTable from '@/shared/ui/DataTable.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'

const emit = defineEmits<{ openMenu: [] }>()
const rows = ref<OrdenTrabajo[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await ordenesTrabajoService.list()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las órdenes.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const tableRows = computed(() =>
  rows.value.map((item) => ({
    ...item,
    estadoLabel: item.estado_info.nombre,
  })),
)

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
    />
    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="!rows.length"
      title="Sin órdenes"
      description="No hay órdenes de trabajo para mostrar."
    />
    <DataTable v-else caption="Órdenes de trabajo" :columns="columns" :rows="tableRows">
      <template #cell-numero="{ row }">OT #{{ row.numero }}</template>
      <template #cell-pedido="{ row }">
        <RouterLink :to="`/pedidos/${row.pedido}`">#{{ row.pedido }}</RouterLink>
      </template>
      <template #cell-estado="{ row }">{{ row.estadoLabel }}</template>
      <template #cell-acciones="{ row }">
        <RouterLink :to="`/ordenes-trabajo/${row.id}`">Ver detalle</RouterLink>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
</style>
