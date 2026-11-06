<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, ClipboardCheck, Download, FileText, Pencil, Paperclip } from '@lucide/vue'
import type { DetalleProforma, Proforma } from '@/generated/api'
import { ApiError } from '@/shared/api'
import { downloadBlob } from '@/shared/download/downloadBlob'
import Button from '@/shared/ui/Button.vue'
import Badge from '@/shared/ui/Badge.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import AdjuntosDetalle from '../components/AdjuntosDetalle.vue'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'
import { useQuoteFurnitureCovers } from '../composables/useQuoteFurnitureCovers'
import Toast from '@/shared/ui/Toast.vue'
import { useQuoteProductImages } from '../composables/useQuoteProductImages'
import { proformasService } from '../services/proformasService'
import { retornoAProformas } from '../utils/navegacionProformas'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)
const quote = ref<Proforma | null>(null)
const { images: quoteImages, ensure: ensureQuoteImages } = useQuoteProductImages()
const { coverFor: furnitureCoverFor, ensureLines: ensureFurnitureCovers } =
  useQuoteFurnitureCovers()
function furnitureCoverSource(line: DetalleProforma) {
  const cover = furnitureCoverFor(line, quote.value?.id)
  return cover?.variantes?.['320'] ?? cover?.url ?? ''
}
const loading = ref(true)
const processing = ref(false)
const downloading = ref(false)
const error = ref('')
const success = ref('')
const downloadNotice = ref('')
const lastPedidoId = ref<number | null>(null)
const confirmAction = ref<'approve' | 'not-completed' | 'reopen' | null>(null)
const listPath = computed(() => retornoAProformas(route.query.returnTo))
const stateCode = computed(() => quote.value?.estado_info.codigo ?? '')
const editable = computed(() => ['BORRADOR', 'EN_REVISION'].includes(stateCode.value))
const inReview = computed(() => ['EN_REVISION', 'ENVIADA'].includes(stateCode.value))
const canApprove = computed(
  () =>
    inReview.value &&
    Boolean(quote.value?.cliente) &&
    Boolean(quote.value?.detalles.length) &&
    Number(quote.value?.total ?? 0) > 0,
)
const approvalIssue = computed(() => {
  if (!inReview.value || canApprove.value) return ''
  if (!quote.value?.cliente) return 'Para aprobar se requiere un cliente registrado.'
  if (!quote.value?.detalles.length) return 'Para aprobar se necesita al menos un producto.'
  return 'La proforma debe tener un importe positivo para aprobarse.'
})
const tone = computed<'neutral' | 'success' | 'warning' | 'danger' | 'info'>(() => {
  if (stateCode.value === 'APROBADA') return 'success'
  if (stateCode.value === 'EN_REVISION') return 'warning'
  if (stateCode.value === 'ENVIADA') return 'info'
  if (stateCode.value === 'NO_CONCRETADA') return 'danger'
  return 'neutral'
})
const money = (value: string | number) => {
  const code = quote.value?.moneda_info.codigo || 'BOB'
  try {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: code }).format(
      Number(value),
    )
  } catch {
    return `${code} ${Number(value).toFixed(2)}`
  }
}
function resumenEspecificacion(line: DetalleProforma) {
  const datos = (line.especificacion?.datos_tecnicos ?? {}) as Record<string, unknown>
  const componentes = Array.isArray(datos.componentes) ? datos.componentes : []
  return componentes.length
    ? `${componentes.length} componente${componentes.length === 1 ? '' : 's'}`
    : 'Ficha técnica registrada'
}
function fechaCalendario(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha
  return new Intl.DateTimeFormat('es-BO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${fecha}T12:00:00Z`))
}
async function refreshQuote() {
  quote.value = await proformasService.get(id)
  void ensureQuoteImages(
    quote.value.detalles.flatMap((line) => (line.producto ? [line.producto] : [])),
  )
  void ensureFurnitureCovers(quote.value.detalles, quote.value.id)
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    await refreshQuote()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la proforma.'
  } finally {
    loading.value = false
  }
}
function edit() {
  if (!quote.value || !editable.value) return
  void router.push({
    path: `/proformas/${quote.value.id}/editar`,
    query: listPath.value === '/proformas' ? {} : { returnTo: listPath.value },
  })
}
async function transition() {
  const action = confirmAction.value
  if (!action || processing.value || !quote.value) return
  confirmAction.value = null
  processing.value = true
  error.value = ''
  success.value = ''
  try {
    if (action === 'approve') {
      if (!canApprove.value) return
      const result = await proformasService.approve(id)
      lastPedidoId.value = result.pedido_id
      success.value = `Proforma aprobada. Pedido #${result.pedido_id} confirmado.`
    } else if (action === 'not-completed') {
      await proformasService.markNotCompleted(id)
      success.value = 'Proforma marcada como no concretada.'
    } else {
      await proformasService.reopen(id)
      success.value = 'Proforma reabierta en revisión.'
    }
    await refreshQuote()
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'No se pudo completar la acción.'
    error.value =
      cause instanceof ApiError && cause.status === 409
        ? `${message} Se actualizará el estado para que puedas revisar la proforma.`
        : message
    try {
      await refreshQuote()
    } catch {
      error.value += ' No se pudo consultar el estado actualizado.'
    }
  } finally {
    processing.value = false
  }
}
async function downloadDocument() {
  if (!quote.value || downloading.value) return
  downloading.value = true
  error.value = ''
  try {
    const blob = await proformasService.documentPdf(id)
    const prefix = stateCode.value === 'BORRADOR' ? 'proforma-borrador' : 'proforma'
    downloadBlob(blob, `${prefix}-${quote.value.numero}.pdf`)
    downloadNotice.value = 'Documento descargado correctamente.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo descargar el documento.'
  } finally {
    downloading.value = false
  }
}
onMounted(() => void load())
</script>

