<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Coins,
  FileCheck2,
  FileText,
  Hammer,
  Hash,
  Landmark,
  PackageCheck,
  Quote,
  Receipt,
  RotateCcw,
  Send,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  UserCheck,
  Wallet,
  X,
} from '@lucide/vue'
import type {
  EstadoCodigoEnum,
  NotaEntrega,
  Pedido,
  Proforma,
  Recibo,
  ValorCatalogoPublico,
} from '@/generated/api'
import { notasEntregaService } from '@/modules/notas-entrega/services/notasEntregaService'
import DocumentViewerModal from '@/modules/proformas/components/DocumentViewerModal.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { recibosService } from '@/modules/recibos/services/recibosService'
import { montoEnLetras } from '@/modules/recibos/utils/montoEnLetras'
import { tipoPagoIcon } from '@/modules/recibos/utils/tipoPagoIcon'
import { ApiError } from '@/shared/api'
import { fechaComercial, formatearFechaHora } from '@/shared/date/presentacionFecha'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import { generateUuidV4 } from '@/shared/utils/uuid'
import { pedidosService } from '../services/pedidosService'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import Toast from '@/shared/ui/Toast.vue'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()

const pedidoId = computed(() => Number(route.params.id))
const pedido = ref<Pedido | null>(null)
const quote = ref<Proforma | null>(null)
const receipts = ref<Recibo[]>([])
const deliveryNotes = ref<NotaEntrega[]>([])
const docsLoading = ref(false)
const states = ref<ValorCatalogoPublico[]>([])
const payments = ref<ValorCatalogoPublico[]>([])
const loading = ref(true)
const processing = ref(false)
const error = ref('')
const notice = ref('')
const receiptOpen = ref(false)
const cancelOpen = ref(false)
const noteOpen = ref(false)
const stateMenuOpen = ref(false)
const stateMenuContainer = ref<HTMLElement | null>(null)
let loadRequestId = 0

const receiptError = ref('')
const receiptIdempotencyKey = ref('')
const montoEnLetrasManual = ref(false)

const pdfPreviewOpen = ref(false)
const pdfPreviewRecibo = ref<Recibo | null>(null)
const downloadingReceiptPdf = ref(false)
const {
  blob: receiptPdfBlob,
  url: receiptPdfUrl,
  loading: receiptPdfLoading,
  error: receiptPdfError,
  load: loadReceiptPdf,
  clear: clearReceiptPdf,
} = usePdfDocument(recibosService.documentPdf)

function paymentInfo(id: number): ValorCatalogoPublico | undefined {
  return payments.value.find((item) => item.id === id)
}

function receiptPaymentName(rec: Recibo): string {
  return rec.tipo_pago_nombre || paymentInfo(rec.tipo_pago)?.nombre || `Tipo #${rec.tipo_pago}`
}

function receiptPaymentIcon(rec: Recibo) {
  const info = paymentInfo(rec.tipo_pago)
  return tipoPagoIcon(info?.codigo, rec.tipo_pago_nombre || info?.nombre)
}

async function openReceiptPdfPreview(rec: Recibo) {
  pdfPreviewRecibo.value = rec
  pdfPreviewOpen.value = true
  await loadReceiptPdf(rec.id)
}

function closeReceiptPdfPreview() {
  pdfPreviewOpen.value = false
  pdfPreviewRecibo.value = null
  clearReceiptPdf()
}

async function downloadReceiptPdf() {
  if (!pdfPreviewRecibo.value || downloadingReceiptPdf.value) return
  downloadingReceiptPdf.value = true
  try {
    const file = receiptPdfBlob.value ?? (await loadReceiptPdf(pdfPreviewRecibo.value.id))
    if (!file) throw new Error(receiptPdfError.value || 'No se pudo descargar el recibo.')
    downloadBlob(file, `recibo-${pdfPreviewRecibo.value.numero}.pdf`)
    notice.value = `Recibo #${pdfPreviewRecibo.value.numero} descargado en PDF.`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo descargar el recibo.'
  } finally {
    downloadingReceiptPdf.value = false
  }
}

const form = ref({
  nombre_completo: '',
  monto_en_letras: '',
  concepto: '',
  tipo_pago: '',
  numero_cheque: '',
  banco: '',
  pago_actual: '',
})

