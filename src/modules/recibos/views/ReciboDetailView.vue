<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Hash,
  Quote,
  Receipt,
  UserCheck,
  Wallet,
} from '@lucide/vue'
import type { Recibo, ValorCatalogoPublico } from '@/generated/api'
import DocumentViewerModal from '@/modules/proformas/components/DocumentViewerModal.vue'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { buildExportFilename } from '@/shared/download/exportFilename'
import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import { fechaComercial, formatearFechaHora } from '@/shared/date/presentacionFecha'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Toast from '@/shared/ui/Toast.vue'
import { recibosService } from '../services/recibosService'
import { tipoPagoIcon } from '../utils/tipoPagoIcon'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const item = ref<Recibo | null>(null)
const types = ref<ValorCatalogoPublico[]>([])
const loading = ref(true)
const processing = ref(false)
const downloading = ref(false)
const error = ref('')
const confirm = ref(false)
const notice = ref('')

const isAnnulled = computed(() => item.value?.estado === 'ANULADO')
const paymentTypeObj = computed(() =>
  item.value ? types.value.find((x) => x.id === item.value?.tipo_pago) : undefined,
)
const paymentTypeLabel = computed(() => {
  if (!item.value) return ''
  return (
    item.value.tipo_pago_nombre || paymentTypeObj.value?.nombre || `Tipo ${item.value.tipo_pago}`
  )
})
const paymentTypeIconComp = computed(() =>
  tipoPagoIcon(paymentTypeObj.value?.codigo, paymentTypeLabel.value),
)

const money = (v: string | number) => {
  const amount = Number(v)
  if (!Number.isFinite(amount)) return '—'
  const code = item.value?.moneda_codigo || 'BOB'
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: code }).format(amount)
}

const previewOpen = ref(false)
const {
  blob: pdfBlob,
  url: pdfUrl,
  loading: pdfLoading,
  error: pdfError,
  load: loadPdf,
  clear: clearPdf,
} = usePdfDocument(recibosService.documentPdf)

async function openPdfViewer() {
  if (!item.value) return
  previewOpen.value = true
  await loadPdf(item.value.id)
}

function closePdfViewer() {
  previewOpen.value = false
  clearPdf()
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return 'Fecha no disponible'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fechaComercial(value)
  return formatearFechaHora(value)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[item.value, types.value] = await Promise.all([
      recibosService.get(id),
      recibosService.paymentTypes(),
    ])
    if (route.query.accion === 'anular' && item.value?.estado === 'EMITIDO') {
      confirm.value = true
    }
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
    const file = previewOpen.value && pdfBlob.value ? pdfBlob.value : await loadPdf(id)
    if (!file) throw new Error(pdfError.value || 'No se pudo descargar el recibo.')
    downloadBlob(
      file,
      buildExportFilename(
        'recibo',
        [item.value.numero, item.value.nombre_completo, item.value.fecha],
        'pdf',
      ),
    )
    if (!previewOpen.value) clearPdf()
    notice.value = 'Recibo PDF descargado correctamente.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo descargar el recibo.'
  } finally {
    downloading.value = false
  }
}

