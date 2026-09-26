<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { Pedido, ValorCatalogoPublico } from '@/generated/api'
import { pedidosService } from '../services/pedidosService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Card from '@/shared/ui/Card.vue'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import Modal from '@/shared/ui/Modal.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  route = useRoute(),
  id = Number(route.params.id),
  pedido = ref<Pedido | null>(null),
  states = ref<ValorCatalogoPublico[]>([]),
  payments = ref<ValorCatalogoPublico[]>([]),
  loading = ref(true),
  processing = ref(false),
  error = ref(''),
  notice = ref(''),
  newState = ref(''),
  receiptOpen = ref(false),
  cancelOpen = ref(false),
  noteOpen = ref(false),
  form = ref({
    nombre_completo: '',
    monto_en_letras: '',
    concepto: '',
    tipo_pago: '',
    numero_cheque: '',
    banco: '',
    pago_actual: '',
  })
const current = computed(() => states.value.find((x) => x.id === pedido.value?.estado))
const currentCode = computed(() => current.value?.codigo ?? '')
const isCheque = computed(
  () => payments.value.find((x) => String(x.id) === form.value.tipo_pago)?.codigo === 'CHEQUE',
)
const stateName = computed(
  () => current.value?.nombre ?? (pedido.value ? `Estado ${pedido.value.estado}` : ''),
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[pedido.value, states.value, payments.value] = await Promise.all([
      pedidosService.get(id),
      pedidosService.options('ESTADO_PEDIDO'),
      pedidosService.options('TIPO_PAGO'),
    ])
    newState.value = String(pedido.value.estado)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el pedido.'
  } finally {
    loading.value = false
  }
}
async function action(fn: () => Promise<unknown>, message: string) {
  processing.value = true
  error.value = ''
  notice.value = ''
  try {
    await fn()
    notice.value = message
    await load()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'La operación no pudo completarse.'
    await load()
    error.value = message
  } finally {
    processing.value = false
  }
}
const change = () =>
  action(
    () =>
      pedidosService.changeState(id, {
        estado_codigo: states.value.find((x) => String(x.id) === newState.value)?.codigo as never,
      }),
    'Estado actualizado con la respuesta del backend.',
  )
const cancel = () =>
  action(
    () => pedidosService.cancel(id),
    'Pedido cancelado y stock reconciliado por el backend.',
  ).finally(() => (cancelOpen.value = false))
const note = () =>
  action(() => pedidosService.emitDeliveryNote(id), 'Nota de entrega emitida.').finally(
    () => (noteOpen.value = false),
  )
const receipt = () =>
  action(
    () =>
      pedidosService.emitReceipt(id, {
        nombre_completo: form.value.nombre_completo,
        monto_en_letras: form.value.monto_en_letras,
        concepto: form.value.concepto,
        tipo_pago: Number(form.value.tipo_pago),
        numero_cheque: isCheque.value ? form.value.numero_cheque : null,
        banco: isCheque.value ? form.value.banco : null,
        pago_actual: form.value.pago_actual,
      }),
    'Recibo emitido.',
  ).finally(() => (receiptOpen.value = false))
onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      :title="`Pedido #${id}`"
      description="Estado, cobros y entrega bajo autoridad del backend."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions><RouterLink to="/pedidos">Volver</RouterLink></template></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="7" /><ErrorState
      v-else-if="error && !pedido"
      :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><template v-else-if="pedido"
      ><p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="grid">
        <Card
          ><h2>Información</h2>
          <dl>
            <div>
              <dt>Estado</dt>
              <dd>{{ stateName }}</dd>
            </div>
            <div>
              <dt>Confirmado</dt>
              <dd>{{ new Date(pedido.fecha_confirmacion).toLocaleString('es-BO') }}</dd>
            </div>
            <div>
              <dt>Proforma</dt>
              <dd>
                <RouterLink :to="`/proformas/${pedido.proforma}`"
                  >#{{ pedido.proforma }}</RouterLink
                >
              </dd>
            </div>
          </dl></Card
        ><Card
          ><h2>Operaciones</h2>
          <p>El backend valida cada transición y cualquier conflicto comercial.</p>
          <Select
            v-model="newState"
            name="nuevo-estado"
            label="Nuevo estado"
            :options="states.map((x) => ({ label: x.nombre, value: String(x.id) }))"
          /><Button :disabled="processing || newState === String(pedido.estado)" @click="change"
            >Cambiar estado</Button
          >
          <div class="actions">
            <Button
              v-if="currentCode === 'CONFIRMADO'"
              :disabled="processing"
              @click="receiptOpen = true"
              >Emitir recibo</Button
            ><Button
              v-if="currentCode === 'LISTO_ENTREGA'"
              :disabled="processing"
              @click="noteOpen = true"
              >Emitir nota de entrega</Button
            ><Button
              v-if="!['CANCELADO', 'ENTREGADO'].includes(currentCode)"
              variant="danger"
              :disabled="processing"
              @click="cancelOpen = true"
              >Cancelar pedido</Button
            >
          </div></Card
        >
      </div></template
    >
    <Modal
      :open="receiptOpen"
      title="Emitir recibo"
      description="El pago se registra sobre este pedido confirmado."
      @close="receiptOpen = false"
      ><form id="receipt" class="form" @submit.prevent="receipt">
        <TextField
          v-model="form.nombre_completo"
          label="Nombre completo"
          name="nombre"
          required
        /><TextField
          v-model="form.monto_en_letras"
          label="Monto en letras"
          name="letras"
          required
        /><TextField v-model="form.concepto" label="Concepto" name="concepto" required /><Select
          v-model="form.tipo_pago"
          name="tipo-pago"
          label="Tipo de pago"
          :options="[
            { label: 'Seleccione', value: '' },
            ...payments.map((x) => ({ label: x.nombre, value: String(x.id) })),
          ]"
        /><TextField
          v-if="isCheque"
          v-model="form.numero_cheque"
          label="Número de cheque"
          name="cheque"
          required
        /><TextField
          v-if="isCheque"
          v-model="form.banco"
          label="Banco"
          name="banco"
          required
        /><TextField
          v-model="form.pago_actual"
          label="Pago actual"
          name="pago"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </form>
      <template #footer
        ><Button variant="secondary" @click="receiptOpen = false">Volver</Button
        ><Button type="submit" form="receipt" :disabled="processing || !form.tipo_pago"
          >Emitir</Button
        ></template
      ></Modal
    ><ConfirmDialog
      :open="cancelOpen"
      title="Cancelar pedido"
      description="La cancelación se bloqueará si existen recibos emitidos. El backend realiza la reversa de stock."
      confirm-label="Cancelar pedido"
      danger
      @cancel="cancelOpen = false"
      @confirm="cancel"
    /><ConfirmDialog
      :open="noteOpen"
      title="Emitir nota de entrega"
      description="Se creará la única nota del pedido con la fecha actual de emisión."
      confirm-label="Emitir nota"
      @cancel="noteOpen = false"
      @confirm="note"
    />
  </div>
</template>
<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
dl,
.form {
  display: grid;
  gap: var(--space-4);
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  padding: 0.6rem 0;
}
dt {
  color: var(--color-text-secondary);
}
dd {
  margin: 0;
  font-weight: 700;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
.notice,
.error {
  padding: var(--space-3);
  border-radius: var(--radius-control);
}
.notice {
  background: var(--color-success-soft);
}
.error {
  color: var(--color-danger-text);
  background: var(--color-danger-soft);
}
@media (max-width: 767px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .actions > * {
    width: 100%;
  }
}
</style>