<template>
  <div class="proforma-detail">
    <Toast
      :visible="Boolean(downloadNotice)"
      :message="downloadNotice"
      tone="success"
      @close="downloadNotice = ''"
    />
    <PageHeader
      :title="quote ? `Proforma #${quote.numero}` : 'Proforma'"
      :description="quote?.titulo || 'Resumen comercial y seguimiento'"
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push(listPath)">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver a proformas
        </Button>
        <Button
          v-if="quote"
          variant="secondary"
          :processing="downloading"
          @click="downloadDocument"
        >
          <Download :size="17" aria-hidden="true" />
          {{ stateCode === 'BORRADOR' ? 'Descargar borrador (PDF)' : 'Descargar PDF' }}
        </Button>
        <Button v-if="editable" variant="secondary" :disabled="processing" @click="edit">
          <Pencil :size="17" aria-hidden="true" /> Continuar edición
        </Button>
        <Button
          v-if="inReview"
          variant="success"
          :disabled="processing || !canApprove"
          @click="confirmAction = 'approve'"
        >
          <Check :size="17" aria-hidden="true" />
          Aprobar y crear pedido
        </Button>
        <Button
          v-if="inReview"
          variant="secondary"
          :disabled="processing"
          @click="confirmAction = 'not-completed'"
          >Marcar no concretada</Button
        >
        <Button
          v-if="stateCode === 'NO_CONCRETADA'"
          :disabled="processing"
          @click="confirmAction = 'reopen'"
          >Reabrir en revisión</Button
        >
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error && !quote" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <template v-else-if="quote">
      <div
        v-if="route.query.enviada === '1' && inReview && !success"
        class="notice notice--success"
        role="status"
      >
        Proforma enviada correctamente a revisión. Puedes consultar sus documentos y, cuando
        corresponda, aprobar para crear el pedido.
      </div>
      <div v-if="success" class="notice notice--success" role="status">
        {{ success }}
        <RouterLink v-if="lastPedidoId" :to="`/pedidos/${lastPedidoId}`"
          >Consultar pedido #{{ lastPedidoId }}</RouterLink
        >
      </div>
      <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>
      <div v-if="approvalIssue" class="notice" role="status">{{ approvalIssue }}</div>
      <div v-if="stateCode === 'BORRADOR'" class="notice">
        Esta cotización aún es un borrador. El PDF es preliminar. Completa los datos y utiliza
        <strong>Enviar a revisión</strong> desde el editor antes de aprobar.
      </div>

      <section class="summary" aria-label="Estado y valores de la proforma">
        <div class="stat">
          <span>Estado comercial</span>
          <Badge :tone="tone">{{ quote.estado_info.nombre }}</Badge>
        </div>
        <div class="stat">
          <span>Cliente</span>
          <strong>{{
            quote.cliente_resumen?.nombre ||
            quote.cliente_resumen?.empresa ||
            quote.prospecto_nombre ||
            'Sin definir'
          }}</strong>
        </div>
        <div class="stat">
          <span>Moneda</span>
          <strong>{{ quote.moneda_info.nombre }} ({{ quote.moneda_info.codigo }})</strong>
        </div>
        <div class="stat">
          <span>Total</span>
          <strong class="main-amount">{{ money(quote.total) }}</strong>
        </div>
      </section>

      <section class="panel" aria-labelledby="conditions-title">
        <div class="section-heading">
          <div>
            <h2 id="conditions-title">
              <FileText :size="20" aria-hidden="true" /> Información comercial
            </h2>
            <p>Datos guardados en HOMEX. Para modificarlos, utiliza el editor de proformas.</p>
          </div>
        </div>
        <dl class="facts">
          <div>
            <dt>Fecha</dt>
            <dd>{{ fechaCalendario(quote.fecha) }}</dd>
          </div>
          <div>
            <dt>Plazo de entrega</dt>
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
          <div v-if="quote.observaciones" class="wide">
            <dt>Observaciones</dt>
            <dd>{{ quote.observaciones }}</dd>
          </div>
        </dl>
      </section>

      <section class="lines" aria-labelledby="lines-title">
        <div class="section-heading">
          <div>
            <h2 id="lines-title">
              <ClipboardCheck :size="20" aria-hidden="true" /> Productos y especificaciones
            </h2>
            <p>Importes guardados y calculados por el servidor.</p>
          </div>
          <span class="counter"
            >{{ quote.detalles.length }} {{ quote.detalles.length === 1 ? 'ítem' : 'ítems' }}</span
          >
        </div>
        <article v-for="(line, index) in quote.detalles" :key="line.id" class="line">
          <div class="line-main">
            <div class="line-identity">
              <div v-if="line.producto" class="line-thumbnail">
                <ProductImage
                  :image="quoteImages[line.producto] ?? null"
                  :alt="line.nombre"
                  sizes="64px"
                />
              </div>
              <div v-else-if="furnitureCoverSource(line)" class="line-thumbnail">
                <GalleryPhoto
                  :src="furnitureCoverSource(line)"
                  :alt="'Imagen principal de ' + line.nombre"
                />
              </div>
              <div>
                <small
                  >{{ String(index + 1).padStart(2, '0') }} · {{ line.tipo_item_info.nombre }} ·
                  {{ line.unidad_info.nombre }}</small
                >
                <h3>{{ line.nombre }}</h3>
                <p v-if="line.descripcion">{{ line.descripcion }}</p>
                <p class="secondary">
                  {{ line.cantidad }} ×
                  {{
                    line.modo_calculo === 'TOTAL_NEGOCIADO'
                      ? 'total negociado'
                      : money(line.precio_unitario ?? '0')
                  }}
                </p>
                <p v-if="line.especificacion" class="secondary">
                  {{ line.especificacion.tipo_mueble_info?.nombre || 'Mueble a medida' }} ·
                  {{ resumenEspecificacion(line) }}
                </p>
                <p v-if="line.familia_producto && !line.producto" class="secondary">
                  Variante pendiente de selección antes de aprobar.
                </p>
              </div>
            </div>
            <strong>{{ money(line.total) }}</strong>
          </div>
          <div class="media">
            <h4>
              <Paperclip :size="16" aria-hidden="true" />
              {{ line.producto ? 'Archivos adjuntos' : 'Imágenes de referencia' }}
            </h4>
            <p>Adjuntos asociados a esta línea y conservados en el servidor.</p>
            <AdjuntosDetalle :proforma-id="quote.id" :detalle-id="line.id" :editable="editable" />
          </div>
        </article>
        <EmptyState
          v-if="!quote.detalles.length"
          title="Sin productos"
          description="Esta proforma todavía no tiene líneas. Continúa su edición para agregarlas."
        />
      </section>

      <section class="totals" aria-label="Totales de la proforma">
        <div>
          <span>Subtotal</span><strong>{{ money(quote.subtotal) }}</strong>
        </div>
        <div>
          <span>Descuentos</span><strong>{{ money(quote.descuento_total) }}</strong>
        </div>
        <div>
          <strong>Total comercial</strong><strong>{{ money(quote.total) }}</strong>
        </div>
      </section>

      <div v-if="editable" class="resume-editing">
        <p>
          ¿Necesitas corregir productos, cliente o condiciones? Todos los cambios comerciales se
          realizan desde el editor.
        </p>
        <Button variant="secondary" @click="edit"
          ><Pencil :size="17" aria-hidden="true" /> Abrir editor</Button
        >
      </div>
    </template>

    <ConfirmDialog
      :open="Boolean(confirmAction)"
      :variant="confirmAction === 'approve' ? 'success' : confirmAction === 'not-completed' ? 'danger' : 'info'"
      :title="
        confirmAction === 'approve'
          ? 'Aprobar y crear pedido'
          : confirmAction === 'not-completed'
            ? 'Marcar como no concretada'
            : 'Reabrir en revisión'
      "
      :description="
        confirmAction === 'approve'
          ? 'Esta acción confirmará el pedido y aplicará los movimientos de inventario correspondientes. No se podrá deshacer desde la proforma.'
          : confirmAction === 'not-completed'
            ? 'La cotización quedará registrada como no concretada y podrá reabrirse posteriormente.'
            : 'La proforma volverá a EN REVISIÓN y podrá corregirse antes de aprobarla.'
      "
      :confirm-label="confirmAction === 'approve' ? 'Aprobar y crear pedido' : 'Confirmar'"
      @close="confirmAction = null"
      @confirm="transition"
    />
  </div>
