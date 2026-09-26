<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { NotaEntrega } from '@/generated/api'
import { notasEntregaService } from '../services/notasEntregaService'
import { downloadBlob } from '@/shared/download/downloadBlob'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  id = Number(useRoute().params.id),
  item = ref<NotaEntrega | null>(null),
  loading = ref(true),
  downloading = ref(false),
  error = ref('')
async function load() {
  loading.value = true
  try {
    item.value = await notasEntregaService.get(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la nota.'
  } finally {
    loading.value = false
  }
}
async function downloadDocument() {
  if (!item.value || downloading.value) return
  downloading.value = true
  error.value = ''
  try {
    downloadBlob(await notasEntregaService.document(id), `nota-entrega-${item.value.numero}.html`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo descargar la nota.'
  } finally {
    downloading.value = false
  }
}
onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      :title="`Nota de entrega #${item?.numero ?? id}`"
      description="Documento emitido para realizar la entrega del pedido."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><RouterLink to="/notas-entrega">Volver</RouterLink
        ><Button v-if="item" variant="secondary" :processing="downloading" @click="downloadDocument"
          >Descargar</Button
        ></template
      ></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="5" /><ErrorState v-else-if="error" :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><Card v-else-if="item"
      ><dl>
        <div>
          <dt>Fecha de emisión</dt>
          <dd>{{ item.fecha }}</dd>
        </div>
        <div>
          <dt>Pedido</dt>
          <dd>
            <RouterLink :to="`/pedidos/${item.pedido}`">#{{ item.pedido }}</RouterLink>
          </dd>
        </div>
      </dl>
      <p>HOMEX no registra entregas parciales. Esta nota corresponde al pedido completo.</p></Card
    >
  </div>
</template>
<style scoped>
dl {
  display: grid;
  gap: var(--space-4);
}
dl div {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding: 0.6rem;
}
dd {
  font-weight: 700;
}
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
</style>