const orderCurrency = computed(() => quote.value?.moneda_info?.codigo ?? 'BOB')
const orderTotal = computed(() => Number(quote.value?.total ?? 0))
const emittedReceiptsCount = computed(
  () => receipts.value.filter((r) => r.estado === 'EMITIDO').length,
)
const orderPaid = computed(() =>
  receipts.value
    .filter((r) => r.estado === 'EMITIDO')
    .reduce((sum, r) => sum + (Number(r.pago_actual) || 0), 0),
)
const orderRemaining = computed(() => Math.max(0, orderTotal.value - orderPaid.value))
const selectedPaymentType = computed(() =>
  payments.value.find((x) => String(x.id) === form.value.tipo_pago),
)
const selectedPaymentIcon = computed(() =>
  tipoPagoIcon(selectedPaymentType.value?.codigo, selectedPaymentType.value?.nombre),
)
function restoreAutoMontoEnLetras() {
  montoEnLetrasManual.value = false
  form.value.monto_en_letras = montoEnLetras(form.value.pago_actual, orderCurrency.value)
}
const currentPayAmount = computed(() => {
  const n = Number(String(form.value.pago_actual).replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
})
const validPayAmount = computed(() =>
  Number.isFinite(currentPayAmount.value) && currentPayAmount.value > 0
    ? currentPayAmount.value
    : 0,
)
const projectedAccumulated = computed(() => orderPaid.value + validPayAmount.value)
const projectedRemaining = computed(() => orderRemaining.value - validPayAmount.value)
const receiptAmountError = computed(() => {
  if (!form.value.pago_actual.trim()) return ''
  if (!Number.isFinite(currentPayAmount.value) || currentPayAmount.value <= 0) {
    return 'El importe debe ser mayor a cero.'
  }
  if (currentPayAmount.value > orderRemaining.value + 0.0001) {
    return `El importe supera el saldo pendiente (${money(orderRemaining.value, orderCurrency.value)}).`
  }
  return ''
})
const receiptFormValid = computed(
  () =>
    !receiptAmountError.value &&
    validPayAmount.value > 0 &&
    Boolean(form.value.tipo_pago) &&
    Boolean(form.value.nombre_completo.trim()) &&
    Boolean(form.value.monto_en_letras.trim()) &&
    Boolean(form.value.concepto.trim()) &&
    (!isCheque.value ||
      (Boolean(form.value.numero_cheque.trim()) && Boolean(form.value.banco.trim()))),
)

watch(
  () => form.value.pago_actual,
  (val) => {
    if (!montoEnLetrasManual.value) {
      form.value.monto_en_letras = montoEnLetras(val, orderCurrency.value)
    }
  },
)

watch(orderCurrency, (currency) => {
  if (!montoEnLetrasManual.value && form.value.pago_actual.trim()) {
    form.value.monto_en_letras = montoEnLetras(form.value.pago_actual, currency)
  }
})

watch(
  () => quote.value,
  (q) => {
    if (receiptOpen.value && !form.value.nombre_completo.trim() && q?.cliente_resumen?.nombre) {
      form.value.nombre_completo = q.cliente_resumen.nombre
    }
  },
)

const workflowSteps = [
  {
    codigo: 'CONFIRMADO',
    label: 'Confirmado',
    icon: ClipboardCheck,
  },
  {
    codigo: 'EN_PRODUCCION',
    label: 'En producción',
    icon: Hammer,
  },
  {
    codigo: 'LISTO_ENTREGA',
    label: 'Listo para entrega',
    icon: PackageCheck,
  },
  {
    codigo: 'ENTREGADO',
    label: 'Entregado',
    icon: Truck,
  },
] as const

const current = computed(() => states.value.find((x) => x.id === pedido.value?.estado))
const currentCode = computed(() => current.value?.codigo ?? '')
const isCancelled = computed(() => currentCode.value === 'CANCELADO')
const isCheque = computed(
  () => payments.value.find((x) => String(x.id) === form.value.tipo_pago)?.codigo === 'CHEQUE',
)
const stateName = computed(
  () => current.value?.nombre ?? (pedido.value ? `Estado ${pedido.value.estado}` : ''),
)

const currentStepIndex = computed(() =>
  workflowSteps.findIndex((step) => step.codigo === currentCode.value),
)

const nextLogicalStep = computed(() => {
  if (isCancelled.value) return null
  const idx = currentStepIndex.value
  if (idx >= 0 && idx < workflowSteps.length - 1) return workflowSteps[idx + 1] ?? null
  return null
})

const alternativeTransitions = computed(() => {
  if (isCancelled.value) return []
  const allowedCodes: EstadoCodigoEnum[] = ['EN_PRODUCCION', 'LISTO_ENTREGA', 'ENTREGADO']
  return workflowSteps.filter(
    (step) =>
      allowedCodes.includes(step.codigo as EstadoCodigoEnum) &&
      step.codigo !== currentCode.value &&
      step.codigo !== nextLogicalStep.value?.codigo,
  )
})

const cancelledMessage =
  'Este pedido fue cancelado y las existencias descontadas fueron restituidas al inventario mediante reversa.'

function stepLabel(step: (typeof workflowSteps)[number]) {
  const fromCatalog = states.value.find((s) => s.codigo === step.codigo)?.nombre
  return fromCatalog ?? step.label
}

function money(value: string | number, code = 'BOB') {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  try {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

async function loadRelatedDocuments(currentPedido: Pedido, currentRequest: number) {
  docsLoading.value = true
  try {
    const [proformaRes, recibosRes, notasRes] = await Promise.allSettled([
      proformasService.get(currentPedido.proforma),
      recibosService.list(),
      notasEntregaService.list(),
    ])
    if (currentRequest !== loadRequestId) return
    quote.value = proformaRes.status === 'fulfilled' ? proformaRes.value : null
    receipts.value =
      recibosRes.status === 'fulfilled'
        ? recibosRes.value.filter((item) => item.pedido === currentPedido.id)
        : []
    deliveryNotes.value =
      notasRes.status === 'fulfilled'
        ? notasRes.value.filter((item) => item.pedido === currentPedido.id)
        : []
  } finally {
    if (currentRequest === loadRequestId) docsLoading.value = false
  }
}

function openReceiptModal() {
  const clientName = quote.value?.cliente_resumen?.nombre || ''
  form.value = {
    nombre_completo: clientName,
    monto_en_letras: '',
    concepto: `Abono por Pedido #${pedidoId.value}`,
    tipo_pago: '',
    numero_cheque: '',
    banco: '',
    pago_actual: '',
  }
  montoEnLetrasManual.value = false
  receiptError.value = ''
  receiptIdempotencyKey.value = generateUuidV4()
  receiptOpen.value = true
}

function applyActionQuery() {
  const accion = typeof route.query.accion === 'string' ? route.query.accion : ''
  if (!accion || !pedido.value) return
  if (accion === 'recibo' && currentCode.value === 'CONFIRMADO') openReceiptModal()
  if (accion === 'nota' && currentCode.value === 'LISTO_ENTREGA') noteOpen.value = true
  if (accion === 'cancelar' && !['CANCELADO', 'ENTREGADO'].includes(currentCode.value)) {
    cancelOpen.value = true
  }
}

async function load() {
  const currentRequest = ++loadRequestId
  const id = pedidoId.value
  loading.value = true
  error.value = ''
  stateMenuOpen.value = false
  quote.value = null
  receipts.value = []
  deliveryNotes.value = []
  try {
    const [orderRes, statesRes, paymentsRes] = await Promise.all([
      pedidosService.get(id),
      pedidosService.options('ESTADO_PEDIDO'),
      pedidosService.options('TIPO_PAGO'),
    ])
    if (currentRequest !== loadRequestId) return
    pedido.value = orderRes
    states.value = statesRes
    payments.value = paymentsRes
    applyActionQuery()
    await loadRelatedDocuments(orderRes, currentRequest)
  } catch (e) {
    if (currentRequest !== loadRequestId) return
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el pedido.'
  } finally {
    if (currentRequest === loadRequestId) loading.value = false
  }
}

async function action(fn: () => Promise<unknown>, message: string) {
  processing.value = true
  error.value = ''
  notice.value = ''
  try {
    await fn()
    await load()
    notice.value = message
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'La operación no pudo completarse.'
    await load()
    error.value = msg
  } finally {
    processing.value = false
  }
}

function advanceTo(codigo: EstadoCodigoEnum) {
  stateMenuOpen.value = false
  return action(
    () => pedidosService.changeState(pedidoId.value, { estado_codigo: codigo }),
    'Estado actualizado.',
  )
}

const cancel = () =>
  action(
    () => pedidosService.cancel(pedidoId.value),
    'Pedido cancelado y stock devuelto al inventario.',
  ).finally(() => (cancelOpen.value = false))

const note = () =>
  action(() => pedidosService.emitDeliveryNote(pedidoId.value), 'Nota de entrega emitida.').finally(
    () => (noteOpen.value = false),
  )

async function receipt() {
  if (processing.value) return
  if (receiptAmountError.value || !receiptFormValid.value) {
    receiptError.value =
      receiptAmountError.value || 'Completa todos los campos obligatorios con un importe válido.'
    return
  }
  processing.value = true
  receiptError.value = ''
  notice.value = ''
  try {
    await pedidosService.emitReceipt(
      pedidoId.value,
      {
        nombre_completo: form.value.nombre_completo.trim(),
        monto_en_letras: form.value.monto_en_letras.trim(),
        concepto: form.value.concepto.trim(),
        tipo_pago: Number(form.value.tipo_pago),
        numero_cheque: isCheque.value ? form.value.numero_cheque.trim() : null,
        banco: isCheque.value ? form.value.banco.trim() : null,
        pago_actual: form.value.pago_actual.trim(),
      },
      receiptIdempotencyKey.value,
    )
    receiptOpen.value = false
    await load()
    notice.value = 'Recibo emitido.'
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      receiptIdempotencyKey.value = generateUuidV4()
    }
    receiptError.value =
      err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'No pudimos emitir el recibo.'
  } finally {
    processing.value = false
  }
}

function handleOutsideClick(event: Event) {
  if (!stateMenuOpen.value) return
  const target = event.target
  if (target instanceof Node && !stateMenuContainer.value?.contains(target)) {
    stateMenuOpen.value = false
  }
}

function handleEscape(event: KeyboardEvent) {
  if (stateMenuOpen.value && event.key === 'Escape') {
    stateMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick)
  document.addEventListener('keydown', handleEscape)
  void load()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsideClick)
  document.removeEventListener('keydown', handleEscape)
})

