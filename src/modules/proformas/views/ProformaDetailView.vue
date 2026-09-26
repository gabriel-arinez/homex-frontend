<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  Cliente,
  DetalleProforma,
  DetalleProformaWritable,
  Proforma,
  ValorCatalogoPublico,
} from '@/generated/api'
import { clientesService, nombreCliente } from '@/modules/clientes/services/clientesService'
import { ApiError } from '@/shared/api'
import { proformasService } from '../services/proformasService'
import AdjuntosDetalle from '../components/AdjuntosDetalle.vue'
import DetalleForm from '../components/DetalleForm.vue'
import EspecificacionForm from '../components/EspecificacionForm.vue'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  route = useRoute(),
  router = useRouter(),
  id = Number(route.params.id),
  quote = ref<Proforma | null>(null),
  loading = ref(true),
  error = ref(''),
  referenceError = ref(''),
  referenceLoading = ref(true),
  lineError = ref(''),
  specError = ref(''),
  success = ref(''),
  processing = ref(false),
  editingHeader = ref(false),
  lineModal = ref(false),
  specLine = ref<DetalleProforma | null>(null),
  editingLine = ref<DetalleProforma | null>(null),
  confirmAction = ref<'send' | 'approve' | null>(null),
  tipos = ref<ValorCatalogoPublico[]>([]),
  unidades = ref<ValorCatalogoPublico[]>([]),
  tiposMueble = ref<ValorCatalogoPublico[]>([]),
  monedas = ref<ValorCatalogoPublico[]>([]),
  clients = ref<Cliente[]>([])
const header = reactive({
  cliente: '',
  moneda: '',
  titulo: '',
  plazo_entrega: '',
  validez_oferta: '',
  porcentaje_adelanto: '',
  observaciones: '',
  prospecto_nombre: '',
  prospecto_empresa: '',
  prospecto_celular: '',
  prospecto_direccion: '',
})
const editable = computed(() => quote.value?.estado_info.codigo === 'BORRADOR'),
  sent = computed(() => quote.value?.estado_info.codigo === 'ENVIADA'),
  money = (v: string) =>
    new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: quote.value?.moneda_info.codigo || 'BOB',
    }).format(Number(v))
const conflict = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.status === 409
    ? `${e.message} Actualiza la proforma para continuar.`
    : e instanceof Error
      ? e.message
      : fallback
