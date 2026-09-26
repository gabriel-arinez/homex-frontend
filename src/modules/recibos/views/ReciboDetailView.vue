<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { Recibo, ValorCatalogoPublico } from '@/generated/api'
import { recibosService } from '../services/recibosService'
import { downloadBlob } from '@/shared/download/downloadBlob'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Card from '@/shared/ui/Card.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  id = Number(useRoute().params.id),
  item = ref<Recibo | null>(null),
  types = ref<ValorCatalogoPublico[]>([]),
  loading = ref(true),
  processing = ref(false),
  downloading = ref(false),
  error = ref(''),
  confirm = ref(false),
  notice = ref(''),
  money = (v: string) =>
    new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(v))
async function load() {
  loading.value = true
  try {
    ;[item.value, types.value] = await Promise.all([
      recibosService.get(id),
      recibosService.paymentTypes(),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el recibo.'
  } finally {
    loading.value = false
  }
}
async function downloadDocument() {
  if (!item.value || downloading.value) return
  downloading.value = true
  error.value = ''
  try {
    downloadBlob(await recibosService.document(id), `recibo-${item.value.numero}.html`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo descargar el recibo.'
  } finally {
    downloading.value = false
  }
}
async function annul() {
  processing.value = true
  try {
    item.value = await recibosService.annul(id)
    notice.value = 'Recibo anulado. Ya no se considera para el saldo pagado.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo anular.'
  } finally {
    processing.value = false
    confirm.value = false
  }
}
onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      :title="`Recibo #${item?.numero ?? id}`"
      description="Evidencia inmutable del cobro."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><RouterLink to="/recibos">Volver</RouterLink
        ><Button v-if="item" variant="secondary" :processing="downloading" @click="downloadDocument"
          >Descargar</Button
        ></template
      ></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="7" /><ErrorState
      v-else-if="error && !item"
      :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><template v-else-if="item"
      ><p v-if="notice" role="status" class="notice">{{ notice }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <Card
        ><dl>
          <div>
            <dt>Estado</dt>
            <dd>{{ item.estado }}</dd>
          </div>
          <div>
            <dt>Pedido</dt>
            <dd>
              <RouterLink :to="`/pedidos/${item.pedido}`">#{{ item.pedido }}</RouterLink>
            </dd>
          </div>
          <div>
            <dt>Cliente/receptor</dt>
            <dd>{{ item.nombre_completo }}</dd>
          </div>
          <div>
            <dt>Concepto</dt>
            <dd>{{ item.concepto }}</dd>
          </div>
          <div>
            <dt>Tipo de pago</dt>
            <dd>
              {{ types.find((x) => x.id === item?.tipo_pago)?.nombre ?? `Tipo ${item.tipo_pago}` }}
            </dd>
          </div>
          <div>
            <dt>Pago</dt>
            <dd>{{ money(item.pago_actual) }}</dd>
          </div>
          <div>
            <dt>Acumulado</dt>
            <dd>{{ money(item.a_cuenta) }}</dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd>{{ money(item.saldo) }}</dd>
          </div>
        </dl>
        <Button
          v-if="item.estado === 'EMITIDO'"
          variant="danger"
          :disabled="processing"
          @click="confirm = true"
          >Anular recibo</Button
        ></Card
      ></template
    ><ConfirmDialog
      :open="confirm"
      title="Anular recibo"
      description="El recibo conservará su evidencia y cambiará a ANULADO. No se elimina."
      confirm-label="Anular"
      danger
      @cancel="confirm = false"
      @confirm="annul"
    />
  </div>
</template>
<style scoped>
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
dl div {
  border-bottom: 1px solid var(--color-border);
  padding: 0.6rem;
}
dt {
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
.notice {
  padding: var(--space-3);
  background: var(--color-success-soft);
}
@media (max-width: 600px) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
