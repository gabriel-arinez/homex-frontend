<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Recibo } from '@/generated/api'
import { recibosService } from '../services/recibosService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import DataTable from '@/shared/ui/DataTable.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  rows = ref<Recibo[]>([]),
  loading = ref(true),
  error = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await recibosService.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los recibos.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
const columns = [
  { key: 'numero', label: 'Número' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'pago', label: 'Pago' },
  { key: 'saldo', label: 'Saldo' },
  { key: 'estado', label: 'Estado' },
  { key: 'acciones', label: 'Acciones' },
]
const money = (v: string) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(v))
</script>
<template>
  <div>
    <PageHeader
      title="Recibos"
      description="Historial inmutable de cobros registrados."
      show-menu
      @menu="emit('openMenu')"
    /><LoadingSkeleton v-if="loading" :lines="6" /><ErrorState
      v-else-if="error"
      :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><EmptyState
      v-else-if="!rows.length"
      title="Sin recibos"
      description="Los recibos se emiten desde un pedido confirmado."
    /><DataTable v-else caption="Listado de recibos" :columns :rows
      ><template #cell-numero="{ row }">#{{ row.numero }}</template
      ><template #cell-pedido="{ row }"
        ><RouterLink :to="`/pedidos/${row.pedido}`">#{{ row.pedido }}</RouterLink></template
      ><template #cell-pago="{ row }">{{ money(String(row.pago_actual)) }}</template
      ><template #cell-saldo="{ row }">{{ money(String(row.saldo)) }}</template
      ><template #cell-estado="{ row }">{{ row.estado }}</template
      ><template #cell-acciones="{ row }"
        ><RouterLink :to="`/recibos/${row.id}`">Ver detalle</RouterLink></template
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