function fill() {
  if (!quote.value) return
  Object.assign(header, {
    cliente: String(quote.value.cliente ?? ''),
    moneda: String(quote.value.moneda),
    titulo: quote.value.titulo ?? '',
    plazo_entrega: quote.value.plazo_entrega ?? '',
    validez_oferta: String(quote.value.validez_oferta ?? ''),
    porcentaje_adelanto: quote.value.porcentaje_adelanto ?? '',
    observaciones: quote.value.observaciones ?? '',
    prospecto_nombre: quote.value.prospecto_nombre ?? '',
    prospecto_empresa: quote.value.prospecto_empresa ?? '',
    prospecto_celular: quote.value.prospecto_celular ?? '',
    prospecto_direccion: quote.value.prospecto_direccion ?? '',
  })
}
async function refreshQuote() {
  quote.value = await proformasService.get(id)
  fill()
  if (!editable.value) {
    editingHeader.value = false
    lineModal.value = false
    editingLine.value = null
    specLine.value = null
  }
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    await refreshQuote()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la proforma.'
  } finally {
    loading.value = false
  }
}
async function recoverConflict(e: unknown, fallback: string) {
  const message = conflict(e, fallback)
  if (e instanceof ApiError && e.status === 409) {
    try {
      await refreshQuote()
    } catch (reloadError) {
      return `${message} No se pudo refrescar el estado actual: ${
        reloadError instanceof Error ? reloadError.message : 'error desconocido'
      }`
    }
  }
  return message
}
async function saveHeader() {
  processing.value = true
  error.value = ''
  try {
    quote.value = await proformasService.update(id, {
      cliente: header.cliente ? Number(header.cliente) : null,
      moneda: Number(header.moneda),
      titulo: header.titulo || null,
      plazo_entrega: header.plazo_entrega || null,
      validez_oferta: header.validez_oferta ? Number(header.validez_oferta) : null,
      porcentaje_adelanto: header.porcentaje_adelanto || null,
      observaciones: header.observaciones || null,
      prospecto_nombre: header.prospecto_nombre || null,
      prospecto_empresa: header.prospecto_empresa || null,
      prospecto_celular: header.prospecto_celular || null,
      prospecto_direccion: header.prospecto_direccion || null,
    })
    editingHeader.value = false
    success.value = 'Datos comerciales actualizados.'
  } catch (e) {
    error.value = await recoverConflict(e, 'No se pudo actualizar.')
  } finally {
    processing.value = false
  }
}
async function saveLine(body: DetalleProformaWritable) {
  if (processing.value) return
  processing.value = true
  error.value = ''
  lineError.value = ''
  try {
    if (editingLine.value) await proformasService.updateDetail(editingLine.value.id, body)
    else await proformasService.addDetail(id, body)
    lineModal.value = false
    editingLine.value = null
    await load()
  } catch (e) {
    lineError.value = await recoverConflict(e, 'No se pudo guardar la línea.')
  } finally {
    processing.value = false
  }
}
async function saveSpec(body: Parameters<typeof proformasService.addSpec>[1]) {
  if (!specLine.value || processing.value) return
  processing.value = true
  specError.value = ''
  try {
    await proformasService.addSpec(specLine.value.id, body)
    specLine.value = null
    await load()
  } catch (e) {
    specError.value = await recoverConflict(e, 'No se pudo guardar la especificación.')
  } finally {
    processing.value = false
  }
}
async function transition() {
  if (!confirmAction.value) return
  processing.value = true
  error.value = ''
  const action = confirmAction.value
  confirmAction.value = null
  try {
    if (action === 'send') {
      quote.value = await proformasService.send(id)
      success.value = 'Proforma enviada. Sus datos quedaron congelados.'
    } else {
      const result = await proformasService.approve(id)
      success.value = `Proforma aprobada. Pedido #${result.pedido_id} confirmado.`
      await load()
    }
  } catch (e) {
    const message = conflict(e, 'No se pudo completar la transición.')
    await load()
    error.value = message
  } finally {
    processing.value = false
  }
}
function cancelHeader() {
  editingHeader.value = false
  fill()
}
function openEdit(line: DetalleProforma) {
  lineError.value = ''
  editingLine.value = line
  lineModal.value = true
}
function closeLine() {
  lineError.value = ''
  lineModal.value = false
  editingLine.value = null
}
async function loadReferences() {
  referenceLoading.value = true
  referenceError.value = ''
  try {
    const [a, b, c, d, e] = await Promise.all([
      proformasService.options('TIPO_ITEM'),
      proformasService.options('UNIDAD_MEDIDA'),
      proformasService.options('TIPO_MUEBLE'),
      proformasService.options('MONEDA'),
      clientesService.list({ activo: true, page_size: 20, page: 1 }),
    ])
    tipos.value = a
    unidades.value = b
    tiposMueble.value = c
    monedas.value = d
    clients.value = e.results
  } catch (e) {
    referenceError.value =
      e instanceof Error ? e.message : 'No se pudieron cargar los datos auxiliares.'
  } finally {
    referenceLoading.value = false
  }
}
onMounted(() => {
  void load()
  void loadReferences()
})
</script>
<template>
  <div>
    <PageHeader
      :title="quote ? `Proforma #${quote.numero}` : 'Proforma'"
      :description="quote?.titulo || 'Detalle comercial'"
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><Button variant="secondary" @click="router.push('/proformas')">Volver</Button
        ><Button
          v-if="quote && editable && !editingHeader"
          variant="secondary"
          :disabled="referenceLoading || Boolean(referenceError)"
          @click="editingHeader = true"
          >Editar cabecera</Button
        ><Button
          v-if="quote && editable"
          :disabled="!quote.detalles.length"
          @click="confirmAction = 'send'"
          >Enviar</Button
        ><Button v-if="quote && sent" :disabled="processing" @click="confirmAction = 'approve'"
          >Aprobar</Button
        ></template
      ></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="8" /><ErrorState
      v-else-if="error && !quote"
      :description="error"
      ><button @click="load">Reintentar</button></ErrorState
    ><template v-else-if="quote"
      ><p v-if="success" class="success" role="status">{{ success }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="referenceError" class="error reference-error" role="alert">
        {{ referenceError }}
        <button type="button" @click="loadReferences">Reintentar datos auxiliares</button>
      </p>
      <section class="summary" aria-label="Resumen de proforma">
        <div>
          <span>Estado</span><strong>{{ quote.estado_info.nombre }}</strong>
        </div>
        <div>
          <span>Cliente</span
          ><strong>{{
            quote.cliente_resumen?.nombre ||
            quote.cliente_resumen?.empresa ||
            quote.prospecto_nombre ||
            'Sin definir'
          }}</strong>
        </div>
        <div>
          <span>Moneda</span
          ><strong>{{ quote.moneda_info.nombre }} ({{ quote.moneda_info.codigo }})</strong>
        </div>
        <div>
          <span>Total</span><strong>{{ money(quote.total) }}</strong>
        </div>
      </section>
      <Card v-if="editingHeader"
        ><form class="header-form" :aria-busy="processing" @submit.prevent="saveHeader">
          <Select
            v-model="header.cliente"
            name="cliente-proforma"
            label="Cliente"
            :options="[
              { label: 'Prospecto', value: '' },
              ...clients.map((x) => ({ label: nombreCliente(x), value: String(x.id) })),
            ]"
          /><Select
            v-model="header.moneda"
            name="moneda-proforma"
            label="Moneda"
            :options="
              monedas.map((x) => ({ label: `${x.nombre} (${x.codigo})`, value: String(x.id) }))
            "
          /><TextField v-model="header.titulo" name="titulo-proforma" label="Título" />
          <div class="two">
            <TextField
              v-model="header.plazo_entrega"
              name="plazo-entrega"
              label="Plazo de entrega"
            /><TextField
              v-model="header.validez_oferta"
              name="validez"
              label="Validez (días)"
              type="number"
            />
          </div>
          <TextField
            v-model="header.porcentaje_adelanto"
            name="adelanto"
            label="Adelanto (%)"
            type="number"
          /><TextField
            v-model="header.observaciones"
            name="observaciones-proforma"
            label="Observaciones"
          /><template v-if="!header.cliente"
            ><h3>Datos del prospecto</h3>
            <div class="two">
              <TextField
                v-model="header.prospecto_nombre"
                name="prospecto-nombre"
                label="Nombre"
              /><TextField
                v-model="header.prospecto_empresa"
                name="prospecto-empresa"
                label="Empresa"
              /><TextField
                v-model="header.prospecto_celular"
                name="prospecto-celular"
                label="Celular"
              /><TextField
                v-model="header.prospecto_direccion"
                name="prospecto-direccion"
                label="Dirección"
              /></div
          ></template>
          <div class="actions">
            <Button type="submit" :processing="processing">Guardar cambios</Button
            ><Button variant="secondary" :disabled="processing" @click="cancelHeader"
              >Cancelar</Button
            >
          </div>
        </form></Card
      ><Card v-else
        ><dl class="facts">
          <div>
            <dt>Fecha</dt>
            <dd>{{ quote.fecha }}</dd>
          </div>
          <div>
            <dt>Plazo</dt>
            <dd>{{ quote.plazo_entrega || 'No definido' }}</dd>
          </div>
          <div>
            <dt>Validez</dt>
            <dd>{{ quote.validez_oferta ? `${quote.validez_oferta} días` : 'No definida' }}</dd>
          </div>
          <div>
            <dt>Adelanto</dt>
            <dd>
              {{ quote.porcentaje_adelanto ? `${quote.porcentaje_adelanto}%` : 'No definido' }}
            </dd>
          </div>
        </dl>
        <p v-if="!editable" class="freeze">
          Esta proforma está {{ quote.estado_info.nombre.toLowerCase() }}. Los datos comerciales y
          adjuntos están en modo lectura.
        </p></Card
      >
      <section class="lines">
        <div class="section-heading">
          <div>
            <h2>Líneas</h2>
            <p>Los importes y promociones mostrados son los devueltos por el backend.</p>
          </div>
          <Button
            v-if="editable"
            :disabled="referenceLoading || Boolean(referenceError)"
            @click="lineModal = true"
            >Agregar línea</Button
          >
        </div>
        <article v-for="line in quote.detalles" :key="line.id" class="line">
          <header>
            <div>
              <small>{{ line.tipo_item_info.nombre }} · {{ line.unidad_info.nombre }}</small>
              <h3>{{ line.nombre }}</h3>
            </div>
            <strong>{{ money(line.total) }}</strong>
          </header>
          <p>
            {{ line.cantidad }} ×
            <template v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'"
              >total negociado exacto {{ money(line.importe_negociado || line.total) }}</template
            ><template v-else>{{ money(line.precio_unitario ?? '0') }}</template>
          </p>
          <p v-if="line.precio_antes_snapshot" class="promotion">
            Promoción aplicada: antes {{ money(line.precio_antes_snapshot) }}, ahora
            {{ money(line.precio_ahora_snapshot || line.precio_unitario || '0') }} por unidad.
          </p>
          <div v-if="line.especificacion" class="spec-summary">
            <strong>{{ line.especificacion.tipo_mueble_info?.nombre || 'Mueble a medida' }}</strong
            ><span>{{ line.especificacion.color_principal || 'Sin color definido' }}</span>
          </div>
          <div v-if="editable" class="actions">
            <Button variant="secondary" @click="openEdit(line)">Editar línea</Button
            ><Button
              v-if="line.tipo_item_info.codigo === 'MUEBLE_MEDIDA' && !line.especificacion"
              variant="secondary"
              :disabled="referenceLoading || Boolean(referenceError)"
              @click="specLine = line"
              >Agregar especificación</Button
            >
          </div>
          <AdjuntosDetalle
            v-if="line.tipo_item_info.codigo === 'MUEBLE_MEDIDA'"
            :proforma-id="quote.id"
            :detalle-id="line.id"
            :editable
          />
        </article>
        <EmptyState
          v-if="!quote.detalles.length"
          title="Sin líneas"
          description="Agrega al menos una línea antes de enviar la proforma."
        />
      </section>
      <section class="totals">
        <div>
          <span>Subtotal</span><strong>{{ money(quote.subtotal) }}</strong>
        </div>
        <div>
          <span>Descuentos</span><strong>{{ money(quote.descuento_total) }}</strong>
        </div>
        <div>
          <span>Total</span><strong>{{ money(quote.total) }}</strong>
        </div>
      </section></template
    ><Modal
      :open="lineModal"
      :title="editingLine ? 'Editar línea' : 'Agregar línea'"
      @close="closeLine"
      ><DetalleForm
        :tipos
        :unidades
        :moneda="quote?.moneda_info.codigo || 'BOB'"
        :detail="editingLine || undefined"
        :processing="processing"
        :external-error="lineError"
        @save="saveLine"
        @cancel="closeLine" /></Modal
    ><Modal :open="Boolean(specLine)" title="Especificación del mueble" @close="specLine = null"
      ><EspecificacionForm
        :tipos="tiposMueble"
        :processing="processing"
        :external-error="specError"
        @save="saveSpec"
        @cancel="specLine = null" /></Modal
    ><ConfirmDialog
      :open="Boolean(confirmAction)"
      :title="confirmAction === 'approve' ? 'Aprobar proforma' : 'Enviar proforma'"
      :description="
        confirmAction === 'approve'
          ? 'Se confirmará el pedido y se descontará el stock disponible.'
          : 'La información quedará congelada y lista para aprobación.'
      "
      :confirm-label="confirmAction === 'approve' ? 'Aprobar' : 'Enviar'"
      @close="confirmAction = null"
      @confirm="transition"
    />
  </div>