watch(() => route.params.id, load)
</script>

<template>
  <div class="order-detail">
    <Toast :visible="Boolean(notice)" :message="notice" tone="success" @close="notice = ''" />

    <div class="order-topline" aria-label="Ubicación en el proceso">
      <span>
        OPERACIONES <span class="order-divider">/</span> PEDIDOS
        <span class="order-divider">/</span> PEDIDO #{{ pedidoId }}
      </span>
      <div
        v-if="pedido"
        class="order-status-pill"
        :class="{ 'order-status-pill--danger': isCancelled }"
      >
        <Ban v-if="isCancelled" :size="14" aria-hidden="true" />
        <CheckCircle2 v-else :size="14" aria-hidden="true" />
        <span>{{ stateName }}</span>
      </div>
    </div>

    <PageHeader
      :title="`Pedido #${pedidoId}`"
      description="Seguimiento operativo, cobros y entrega del pedido."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push('/pedidos')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver a pedidos
        </Button>
        <Button
          v-if="pedido && !['CANCELADO', 'ENTREGADO'].includes(currentCode)"
          variant="danger"
          :disabled="processing"
          @click="cancelOpen = true"
        >
          <Ban :size="16" aria-hidden="true" /> Cancelar pedido
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error && !pedido" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>

    <template v-else-if="pedido">
      <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>

      <section class="summary" aria-label="Resumen del pedido">
        <div class="stat">
          <span class="stat__icon">
            <Calendar :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Fecha de confirmación</span>
            <strong class="stat__value">{{ formatearFechaHora(pedido.fecha_confirmacion) }}</strong>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <FileText :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Proforma vinculada</span>
            <div class="stat__proforma">
              <RouterLink :to="`/proformas/${pedido.proforma}`" class="stat__link">
                Proforma #{{ pedido.proforma }}
              </RouterLink>
              <small v-if="quote">
                {{ quote.cliente_resumen?.nombre || 'Cliente registrado' }} ·
                {{ money(quote.total, quote.moneda_info.codigo) }}
              </small>
            </div>
          </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="order-progress-title">
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <SlidersHorizontal :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="order-progress-title">Progreso del pedido</h2>
              <p>Seguimiento de etapas desde la confirmación hasta la entrega.</p>
            </div>
          </div>

          <div v-if="nextLogicalStep" ref="stateMenuContainer" class="split-action">
            <Button
              variant="primary"
              class="split-action__main"
              :disabled="processing"
              @click="advanceTo(nextLogicalStep.codigo as EstadoCodigoEnum)"
            >
              <ArrowRight :size="16" aria-hidden="true" />
              "{{ stepLabel(nextLogicalStep) }}"
            </Button>
            <button
              v-if="alternativeTransitions.length"
              type="button"
              class="split-action__toggle"
              aria-label="Otras transiciones de estado"
              aria-haspopup="menu"
              :aria-expanded="stateMenuOpen"
              :disabled="processing"
              @click="stateMenuOpen = !stateMenuOpen"
            >
              <ChevronDown :size="16" aria-hidden="true" />
            </button>

            <div v-if="stateMenuOpen" class="split-action__menu" role="menu">
              <button
                v-for="alt in alternativeTransitions"
                :key="alt.codigo"
                type="button"
                role="menuitem"
                @click="advanceTo(alt.codigo as EstadoCodigoEnum)"
              >
                <ArrowRight :size="14" aria-hidden="true" />
                "{{ stepLabel(alt) }}"
              </button>
            </div>
          </div>
        </div>

        <div v-if="isCancelled" class="cancelled-banner">
          <Ban :size="18" aria-hidden="true" />
          <div>
            <strong>Pedido cancelado</strong>
            <p>{{ cancelledMessage }}</p>
          </div>
        </div>

        <ol v-else class="stepper" aria-label="Ciclo de vida del pedido">
          <li
            v-for="(step, idx) in workflowSteps"
            :key="step.codigo"
            class="step"
            :class="{
              'step--done': idx < currentStepIndex,
              'step--current': idx === currentStepIndex,
              'step--upcoming': idx > currentStepIndex,
            }"
          >
            <div class="step__track">
              <span
                class="step__rail"
                :class="{
                  'step__rail--hidden': idx === 0,
                  'step__rail--done': idx <= currentStepIndex,
                }"
                aria-hidden="true"
              />
              <span class="step__circle" aria-hidden="true">
                <Check
                  v-if="
                    idx < currentStepIndex ||
                    (idx === currentStepIndex && step.codigo === 'ENTREGADO')
                  "
                  :size="16"
                />
                <component :is="step.icon" v-else :size="16" />
              </span>
              <span
                class="step__rail"
                :class="{
                  'step__rail--hidden': idx === workflowSteps.length - 1,
                  'step__rail--done': idx < currentStepIndex,
                }"
                aria-hidden="true"
              />
            </div>
            <div class="step__content">
              <span class="step__title">{{ stepLabel(step) }}</span>
              <dl v-if="idx === currentStepIndex" class="step__current-dl">
                <dt class="sr-only">Estado actual</dt>
                <dd class="step__current-tag">
                  Estado actual <span class="sr-only">{{ stepLabel(step) }}</span>
                </dd>
              </dl>
            </div>
          </li>
        </ol>
      </section>

      <section class="panel" aria-labelledby="order-docs-title">
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <PackageCheck :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="order-docs-title">Documentos operativos vinculados</h2>
              <p>Recibos de cobro y nota de entrega registrados sobre este pedido.</p>
            </div>
          </div>
          <div class="section-heading__actions">
            <Button
              v-if="currentCode === 'CONFIRMADO'"
              variant="info"
              :disabled="processing"
              @click="openReceiptModal"
            >
              <Receipt :size="16" aria-hidden="true" />
              Emitir recibo
            </Button>
            <Button
              v-if="currentCode === 'LISTO_ENTREGA'"
              variant="info"
              :disabled="processing"
              @click="noteOpen = true"
            >
              <Send :size="16" aria-hidden="true" />
              Emitir nota de entrega
            </Button>
          </div>
        </div>

        <div
          v-if="quote && !docsLoading"
          class="docs-kpis"
          aria-label="Resumen de cobros del pedido"
        >
          <div class="docs-kpi">
            <span class="docs-kpi__icon">
              <FileText :size="18" aria-hidden="true" />
            </span>
            <div class="docs-kpi__body">
              <span class="docs-kpi__label">Total del pedido</span>
              <strong class="docs-kpi__value">{{ money(orderTotal, orderCurrency) }}</strong>
              <small class="docs-kpi__sub">Importe aprobado en proforma</small>
            </div>
          </div>

          <div class="docs-kpi">
            <span class="docs-kpi__icon docs-kpi__icon--success">
              <Wallet :size="18" aria-hidden="true" />
            </span>
            <div class="docs-kpi__body">
              <span class="docs-kpi__label">Cobrado acumulado</span>
              <strong class="docs-kpi__value docs-kpi__value--success">
                {{ money(orderPaid, orderCurrency) }}
              </strong>
              <small class="docs-kpi__sub">
                {{
                  emittedReceiptsCount
                    ? `${emittedReceiptsCount} recibo${emittedReceiptsCount === 1 ? '' : 's'} emitido${emittedReceiptsCount === 1 ? '' : 's'}`
                    : 'Sin cobros registrados'
                }}
              </small>
            </div>
          </div>

          <div class="docs-kpi" :class="{ 'docs-kpi--paid': orderRemaining <= 0.0001 }">
            <span
              class="docs-kpi__icon"
              :class="
                orderRemaining > 0.0001 ? 'docs-kpi__icon--warning' : 'docs-kpi__icon--success'
              "
            >
              <Clock3 v-if="orderRemaining > 0.0001" :size="18" aria-hidden="true" />
              <CheckCircle2 v-else :size="18" aria-hidden="true" />
            </span>
            <div class="docs-kpi__body">
              <span class="docs-kpi__label">Saldo pendiente</span>
              <strong class="docs-kpi__value">{{ money(orderRemaining, orderCurrency) }}</strong>
              <small class="docs-kpi__sub">
                {{ orderRemaining > 0.0001 ? 'Pendiente por cobrar' : 'Pedido pagado al 100 %' }}
              </small>
            </div>
          </div>
        </div>

        <div v-if="docsLoading" class="docs-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <EmptyState
          v-else-if="!receipts.length && !deliveryNotes.length"
          title="Sin documentos emitidos"
          description="Todavía no se emitieron recibos ni notas de entrega para este pedido."
        />
        <div v-else class="docs-list">
          <article
            v-for="rec in receipts"
            :key="`rec-${rec.id}`"
            class="doc-row doc-row--receipt"
            :class="{ 'doc-row--annulled': rec.estado === 'ANULADO' }"
          >
            <div class="doc-row__identity">
              <span
                class="doc-row__icon"
                :class="
                  rec.estado === 'ANULADO' ? 'doc-row__icon--danger' : 'doc-row__icon--success'
                "
              >
                <Ban v-if="rec.estado === 'ANULADO'" :size="16" aria-hidden="true" />
                <Receipt v-else :size="16" aria-hidden="true" />
              </span>
              <div class="doc-row__body">
                <div class="doc-row__title-line">
                  <RouterLink :to="`/recibos/${rec.id}`" class="doc-row__title-link">
                    Recibo #{{ rec.numero }}
                  </RouterLink>
                  <Badge :tone="rec.estado === 'ANULADO' ? 'danger' : 'success'">
                    {{ rec.estado }}
                  </Badge>
                  <span class="doc-row__date">
                    <Calendar :size="13" aria-hidden="true" />
                    {{ fechaComercial(String(rec.fecha)) }}
                  </span>
                </div>
                <p class="doc-row__concept">{{ rec.concepto }}</p>
                <div class="doc-row__details">
                  <span class="doc-row__detail">
                    <UserCheck :size="13" aria-hidden="true" />
                    {{ rec.nombre_completo }}
                  </span>
                  <span class="doc-row__detail">
                    <component :is="receiptPaymentIcon(rec)" :size="13" aria-hidden="true" />
                    {{ receiptPaymentName(rec) }}
                  </span>
                  <span v-if="rec.banco || rec.numero_cheque" class="doc-row__detail">
                    {{
                      [rec.banco, rec.numero_cheque ? `N.º ${rec.numero_cheque}` : '']
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </span>
                </div>
              </div>
            </div>

            <div class="doc-row__aside">
              <div class="doc-row__amounts">
                <strong class="doc-row__amount">
                  {{ money(rec.pago_actual, rec.moneda_codigo || orderCurrency) }}
                </strong>
                <span class="doc-row__amounts-sub">
                  A cuenta: {{ money(rec.a_cuenta, rec.moneda_codigo || orderCurrency) }} · Saldo:
                  {{ money(rec.saldo, rec.moneda_codigo || orderCurrency) }}
                </span>
              </div>
              <button
                type="button"
                class="doc-row__pdf-btn"
                :aria-label="`Ver PDF del Recibo #${rec.numero}`"
                :title="`Ver PDF del Recibo #${rec.numero}`"
                @click="openReceiptPdfPreview(rec)"
              >
                <FileText :size="17" aria-hidden="true" />
              </button>
            </div>
          </article>

          <RouterLink
            v-for="nota in deliveryNotes"
            :key="`nota-${nota.id}`"
            :to="`/notas-entrega/${nota.id}`"
            class="doc-row doc-row--link"
          >
            <div class="doc-row__identity">
              <span class="doc-row__icon">
                <PackageCheck :size="16" aria-hidden="true" />
              </span>
              <div class="doc-row__body">
                <strong>Nota de entrega #{{ nota.id }}</strong>
                <span class="doc-row__date">
                  <Calendar :size="13" aria-hidden="true" />
                  Emitida el {{ formatearFechaHora(nota.fecha) }}
                </span>
              </div>
            </div>
            <div class="doc-row__meta">
              <Badge tone="info">Entregado</Badge>
            </div>
          </RouterLink>
        </div>
      </section>
    </template>

    <Modal
      :open="receiptOpen"
      wide
      title="Emitir recibo"
      :description="`El pago se registra sobre el Pedido #${pedidoId} en moneda ${orderCurrency}.`"
      @close="receiptOpen = false"
    >
      <template #title-icon>
        <span class="receipt-modal-icon">
          <Receipt :size="20" aria-hidden="true" />
        </span>
      </template>

      <div class="receipt-board" aria-label="Resumen financiero del cobro">
        <div class="receipt-board__context">
          <div class="receipt-metric">
            <span class="receipt-metric__icon">
              <FileText :size="15" aria-hidden="true" />
            </span>
            <div>
              <span>Total del pedido</span>
              <strong>{{ money(orderTotal, orderCurrency) }}</strong>
            </div>
          </div>
          <div class="receipt-metric">
            <span class="receipt-metric__icon">
              <Wallet :size="15" aria-hidden="true" />
            </span>
            <div>
              <span>Pagos anteriores</span>
              <strong>{{ money(orderPaid, orderCurrency) }}</strong>
            </div>
          </div>
        </div>

        <div class="receipt-board__projection">
          <div class="receipt-metric receipt-metric--highlight">
            <span class="receipt-metric__icon receipt-metric__icon--primary">
              <Banknote :size="16" aria-hidden="true" />
            </span>
            <div>
              <span>Pago actual</span>
              <strong>{{ money(validPayAmount, orderCurrency) }}</strong>
            </div>
          </div>
          <div class="receipt-metric receipt-metric--highlight">
            <span class="receipt-metric__icon receipt-metric__icon--success">
              <TrendingUp :size="16" aria-hidden="true" />
            </span>
            <div>
              <span>Acumulado</span>
              <strong>{{ money(projectedAccumulated, orderCurrency) }}</strong>
            </div>
          </div>
          <div class="receipt-metric receipt-metric--highlight">
            <span
              class="receipt-metric__icon"
              :class="
                projectedRemaining < -0.0001
                  ? 'receipt-metric__icon--danger'
                  : projectedRemaining <= 0.0001
                    ? 'receipt-metric__icon--success'
                    : 'receipt-metric__icon--warning'
              "
            >
              <Clock3 :size="16" aria-hidden="true" />
            </span>
            <div>
              <span>Saldo restante</span>
              <strong
                :class="{
                  'receipt-summary__danger': projectedRemaining < -0.0001,
                  'receipt-summary__success':
                    projectedRemaining >= -0.0001 && projectedRemaining <= 0.0001,
                }"
              >
                {{ money(projectedRemaining, orderCurrency) }}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <form id="receipt" class="receipt-form" @submit.prevent="receipt">
        <div class="receipt-section receipt-form__full">
          <div class="receipt-section__header">
            <UserCheck :size="15" aria-hidden="true" />
            <span>Pagador e importe del cobro</span>
          </div>
          <div class="receipt-section__grid">
            <div class="receipt-form__full">
              <TextField
                v-model="form.nombre_completo"
                label="Recibido de"
                name="nombre"
                required
              />
            </div>
            <div class="receipt-field-wrap">
              <div class="receipt-field-badge">
                <Coins :size="13" aria-hidden="true" />
                <span>Moneda {{ orderCurrency }}</span>
              </div>
              <TextField
                v-model="form.pago_actual"
                :label="`Pago actual (${orderCurrency})`"
                name="pago"
                type="number"
                min="0.01"
                step="0.01"
                :error="receiptAmountError"
                required
              />
            </div>
            <div class="receipt-field-wrap">
              <div class="receipt-field-badge">
                <component :is="selectedPaymentIcon" :size="13" aria-hidden="true" />
                <span>{{ selectedPaymentType?.nombre || 'Medio de cobro' }}</span>
              </div>
              <Select
                v-model="form.tipo_pago"
                name="tipo-pago"
                label="Tipo de pago"
                :options="[
                  { label: 'Seleccione', value: '' },
                  ...payments.map((x) => ({ label: x.nombre, value: String(x.id) })),
                ]"
              />
            </div>
          </div>
        </div>

        <div v-if="isCheque" class="receipt-cheque-box receipt-form__full">
          <div class="receipt-section__header">
            <FileCheck2 :size="15" aria-hidden="true" />
            <span>Datos del cheque</span>
          </div>
          <div class="receipt-section__grid">
            <div class="receipt-field-wrap">
              <div class="receipt-field-badge">
                <Landmark :size="13" aria-hidden="true" />
                <span>Entidad bancaria</span>
              </div>
              <TextField v-model="form.banco" label="Banco" name="banco" required />
            </div>
            <div class="receipt-field-wrap">
              <div class="receipt-field-badge">
                <Hash :size="13" aria-hidden="true" />
                <span>Documento bancario</span>
              </div>
              <TextField
                v-model="form.numero_cheque"
                label="Número de cheque"
                name="cheque"
                required
              />
            </div>
          </div>
        </div>

        <div class="receipt-section receipt-form__full">
          <div class="receipt-section__header">
            <Quote :size="15" aria-hidden="true" />
            <span>Respaldo literal y concepto</span>
          </div>
          <div class="receipt-section__grid">
            <div class="receipt-form__full receipt-field-wrap">
              <div class="receipt-letras-bar">
                <span class="receipt-letras-tag">
                  {{ montoEnLetrasManual ? 'Editado manualmente' : 'Autogenerado' }}
                </span>
                <button
                  v-if="montoEnLetrasManual"
                  type="button"
                  class="receipt-letras-reset"
                  @click="restoreAutoMontoEnLetras"
                >
                  <RotateCcw :size="12" aria-hidden="true" />
                  Restaurar automático
                </button>
              </div>
              <TextField
                v-model="form.monto_en_letras"
                label="Monto en letras"
                name="letras"
                required
                @update:model-value="montoEnLetrasManual = true"
              />
            </div>
            <div class="receipt-form__full">
              <TextField v-model="form.concepto" label="Concepto" name="concepto" required />
            </div>
          </div>
        </div>
      </form>
      <p v-if="receiptError" class="receipt-error" role="alert">{{ receiptError }}</p>
      <template #footer>
        <Button variant="secondary" :disabled="processing" @click="receiptOpen = false">
          <X :size="16" aria-hidden="true" />
          Volver
        </Button>
        <Button
          variant="info"
          type="submit"
          form="receipt"
          :disabled="processing || !receiptFormValid"
        >
          <Send :size="17" aria-hidden="true" />
          {{ processing ? 'Emitiendo...' : 'Emitir' }}
        </Button>
      </template>
    </Modal>

    <ConfirmDialog
      :open="cancelOpen"
      title="Cancelar pedido"
      description="Si el pedido ya tiene recibos emitidos, no podrá cancelarse. Al confirmar, las existencias descontadas al confirmar el pedido se restituirán al inventario mediante reversa."
      confirm-label="Cancelar pedido"
      danger
      @close="cancelOpen = false"
      @confirm="cancel"
    />

    <ConfirmDialog
      :open="noteOpen"
      variant="info"
      title="Emitir nota de entrega"
      description="Se creará la única nota del pedido con la fecha actual de emisión."
      confirm-label="Emitir nota"
      @close="noteOpen = false"
      @confirm="note"
    />

    <DocumentViewerModal
      :open="pdfPreviewOpen"
      :title="pdfPreviewRecibo ? `Recibo #${pdfPreviewRecibo.numero}` : 'Comprobante de recibo'"
      subtitle="Hoja carta con Copia Cliente y Copia HOMEX listas para impresión."
      :pdf-url="receiptPdfUrl"
      :loading="receiptPdfLoading"
      :error="receiptPdfError"
      :downloading="downloadingReceiptPdf"
      :can-download-pdf="Boolean(pdfPreviewRecibo)"
      @close="closeReceiptPdfPreview"
      @download="downloadReceiptPdf"
      @retry="pdfPreviewRecibo && loadReceiptPdf(pdfPreviewRecibo.id)"
    />
  </div>
