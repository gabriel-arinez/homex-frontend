<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  Hammer,
  PackageCheck,
  PenLine,
  UserCheck,
} from '@lucide/vue'
import type { NotaEntrega, Pedido, Proforma } from '@/generated/api'
import { pedidosService } from '@/modules/pedidos/services/pedidosService'
import DocumentViewerModal from '@/modules/proformas/components/DocumentViewerModal.vue'
import { useQuoteProductImages } from '@/modules/proformas/composables/useQuoteProductImages'
import { proformasService } from '@/modules/proformas/services/proformasService'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { buildExportFilename } from '@/shared/download/exportFilename'
import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import DetailTabs from '@/shared/ui/DetailTabs.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Toast from '@/shared/ui/Toast.vue'
import { notasEntregaService } from '../services/notasEntregaService'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const item = ref<NotaEntrega | null>(null)
const order = ref<Pedido | null>(null)
const quote = ref<Proforma | null>(null)
const contextLoading = ref(false)
const loading = ref(true)
const downloading = ref(false)
const previewModalOpen = ref(false)
const activeTab = ref<'trazabilidad' | 'items'>('trazabilidad')
const error = ref('')
const notice = ref('')

const { images: productImages, ensure: ensureProductImages } = useQuoteProductImages()
const {
  blob: documentBlob,
  url: documentUrl,
  loading: documentLoading,
  error: documentError,
  load: loadDocument,
  clear: clearDocument,
} = usePdfDocument((noteId) => notasEntregaService.documentPdf(noteId))

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return 'Sin fecha'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('es-BO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date)
    }
  }
  return value
}

function formatQuantity(value: string | number): string {
  const text = String(value).trim()
  if (/^\d+\.0+$/.test(text)) return text.split('.')[0] ?? text
  return text
}

const isCompany = computed(() => Boolean(quote.value?.cliente_resumen?.empresa?.trim()))

const clientDisplay = computed(() => {
  const resumen = quote.value?.cliente_resumen
  if (!resumen) return 'Asociado al pedido'
  return resumen.empresa?.trim() || resumen.nombre?.trim() || 'Asociado al pedido'
})

const deliveryLines = computed(() => quote.value?.detalles ?? [])
const deliveryTabs = computed(() => [
  {
    id: 'trazabilidad',
    label: 'Trazabilidad y condiciones',
    icon: FileText,
  },
  {
    id: 'items',
    label: 'Ítems incluidos',
    icon: PackageCheck,
    badge: deliveryLines.value.length || undefined,
  },
])

async function loadRelatedContext(pedidoId: number) {
  contextLoading.value = true
  try {
    const pedidoData = await pedidosService.get(pedidoId)
    order.value = pedidoData
    const quoteData = await proformasService.get(pedidoData.proforma)
    quote.value = quoteData
    const productIds = quoteData.detalles
      .map((line) => line.producto)
      .filter((prodId): prodId is number => typeof prodId === 'number' && prodId > 0)
    if (productIds.length) {
      void ensureProductImages(productIds)
    }
  } catch {
    order.value = null
    quote.value = null
  } finally {
    contextLoading.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const note = await notasEntregaService.get(id)
    item.value = note
    void loadRelatedContext(note.pedido)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la nota.'
  } finally {
    loading.value = false
  }
}

function openPdfViewer() {
  if (!item.value) return
  previewModalOpen.value = true
  void loadDocument(item.value.id)
}

function closePdfViewer() {
  previewModalOpen.value = false
  clearDocument()
}

async function downloadDocument() {
  if (!item.value || downloading.value) return
  downloading.value = true
  error.value = ''
  const opened = previewModalOpen.value
  try {
    const file = (opened && documentBlob.value) || (await loadDocument(id))
    if (!file) {
      if (!opened) error.value = documentError.value || 'No se pudo obtener el PDF.'
      return
    }
    downloadBlob(
      file,
      buildExportFilename(
        'nota-entrega',
        [item.value.numero, `pedido-${item.value.pedido}`, item.value.fecha],
        'pdf',
      ),
    )
    notice.value = 'Nota de entrega PDF descargada correctamente.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo descargar la nota.'
  } finally {
    downloading.value = false
    if (!opened) clearDocument()
  }
}

onMounted(load)
</script>