</template>
<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}
.summary div,
.totals {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.summary span,
.summary strong {
  display: block;
}
.summary span,
dt,
.section-heading p {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.header-form {
  display: grid;
  gap: var(--space-4);
}
.two,
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
dd {
  margin: 0.25rem 0 0;
}
.freeze {
  padding: var(--space-3);
  border-left: 4px solid var(--color-primary);
  background: var(--color-primary-soft);
}
.section-heading,
.line header,
.actions,
.totals div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.section-heading {
  margin-top: var(--space-7);
}
.section-heading h2,
.section-heading p,
.line h3 {
  margin: 0;
}
.line {
  margin-top: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.promotion {
  padding: var(--space-2);
  color: var(--color-success);
  background: var(--color-success-soft);
}
.spec-summary {
  display: flex;
  gap: var(--space-3);
  margin-block: var(--space-3);
}
.totals {
  display: grid;
  gap: var(--space-2);
  max-width: 28rem;
  margin: var(--space-6) 0 0 auto;
}
.totals div:last-child {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  font-size: 1.2rem;
}
.success {
  color: var(--color-success);
}
.error,
[role='alert'] {
  color: var(--color-danger);
}
.reference-error button {
  margin-left: var(--space-2);
}
@media (max-width: 63.99rem) {
  .summary {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 35rem) {
  .summary,
  .two,
  .facts {
    grid-template-columns: 1fr;
  }
  .section-heading,
  .line header,
  .actions {
    align-items: stretch;
    flex-direction: column;
  }
  .actions :deep(button) {
    width: 100%;
  }
}
</style>