</template>

<style scoped>
.order-detail {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}
.order-topline {
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
.order-divider {
  margin: 0 0.45rem;
  opacity: 0.5;
}
.order-status-pill {
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
.order-status-pill--danger {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
.stat__body {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.stat__body > span {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.stat__value {
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
}
.stat__proforma {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.stat__link {
  color: var(--color-primary-accent);
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
}
.stat__link:hover {
  text-decoration: underline;
}
.stat__proforma small {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.section-heading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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
  font-size: 1.12rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.cancelled-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  border-radius: var(--radius-control);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.cancelled-banner p {
  margin: 0.2rem 0 0;
  font-size: 0.86rem;
}
.stepper {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0 0.25rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}
.step {
  display: grid;
  gap: 0.65rem;
  justify-items: center;
  text-align: center;
  align-content: start;
  min-width: 0;
}
.step__track {
  display: flex;
  align-items: center;
  width: 100%;
}
.step__rail {
  height: 2px;
  flex: 1;
  background: var(--color-border);
}
.step__rail--hidden {
  opacity: 0;
}
.step__rail--done {
  background: var(--color-success);
}
.step__circle {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}
.step--done .step__circle {
  border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
  background: var(--color-success-soft);
  color: var(--color-success);
}
.step--current .step__circle {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 0 0 4px var(--color-primary-soft);
}
.step__content {
  display: grid;
  gap: 0.3rem;
  justify-items: center;
  padding: 0 0.35rem;
  min-width: 0;
}
.step__title {
  font-size: 0.86rem;
  font-weight: 650;
  color: var(--color-text-secondary);
}
.step--done .step__title,
.step--current .step__title {
  color: var(--color-text);
}
.step__current-dl {
  margin: 0;
}
.step__current-tag {
  margin: 0;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.16rem 0.55rem;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
  font-size: 0.72rem;
  font-weight: 700;
}
.split-action {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}
.split-action__main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.split-action__toggle {
  display: inline-grid;
  place-items: center;
  width: 2.5rem;
  border: 1px solid color-mix(in srgb, #fff 22%, var(--color-primary));
  border-left: 1px solid color-mix(in srgb, #fff 28%, transparent);
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
}
.split-action__toggle:hover:not(:disabled) {
  filter: brightness(1.08);
}
.split-action__toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.split-action__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 14rem;
  z-index: 40;
  display: grid;
  gap: 2px;
  padding: 5px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 14px 36px rgb(0 0 0 / 22%);
}
.split-action__menu button {
  min-height: 2.5rem;
  padding: 0.55rem 0.75rem;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.split-action__menu button:hover,
.split-action__menu button:focus-visible {
  background: var(--color-surface-hover);
  color: var(--color-primary-accent);
}
.docs-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.docs-kpi {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  min-width: 0;
}
.docs-kpi--paid {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
}
.docs-kpi__icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: none;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 0.65rem;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}
.docs-kpi__icon--success {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.docs-kpi__icon--warning {
  color: var(--color-warning, #d97706);
  background: color-mix(in srgb, var(--color-warning, #d97706) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-warning, #d97706) 35%, transparent);
}
.docs-kpi__body {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.docs-kpi__label {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}
.docs-kpi__value {
  color: var(--color-text);
  font-size: 1.05rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.docs-kpi__value--success {
  color: var(--color-success);
}
.docs-kpi__sub {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
}
.docs-list {
  display: grid;
  gap: var(--space-3);
}
.doc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0.95rem 1.05rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text);
  text-decoration: none;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.doc-row--link:hover,
.doc-row--receipt:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.doc-row--annulled {
  opacity: 0.85;
}
.doc-row__identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}
.doc-row__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 0.6rem;
  color: var(--color-primary-accent);
  background: var(--color-surface);
}
.doc-row__icon--success {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.doc-row__icon--danger {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.doc-row__body {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.doc-row__title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem 0.6rem;
}
.doc-row__title-link {
  color: var(--color-text);
  font-size: 0.93rem;
  font-weight: 700;
  text-decoration: none;
}
.doc-row__title-link:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.doc-row__date {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--color-text-secondary);
  font-size: 0.77rem;
  font-weight: 550;
}
.doc-row__concept {
  margin: 0;
  color: var(--color-text);
  font-size: 0.83rem;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}
.doc-row__details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.85rem;
}
.doc-row__detail {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  white-space: normal;
  overflow-wrap: anywhere;
}
.doc-row__aside {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: none;
}
.doc-row__amounts {
  display: grid;
  gap: 0.12rem;
  justify-items: end;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.doc-row__amounts-sub {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
}
.doc-row__pdf-btn {
  display: inline-grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  flex: none;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-primary-accent);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}
.doc-row__pdf-btn:hover,
.doc-row__pdf-btn:focus-visible {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
.doc-row__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: none;
}
.doc-row__amount {
  font-size: 0.96rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.receipt-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.notice--error {
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  border-radius: var(--radius-control);
  color: var(--color-danger);
  background: var(--color-danger-soft);
  font-size: 0.9rem;
}
.docs-skeleton {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}
.docs-skeleton span {
  height: 1rem;
  border-radius: 0.25rem;
  background: linear-gradient(
    90deg,
    var(--color-surface-hover),
    var(--color-border),
    var(--color-surface-hover)
  );
  background-size: 200%;
  animation: pulse 1.4s infinite;
}
.docs-skeleton span:last-child {
  width: 65%;
}
@keyframes pulse {
  to {
    background-position: -200% 0;
  }
}
@media (max-width: 47.99rem) {
  .summary,
  .docs-kpis,
  .receipt-form,
  .receipt-section__grid,
  .receipt-board__context,
  .receipt-board__projection {
    grid-template-columns: 1fr;
  }
  .stepper {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  .step__rail {
    display: none;
  }
  .step__track {
    width: auto;
  }
  .step {
    grid-template-columns: auto 1fr;
    align-items: center;
    justify-items: start;
    text-align: left;
  }
  .step__content {
    justify-items: start;
    padding: 0;
  }
  .split-action {
    width: 100%;
  }
  .split-action__main {
    flex: 1;
  }
  .doc-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .doc-row__aside {
    width: 100%;
    justify-content: space-between;
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
  }
  .doc-row__amounts {
    justify-items: start;
    text-align: left;
  }
}
.receipt-modal-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.receipt-board {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 1.1rem;
}
.receipt-board__context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}
.receipt-board__projection {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}
.receipt-metric {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  min-width: 0;
}
.receipt-metric--highlight {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
}
.receipt-metric > div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}
.receipt-metric span {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}
.receipt-metric strong {
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
}
.receipt-metric__icon {
  display: grid;
  width: 1.95rem;
  height: 1.95rem;
  flex: none;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.receipt-metric__icon--primary {
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
  border-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
}
.receipt-metric__icon--success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
}
.receipt-metric__icon--warning {
  background: color-mix(in srgb, var(--color-warning, #d97706) 12%, transparent);
  color: var(--color-warning, #d97706);
  border-color: color-mix(in srgb, var(--color-warning, #d97706) 30%, transparent);
}
.receipt-metric__icon--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.receipt-summary__danger {
  color: var(--color-danger, #dc2626);
}
.receipt-summary__success {
  color: var(--color-success);
}
.receipt-section {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.receipt-cheque-box {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-primary-soft) 35%, var(--color-surface));
}
.receipt-section__header {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 700;
}
.receipt-section__header svg {
  color: var(--color-primary-accent);
}
.receipt-section__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.receipt-field-wrap {
  display: grid;
  gap: 0.25rem;
  align-content: start;
}
.receipt-field-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
}
.receipt-letras-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.receipt-letras-tag {
  font-size: 0.71rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.receipt-letras-reset {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.12rem 0.45rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary-accent);
  font-family: inherit;
  font-size: 0.71rem;
  font-weight: 650;
  cursor: pointer;
}
.receipt-letras-reset:hover {
  background: var(--color-surface-hover);
}
.receipt-form__full {
  grid-column: 1 / -1;
}
.receipt-error {
  margin: 0.75rem 0 0;
  color: var(--color-danger, #dc2626);
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