<template>
  <div class="delivery-detail">
    <Toast :visible="Boolean(notice)" :message="notice" tone="success" @close="notice = ''" />

    <div class="delivery-topline" aria-label="Ubicación en el proceso">
      <span>
        OPERACIONES <span class="delivery-divider">/</span> NOTAS DE ENTREGA
        <span class="delivery-divider">/</span> NOTA #{{ item?.numero ?? id }}
      </span>
      <div v-if="item" class="delivery-status-pill">
        <PackageCheck :size="14" aria-hidden="true" />
        <span>Documento emitido · Entrega total</span>
      </div>
    </div>

    <PageHeader
      :title="`Nota de entrega #${item?.numero ?? id}`"
      description="Comprobante oficial de entrega física asociada al pedido confirmado."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push('/notas-entrega')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver
        </Button>
        <Button v-if="item" variant="secondary" @click="openPdfViewer">
          <FileText :size="17" aria-hidden="true" />
          Ver PDF
        </Button>
        <Button v-if="item" variant="secondary" :processing="downloading" @click="downloadDocument">
          <Download :size="17" aria-hidden="true" />
          Descargar PDF
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="5" />
    <ErrorState v-else-if="error && !item" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>

    <template v-else-if="item">
      <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>

      <section class="summary" aria-label="Resumen de la nota de entrega">
        <div class="stat">
          <span class="stat__icon">
            <Calendar :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Fecha de emisión</span>
            <strong class="stat__value">{{ formatDateLabel(item.fecha) }}</strong>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <ClipboardList :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Pedido vinculado</span>
            <RouterLink :to="`/pedidos/${item.pedido}`" class="stat__link">
              Pedido #{{ item.pedido }}
            </RouterLink>
            <small v-if="quote?.titulo">{{ quote.titulo }}</small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <Building2 v-if="isCompany" :size="18" aria-hidden="true" />
            <UserCheck v-else :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Cliente / Destinatario</span>
            <strong class="stat__value" :title="clientDisplay">{{ clientDisplay }}</strong>
            <small v-if="quote">Proforma #{{ quote.numero }}</small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon stat__icon--success">
            <PackageCheck :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Modalidad de entrega</span>
            <strong class="stat__value">Entrega total (1:1)</strong>
            <small>Sin entregas parciales</small>
          </div>
        </div>
      </section>

      <DetailTabs
        :model-value="activeTab"
        :tabs="deliveryTabs"
        aria-label="Apartados de la nota de entrega"
        @update:model-value="activeTab = $event as 'trazabilidad' | 'items'"
      />

      <section
        v-show="activeTab === 'trazabilidad'"
        class="panel"
        role="tabpanel"
        aria-labelledby="delivery-traceability-title"
      >
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <FileText :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="delivery-traceability-title">Trazabilidad y condiciones de entrega</h2>
              <p>Respaldo operativo del despacho realizado sobre el pedido.</p>
            </div>
          </div>
        </div>

        <div class="delivery-fields-grid">
          <div class="delivery-field-card">
            <span class="delivery-field-card__icon">
              <FileText :size="17" aria-hidden="true" />
            </span>
            <div class="delivery-field-card__body">
              <span class="delivery-field-card__label">Documento oficial</span>
              <strong class="delivery-field-card__value">
                Nota de entrega #{{ item.numero }}
              </strong>
            </div>
          </div>

          <div class="delivery-field-card">
            <span class="delivery-field-card__icon">
              <ClipboardList :size="17" aria-hidden="true" />
            </span>
            <div class="delivery-field-card__body">
              <span class="delivery-field-card__label">Pedido de origen</span>
              <RouterLink :to="`/pedidos/${item.pedido}`" class="delivery-field-card__link">
                Pedido #{{ item.pedido }}
              </RouterLink>
            </div>
          </div>

          <div class="delivery-field-card">
            <span class="delivery-field-card__icon">
              <Calendar :size="17" aria-hidden="true" />
            </span>
            <div class="delivery-field-card__body">
              <span class="delivery-field-card__label">Referencia comercial</span>
              <strong class="delivery-field-card__value">
                {{ quote ? `Proforma #${quote.numero}` : `Pedido #${item.pedido}` }}
              </strong>
            </div>
          </div>

          <div class="delivery-field-card">
            <span class="delivery-field-card__icon">
              <PenLine :size="17" aria-hidden="true" />
            </span>
            <div class="delivery-field-card__body">
              <span class="delivery-field-card__label">Validación de recepción</span>
              <strong class="delivery-field-card__value">
                Conformidad mediante firma física en documento impreso
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section
        v-show="activeTab === 'items'"
        class="delivery-lines"
        role="tabpanel"
        aria-labelledby="delivery-items-title"
      >
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <ClipboardCheck :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="delivery-items-title">Ítems incluidos en la entrega</h2>
              <p>HOMEX no registra entregas parciales. Esta nota corresponde al pedido completo.</p>
            </div>
          </div>
          <span v-if="deliveryLines.length" class="counter">
            {{ deliveryLines.length }} {{ deliveryLines.length === 1 ? 'ítem' : 'ítems' }}
          </span>
        </div>

        <LoadingSkeleton v-if="contextLoading" :lines="3" />

        <div v-else-if="!deliveryLines.length" class="delivery-policy-note" role="status">
          <PackageCheck :size="18" aria-hidden="true" />
          <p>
            HOMEX no registra entregas parciales. Esta nota cubre la totalidad de los ítems
            confirmados en el
            <RouterLink :to="`/pedidos/${item.pedido}`">Pedido #{{ item.pedido }}</RouterLink
            >.
          </p>
        </div>

        <article v-for="(line, index) in deliveryLines" :key="line.id" class="delivery-line">
          <div class="delivery-line__main">
            <div class="delivery-line__identity">
              <div v-if="line.producto" class="delivery-line__thumb">
                <ProductImage
                  :image="productImages[line.producto] ?? null"
                  :alt="line.nombre"
                  sizes="64px"
                />
              </div>
              <div v-else class="delivery-line__thumb delivery-line__thumb--icon">
                <Hammer v-if="line.especificacion" :size="22" aria-hidden="true" />
                <PackageCheck v-else :size="22" aria-hidden="true" />
              </div>

              <div class="delivery-line__text">
                <div class="delivery-line__meta">
                  <small>
                    {{ String(index + 1).padStart(2, '0') }} · {{ line.tipo_item_info.nombre }}
                  </small>
                  <Badge :tone="line.especificacion ? 'warning' : 'info'">
                    {{ line.especificacion ? 'A medida' : 'Catálogo' }}
                  </Badge>
                </div>
                <h3>{{ line.nombre }}</h3>
                <p v-if="line.descripcion" class="delivery-line__desc">{{ line.descripcion }}</p>
              </div>
            </div>

            <div class="delivery-line__qty">
              <strong>{{ formatQuantity(line.cantidad) }}</strong>
              <span>{{ line.unidad_info.nombre }}</span>
            </div>
          </div>
        </article>
      </section>
    </template>

    <DocumentViewerModal
      v-if="item"
      :open="previewModalOpen"
      :title="`Nota de entrega #${item.numero}`"
      subtitle="Documento PDF · Tamaño Carta (216 × 279 mm) · Entrega total"
      :downloading="downloading"
      :can-download-pdf="true"
      :pdf-url="documentUrl"
      :loading="documentLoading"
      :error="documentError"
      @close="closePdfViewer"
      @retry="loadDocument(item.id)"
      @download="downloadDocument"
    />
  </div>