async function annul() {
  processing.value = true
  error.value = ''
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
  <div class="receipt-detail">
    <Toast :visible="Boolean(notice)" :message="notice" tone="success" @close="notice = ''" />

    <div class="receipt-topline" aria-label="Ubicación en el proceso">
      <span>
        OPERACIONES <span class="receipt-divider">/</span> RECIBOS
        <span class="receipt-divider">/</span> RECIBO #{{ item?.numero ?? id }}
      </span>
      <div
        v-if="item"
        class="receipt-status-pill"
        :class="{ 'receipt-status-pill--danger': isAnnulled }"
      >
        <Ban v-if="isAnnulled" :size="14" aria-hidden="true" />
        <CheckCircle2 v-else :size="14" aria-hidden="true" />
        <span>{{ item.estado }}</span>
      </div>
    </div>

    <PageHeader
      :title="`Recibo #${item?.numero ?? id}`"
      description="Evidencia inmutable del cobro registrado sobre el pedido."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push('/recibos')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver
        </Button>
        <Button v-if="item" variant="secondary" @click="openPdfViewer">
          <FileText :size="17" aria-hidden="true" />
          Ver e imprimir PDF
        </Button>
        <Button v-if="item" variant="secondary" :processing="downloading" @click="downloadDocument">
          <Download :size="17" aria-hidden="true" />
          Descargar PDF
        </Button>
        <Button
          v-if="item && item.estado === 'EMITIDO'"
          variant="danger"
          :disabled="processing"
          @click="confirm = true"
        >
          <Ban :size="16" aria-hidden="true" />
          Anular recibo
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error && !item" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>

    <template v-else-if="item">
      <div v-if="error" role="alert" class="notice notice--error">{{ error }}</div>

      <div v-if="isAnnulled" class="annulled-banner">
        <Ban :size="18" aria-hidden="true" />
        <div>
          <strong>Recibo anulado</strong>
          <p>
            Este comprobante conserva su registro histórico para auditoría, pero su importe ya no
            computa en el saldo pagado del pedido.
          </p>
        </div>
      </div>

      <section class="summary" aria-label="Resumen financiero del recibo">
        <div class="stat">
          <span
            class="stat__icon"
            :class="isAnnulled ? 'stat__icon--danger' : 'stat__icon--success'"
          >
            <Receipt :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Pago recibido</span>
            <strong class="stat__value">{{ money(item.pago_actual) }}</strong>
            <div>
              <Badge :tone="isAnnulled ? 'danger' : 'success'">{{ item.estado }}</Badge>
            </div>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <FileText :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Total del pedido</span>
            <strong class="stat__value">{{ money(item.total) }}</strong>
            <small>Snapshot al emitir</small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <Wallet :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Acumulado a cuenta</span>
            <strong class="stat__value">{{ money(item.a_cuenta) }}</strong>
            <small>Pagado hasta este cobro</small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon stat__icon--warning">
            <Clock3 :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Saldo restante</span>
            <strong class="stat__value">{{ money(item.saldo) }}</strong>
            <small>Pendiente por cubrir</small>
          </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="receipt-data-title">
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <Receipt :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="receipt-data-title">Datos del comprobante y medio de pago</h2>
              <p>Detalle oficial del ingreso recibido y su vínculo comercial.</p>
            </div>
          </div>
        </div>

        <div class="receipt-fields-grid">
          <div class="receipt-field-card">
            <span class="receipt-field-card__icon">
              <UserCheck :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Recibido de</span>
              <strong class="receipt-field-card__value">{{ item.nombre_completo }}</strong>
            </div>
          </div>

          <div class="receipt-field-card">
            <span class="receipt-field-card__icon">
              <ClipboardList :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Pedido vinculado</span>
              <RouterLink :to="`/pedidos/${item.pedido}`" class="receipt-field-card__link">
                Pedido #{{ item.pedido }}
              </RouterLink>
            </div>
          </div>

          <div class="receipt-field-card">
            <span class="receipt-field-card__icon">
              <Calendar :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Fecha de emisión</span>
              <strong class="receipt-field-card__value">{{
                formatDateLabel(item.fecha_hora ?? item.fecha)
              }}</strong>
            </div>
          </div>

          <div class="receipt-field-card">
            <span class="receipt-field-card__icon">
              <component :is="paymentTypeIconComp" :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Tipo de pago</span>
              <strong class="receipt-field-card__value">{{ paymentTypeLabel }}</strong>
            </div>
          </div>

          <div v-if="item.banco" class="receipt-field-card">
            <span class="receipt-field-card__icon">
              <Building2 :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Banco emisor</span>
              <strong class="receipt-field-card__value">{{ item.banco }}</strong>
            </div>
          </div>

          <div v-if="item.numero_cheque" class="receipt-field-card">
            <span class="receipt-field-card__icon">
              <Hash :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Número de cheque</span>
              <strong class="receipt-field-card__value">{{ item.numero_cheque }}</strong>
            </div>
          </div>

          <div class="receipt-field-card receipt-field-card--full">
            <span class="receipt-field-card__icon">
              <FileText :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Concepto</span>
              <strong class="receipt-field-card__value">{{ item.concepto }}</strong>
            </div>
          </div>

          <div class="receipt-field-card receipt-field-card--full">
            <span class="receipt-field-card__icon">
              <Quote :size="17" aria-hidden="true" />
            </span>
            <div class="receipt-field-card__body">
              <span class="receipt-field-card__label">Monto en letras</span>
              <strong class="receipt-field-card__value">{{ item.monto_en_letras }}</strong>
            </div>
          </div>
        </div>
      </section>
    </template>

    <ConfirmDialog
      :open="confirm"
      title="Anular recibo"
      description="El recibo conservará su evidencia y cambiará a ANULADO. No se elimina."
      confirm-label="Anular"
      danger
      @close="confirm = false"
      @confirm="annul"
    />

    <DocumentViewerModal
      :open="previewOpen"
      :title="item ? `Recibo #${item.numero}` : 'Comprobante de recibo'"
      subtitle="Hoja carta con Copia Cliente y Copia HOMEX listas para impresión."
      :pdf-url="pdfUrl"
      :loading="pdfLoading"
      :error="pdfError"
      :downloading="downloading"
      :can-download-pdf="Boolean(item)"
      @close="closePdfViewer"
      @download="downloadDocument"
      @retry="openPdfViewer"
    />
  </div>
</template>

<style scoped>
.receipt-detail {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  padding-bottom: var(--space-8);
}
.receipt-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.receipt-divider {
  margin: 0 0.45rem;
  opacity: 0.5;
}
.receipt-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-border));
  background: var(--color-success-soft);
  color: var(--color-success);
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}
.receipt-status-pill--danger {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.notice {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  font-size: 0.9rem;
}
.notice--success {
  color: var(--color-success);
}
.notice--error {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.annulled-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  border-radius: var(--radius-card);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.annulled-banner svg {
  flex: none;
  margin-top: 0.1rem;
}
.annulled-banner p {
  margin: 0.2rem 0 0;
  font-size: 0.86rem;
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.stat,
.panel {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.stat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.stat__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.stat__icon--success {
  border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
  color: var(--color-success);
  background: var(--color-success-soft);
}
.stat__icon--warning {
  border-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.stat__icon--danger {
  border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.stat__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.stat__body > span {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.stat__body > small {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
}
.stat__value {
  font-size: 0.98rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.section-heading__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.section-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.section-heading h2 {
  margin: 0;
  font-size: 1.1rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
}
.receipt-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.receipt-field-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  min-width: 0;
}
.receipt-field-card--full {
  grid-column: 1 / -1;
}
.receipt-field-card__icon {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  flex: none;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}
.receipt-field-card__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.receipt-field-card__label {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.receipt-field-card__value {
  font-size: 0.9rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.receipt-field-card__link {
  color: var(--color-primary-accent);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}
.receipt-field-card__link:hover {
  text-decoration: underline;
}
@media (max-width: 64rem) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 38rem) {
  .summary,
  .receipt-fields-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
