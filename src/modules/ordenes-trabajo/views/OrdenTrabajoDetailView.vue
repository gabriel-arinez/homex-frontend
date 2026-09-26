<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { OrdenTrabajo } from '@/generated/api'
import { ordenesTrabajoService } from '../services/ordenesTrabajoService'
import { downloadBlob } from '@/shared/download/downloadBlob'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import DataTable from '@/shared/ui/DataTable.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'

const emit = defineEmits<{ openMenu: [] }>()
const id = Number(useRoute().params.id)
const item = ref<OrdenTrabajo | null>(null)
const loading = ref(true)
const downloading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    item.value = await ordenesTrabajoService.get(id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la orden.'
  } finally {
    loading.value = false
  }
}
async function downloadDocument() {
  if (!item.value || downloading.value) return
  downloading.value = true
  error.value = ''
  try {
    downloadBlob(
      await ordenesTrabajoService.document(id),
      `orden-trabajo-${item.value.numero}.html`,
    )
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo descargar la orden.'
  } finally {
    downloading.value = false
  }
}
onMounted(load)

const columns = [
  { key: 'nombre', label: 'Ítem' },
  { key: 'cantidad', label: 'Cantidad' },
  { key: 'unidad', label: 'Unidad' },
  { key: 'modo', label: 'Cálculo' },
  { key: 'total', label: 'Total' },
]
</script>

<template>
  <div>
    <PageHeader
      :title="`Orden de trabajo #${item?.numero ?? id}`"
      description="Fabricación o preparación asociada al pedido."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <RouterLink to="/ordenes-trabajo">Volver</RouterLink>
        <Button v-if="item" variant="secondary" :processing="downloading" @click="downloadDocument">
          Descargar
        </Button>
      </template>
    </PageHeader>
    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error && !item" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <template v-else-if="item">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <Card>
        <dl>
          <div>
            <dt>Pedido</dt>
            <dd><RouterLink :to="`/pedidos/${item.pedido}`">#{{ item.pedido }}</RouterLink></dd>
          </div>
          <div>
            <dt>Proforma</dt>
            <dd>Proforma #{{ item.proforma_numero }}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{{ item.estado_info.nombre }}</dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd>{{ item.estado_saldo_info?.nombre ?? 'Sin asignar' }}</dd>
          </div>
          <div>
            <dt>Inicio</dt>
            <dd>{{ item.fecha_inicio ?? 'Pendiente' }}</dd>
          </div>
          <div>
            <dt>Fin</dt>
            <dd>{{ item.fecha_fin ?? 'Pendiente' }}</dd>
          </div>
          <div>
            <dt>Entrega prevista</dt>
            <dd>{{ item.fecha_entrega ?? 'Sin definir' }}</dd>
          </div>
          <div>
            <dt>Lugar</dt>
            <dd>{{ item.lugar_entrega ?? 'Sin definir' }}</dd>
          </div>
        </dl>
      </Card>
      <section class="details">
        <h2>Detalle de trabajo</h2>
        <p>Estas líneas provienen de la proforma aprobada que originó el pedido.</p>
        <DataTable caption="Detalle de la orden de trabajo" :columns="columns" :rows="item.detalles">
          <template #cell-nombre="{ row }"><strong>{{ row.nombre }}</strong></template>
          <template #cell-unidad="{ row }">{{ row.unidad_info.nombre }}</template>
          <template #cell-modo="{ row }">{{ String(row.modo_calculo).replace(/_/g, ' ') }}</template>
          <template #cell-total="{ row }">Bs {{ Number(row.total).toFixed(2) }}</template>
        </DataTable>
      </section>
    </template>
  </div>
</template>

<style scoped>
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
dl div {
  padding: 0.6rem;
  border-bottom: 1px solid var(--color-border);
}
dt,
.details p {
  color: var(--color-text-secondary);
}
dd {
  margin: 0.2rem 0;
  font-weight: 700;
}
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
.details {
  margin-top: var(--space-6);
}
.error {
  color: var(--color-danger);
}
@media (max-width: 600px) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