</template>

<style scoped>
.delivery-detail {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  padding-bottom: var(--space-8);
}
.delivery-topline {
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
.delivery-divider {
  margin: 0 0.45rem;
  opacity: 0.5;
}
.delivery-status-pill {
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
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.stat,
.panel,
.delivery-line {
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
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat__value {
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
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
  font-size: 1.12rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.counter {
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--color-text-secondary);
}
.delivery-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.delivery-field-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  min-width: 0;
}
.delivery-field-card__icon {
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
.delivery-field-card__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.delivery-field-card__label {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.delivery-field-card__value {
  font-size: 0.9rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.delivery-field-card__link {
  color: var(--color-primary-accent);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}
.delivery-field-card__link:hover {
  text-decoration: underline;
}
.delivery-lines {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.delivery-lines .section-heading {
  margin-bottom: var(--space-1);
}
.delivery-policy-note {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 1rem 1.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 0.88rem;
}
.delivery-policy-note svg {
  flex: none;
  color: var(--color-success);
}
.delivery-policy-note p {
  margin: 0;
}
.delivery-policy-note a {
  color: var(--color-primary-accent);
  font-weight: 700;
  text-decoration: none;
}
.delivery-policy-note a:hover {
  text-decoration: underline;
}
.delivery-line__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.delivery-line__identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-width: 0;
}
.delivery-line__thumb {
  width: 4rem;
  height: 4rem;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.delivery-line__thumb--icon {
  display: grid;
  place-items: center;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.delivery-line__thumb :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.delivery-line__thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.delivery-line__thumb :deep(.fallback span) {
  display: none;
}
.delivery-line__text {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
.delivery-line__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.delivery-line__meta small {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}
.delivery-line__text h3 {
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.delivery-line__desc {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
.delivery-line__qty {
  display: grid;
  justify-items: end;
  flex: none;
  text-align: right;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.delivery-line__qty strong {
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}
.delivery-line__qty span {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
@media (max-width: 64rem) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 38rem) {
  .summary,
  .delivery-fields-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .delivery-line__main {
    flex-direction: column;
    gap: var(--space-3);
  }
  .delivery-line__qty {
    justify-items: start;
    text-align: left;
  }
}
</style>
