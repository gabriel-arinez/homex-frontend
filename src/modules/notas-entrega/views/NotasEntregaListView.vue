<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { NotaEntrega } from '@/generated/api'
import { notasEntregaService } from '../services/notasEntregaService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import DataTable from '@/shared/ui/DataTable.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  rows = ref<NotaEntrega[]>([]),
  loading = ref(true),
  error = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await notasEntregaService.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las notas.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
const columns = [
  { key: 'numero', label: 'Número' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'fecha', label: 'Emisión' },
  { key: 'acciones', label: 'Acciones' },
]
</script>
<template>
  <div>
    <PageHeader
      title="Notas de entrega"
      description="Notas emitidas cuando el pedido está listo para entrega."
      show-menu
      @menu="emit('openMenu')"
    /><LoadingSkeleton v-if="loading" :lines="5" /><ErrorState
      v-else-if="error"
      :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><EmptyState
      v-else-if="!rows.length"
      title="Sin notas de entrega"
      description="Una nota se emite desde un pedido listo para entrega."
    /><DataTable v-else caption="Notas de entrega" :columns :rows
      ><template #cell-numero="{ row }">#{{ row.numero }}</template
      ><template #cell-pedido="{ row }"
        ><RouterLink :to="`/pedidos/${row.pedido}`">#{{ row.pedido }}</RouterLink></template
      ><template #cell-acciones="{ row }"
        ><RouterLink :to="`/notas-entrega/${row.id}`">Ver detalle</RouterLink></template
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