</template>

<style scoped>
.proforma-detail {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.stat,
.panel,
.line,
.totals,
.resume-editing {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.stat {
  display: grid;
  gap: var(--space-2);
  align-content: start;
}
.stat span,
.facts dt,
.section-heading p,
.line small,
.secondary,
.media > p,
.resume-editing p {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.stat strong,
.line strong,
.totals strong {
  overflow-wrap: anywhere;
}
.main-amount {
  font-size: 1.15rem;
}
.notice {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  font-size: 0.9rem;
}
.notice--error {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.notice--success {
  color: var(--color-success);
}
.notice a {
  display: inline-block;
  margin-left: var(--space-3);
  color: inherit;
  font-weight: 700;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.section-heading h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 1.12rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
}
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
}
.facts dt {
  margin-bottom: var(--space-1);
}
.facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.facts .wide {
  grid-column: 1 / -1;
}
.lines {
  min-width: 0;
}
.counter {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.line {
  margin-bottom: var(--space-3);
}
.line-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}
.line-main > div {
  min-width: 0;
}
.line-main h3 {
  margin: var(--space-1) 0;
  font-size: 1rem;
}
.line-main p {
  margin: var(--space-2) 0 0;
  overflow-wrap: anywhere;
}
.line-main > strong {
  text-align: right;
  white-space: nowrap;
}
.media {
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
}
.media h4 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 0.9rem;
}
.media > p {
  margin: var(--space-1) 0;
}
.totals {
  display: grid;
  gap: var(--space-2);
  width: min(100%, 26rem);
  margin-left: auto;
}
.totals > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}
.totals > div:last-child {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  font-size: 1.1rem;
}
.resume-editing {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: center;
  flex-wrap: wrap;
}
.resume-editing p {
  margin: 0;
}
@media (max-width: 64rem) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 38rem) {
  .summary,
  .facts {
    grid-template-columns: minmax(0, 1fr);
  }
  .line-main {
    flex-direction: column;
    gap: var(--space-2);
  }
  .line-main > strong {
    text-align: left;
  }
  .notice a {
    display: block;
    margin: var(--space-2) 0 0;
  }
}
.line-identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-width: 0;
}
.line-identity > div:last-child {
  min-width: 0;
}
.line-thumbnail {
  width: 4rem;
  height: 4rem;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.line-thumbnail :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.line-thumbnail :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.line-thumbnail :deep(.fallback span) {
  display: none;
}
</style>
