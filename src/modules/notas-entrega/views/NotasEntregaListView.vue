<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  PackageCheck,
  RotateCcw,
} from '@lucide/vue'
import type { NotaEntrega } from '@/generated/api'
import DocumentViewerModal from '@/modules/proformas/components/DocumentViewerModal.vue'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { exportTrayExcel } from '@/shared/download/exportExcel'
import { buildExportFilename } from '@/shared/download/exportFilename'
import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import { notasEntregaService } from '../services/notasEntregaService'
import DeliveryNoteActionsMenu from '../components/DeliveryNoteActionsMenu.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ClientAvatar from '@/shared/ui/ClientAvatar.vue'
import CreatorTag from '@/shared/ui/CreatorTag.vue'
import DatePresentation from '@/shared/ui/DatePresentation.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import TextField from '@/shared/ui/TextField.vue'
import Toast from '@/shared/ui/Toast.vue'
import { dateRangeError, isValidDate, localToday } from '@/shared/validation/dateRange'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const today = localToday()
const routeDate = (key: string) => {
  const val = typeof route.query[key] === 'string' ? String(route.query[key]) : ''
  return isValidDate(val) ? val : ''
}

const rows = ref<NotaEntrega[]>([])
const loading = ref(true)
const error = ref('')
const toastMessage = ref('')
const toastTone = ref<'success' | 'danger'>('success')
const exportingExcel = ref(false)
async function exportExcel() {
  if (exportingExcel.value || dateError.value) return
  exportingExcel.value = true
  try {
    await exportTrayExcel({
      endpoint: '/api/v1/notas-entrega/exportar-excel/',
      query: {
        search: search.value.trim() || undefined,
        fecha_desde: dateFrom.value || undefined,
        fecha_hasta: dateTo.value || undefined,
      },
      prefix: 'notas-entrega',
      filenameSegments: [search.value.trim(), dateFrom.value, dateTo.value],
    })
  } catch (err) {
    toastTone.value = 'danger'
    toastMessage.value = err instanceof Error ? err.message : 'No pudimos exportar el Excel.'
  } finally {
    exportingExcel.value = false
  }
}

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const dateFrom = ref(routeDate('desde'))
const dateTo = ref(routeDate('hasta'))
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 10
const dateError = computed(() => dateRangeError(dateFrom.value, dateTo.value, today))

function clientName(nota: NotaEntrega): string {
  return nota.cliente_resumen?.empresa?.trim() || nota.cliente_resumen?.nombre?.trim() || ''
}

function quoteTitle(nota: NotaEntrega): string {
  return nota.proforma_titulo?.trim() || 'Entrega de pedido completo'
}

function proformaNumero(nota: NotaEntrega): number | null {
  return nota.proforma_numero ?? null
}

function toIsoDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return rows.value.filter((nota) => {
    if (!dateError.value) {
      const isoDay = toIsoDate(nota.fecha)
      if (dateFrom.value && isoDay && isoDay < dateFrom.value) return false
      if (dateTo.value && isoDay && isoDay > dateTo.value) return false
    }
    if (!term) return true
    const clean = term.startsWith('#') ? term.slice(1) : term
    const client = clientName(nota).toLowerCase()
    const title = quoteTitle(nota).toLowerCase()
    const profNum = proformaNumero(nota)
    return (
      String(nota.numero).includes(clean) ||
      String(nota.pedido).includes(clean) ||
      (profNum !== null && String(profNum).includes(clean)) ||
      client.includes(term) ||
      title.includes(term)
    )
  })
})

const total = computed(() => filtered.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const paginated = computed(() => {
  const start = (page.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})
const fromItem = computed(() => (total.value ? (page.value - 1) * pageSize + 1 : 0))
const toItem = computed(() => Math.min(page.value * pageSize, total.value))

const hasFilters = computed(() => Boolean(search.value.trim() || dateFrom.value || dateTo.value))

function syncRoute() {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (dateFrom.value) query.desde = dateFrom.value
  if (dateTo.value) query.hasta = dateTo.value
  if (page.value > 1) query.pagina = String(page.value)
  void router.replace({ query })
}

function clearFilters() {
  search.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
}

watch([search, dateFrom, dateTo], () => {
  page.value = 1
  syncRoute()
})

watch(page, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
  syncRoute()
})

const previewModalOpen = ref(false)
const previewTarget = ref<NotaEntrega | null>(null)
const downloadingPdf = ref(false)

const {
  blob: documentBlob,
  url: documentUrl,
  loading: documentLoading,
  error: documentError,
  load: loadDocument,
  clear: clearDocument,
} = usePdfDocument((noteId) => notasEntregaService.documentPdf(noteId))

function openPdfViewer(id: number) {
  const target = rows.value.find((row) => row.id === id)
  if (!target) return
  previewTarget.value = target
  previewModalOpen.value = true
  void loadDocument(target.id)
}

function closePdfViewer() {
  previewModalOpen.value = false
  previewTarget.value = null
  clearDocument()
}

async function handleDownload(id: number) {
  const target = rows.value.find((row) => row.id === id) ?? previewTarget.value
  if (!target || downloadingPdf.value) return
  downloadingPdf.value = true
  const opened = previewModalOpen.value && previewTarget.value?.id === target.id
  try {
    const file = (opened && documentBlob.value) || (await loadDocument(target.id))
    if (!file) {
      toastTone.value = 'danger'
      toastMessage.value = documentError.value || 'No se pudo obtener el PDF.'
      return
    }
    downloadBlob(
      file,
      buildExportFilename(
        'nota-entrega',
        [target.numero, `pedido-${target.pedido}`, target.fecha],
        'pdf',
      ),
    )
    toastTone.value = 'success'
    toastMessage.value = `Nota de entrega #${target.numero} descargada.`
  } catch (cause) {
    toastTone.value = 'danger'
    toastMessage.value =
      cause instanceof Error ? cause.message : 'No se pudo descargar la nota de entrega.'
  } finally {
    downloadingPdf.value = false
    if (!opened) clearDocument()
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await notasEntregaService.list()
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las notas.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="delivery-notes-list">
    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      :tone="toastTone"
      @close="toastMessage = ''"
    />

    <PageHeader
      title="Notas de entrega"
      description="Notas emitidas cuando el pedido está listo para entrega."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button
          variant="secondary"
          :processing="exportingExcel"
          :disabled="exportingExcel || Boolean(dateError)"
          :title="dateError || undefined"
          @click="exportExcel"
        >
          <FileSpreadsheet :size="16" aria-hidden="true" />
          {{ exportingExcel ? 'Exportando…' : 'Exportar Excel' }}
        </Button>
      </template>
    </PageHeader>

    <section class="delivery-filters" aria-label="Buscar y filtrar notas de entrega">
      <div class="delivery-filters__main">
        <div class="delivery-search">
          <SearchField v-model="search" label="Buscar por nota, pedido, proforma o cliente" />
        </div>
        <div class="delivery-filter-date">
          <TextField
            v-model="dateFrom"
            name="fecha-desde-nota"
            label="Desde"
            type="date"
            :active="Boolean(dateFrom)"
            :max="dateTo && dateTo < today ? dateTo : today"
          />
        </div>
        <div class="delivery-filter-date">
          <TextField
            v-model="dateTo"
            name="fecha-hasta-nota"
            label="Hasta"
            type="date"
            :active="Boolean(dateTo)"
            :min="dateFrom || undefined"
            :max="today"
          />
        </div>
        <Button
          v-if="hasFilters"
          variant="danger"
          class="delivery-clear-btn"
          aria-label="Limpiar filtros"
          title="Limpiar filtros"
          @click="clearFilters"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </Button>
      </div>
      <p v-if="dateError" class="delivery-date-error" role="alert">{{ dateError }}</p>
    </section>

    <LoadingSkeleton v-if="loading" :lines="5" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="!filtered.length"
      :title="hasFilters ? 'Sin coincidencias' : 'Sin notas de entrega'"
      :description="
        hasFilters
          ? 'No encontramos notas de entrega con los filtros actuales.'
          : 'Una nota se emite desde un pedido listo para entrega.'
      "
    >
      <Button v-if="hasFilters" variant="secondary" @click="clearFilters">Limpiar filtros</Button>
    </EmptyState>
    <template v-else>
      <div class="delivery-results">
        <p>{{ total }} nota{{ total === 1 ? '' : 's' }} de entrega</p>
        <span>Despacho y conformidad HOMEX</span>
      </div>
      <div class="delivery-table">
        <table>
          <caption class="sr-only">
            Notas de entrega
          </caption>
          <colgroup>
            <col class="col-note" />
            <col class="col-origin" />
            <col class="col-date" />
            <col class="col-coverage" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Nota de entrega</th>
              <th scope="col">Cliente y origen</th>
              <th scope="col">Emisión</th>
              <th scope="col">Cobertura</th>
              <th scope="col" class="actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paginated" :key="row.id">
              <td class="note-cell">
                <div class="note-identity">
                  <span class="note-badge">
                    <PackageCheck :size="16" aria-hidden="true" />
                  </span>
                  <div class="note-identity__text">
                    <RouterLink :to="`/notas-entrega/${row.id}`" class="note-code">
                      Nota #{{ row.numero }}
                    </RouterLink>
                    <span class="note-subtitle" :title="quoteTitle(row)">
                      {{ quoteTitle(row) }}
                    </span>
                  </div>
                </div>
              </td>
              <td class="origin-cell" data-label="Cliente y origen">
                <div class="origin-content">
                  <ClientAvatar :name="clientName(row)" :size="34" />
                  <div class="origin-info">
                    <strong v-if="clientName(row)" :title="clientName(row)">
                      {{ clientName(row) }}
                    </strong>
                    <span v-else class="origin-client-empty">Cliente sin especificar</span>
                    <div class="origin-links">
                      <RouterLink :to="`/pedidos/${row.pedido}`" class="origin-chip">
                        <ClipboardList :size="13" aria-hidden="true" />
                        Pedido #{{ row.pedido }}
                      </RouterLink>
                      <span v-if="proformaNumero(row)" class="origin-proforma">
                        <FileText :size="12" aria-hidden="true" />
                        Prof. #{{ proformaNumero(row) }}
                      </span>
                    </div>
                    <CreatorTag
                      v-if="row.vendedor_resumen?.display_name"
                      :name="row.vendedor_resumen.display_name"
                    />
                  </div>
                </div>
              </td>
              <td class="date-cell" data-label="Emisión">
                <DatePresentation :timestamp="row.fecha_hora ?? null" :date="String(row.fecha)" />
              </td>
              <td class="coverage-cell" data-label="Cobertura">
                <Badge tone="info">Pedido completo</Badge>
              </td>
              <td class="actions-cell">
                <DeliveryNoteActionsMenu
                  :id="row.id"
                  :numero="row.numero"
                  :pedido-id="row.pedido"
                  @open-pdf="openPdfViewer"
                  @download="handleDownload"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="delivery-pagination" aria-label="Paginación de notas de entrega">
        <p>Mostrando {{ fromItem }}–{{ toItem }} de {{ total }} registros</p>
        <div v-if="totalPages > 1" class="delivery-pagination__buttons">
          <button type="button" :disabled="page <= 1" @click="page--">
            <ChevronLeft :size="17" aria-hidden="true" /> Anterior
          </button>
          <span>Página {{ page }} de {{ totalPages }}</span>
          <button type="button" :disabled="page >= totalPages" @click="page++">
            Siguiente <ChevronRight :size="17" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </template>

    <DocumentViewerModal
      v-if="previewTarget"
      :open="previewModalOpen"
      :title="`Nota de entrega #${previewTarget.numero}`"
      :subtitle="'Documento PDF · Tamaño Carta (216 × 279 mm) · Entrega total'"
      :downloading="downloadingPdf"
      :can-download-pdf="true"
      :pdf-url="documentUrl"
      :loading="documentLoading"
      :error="documentError"
      @close="closePdfViewer"
      @retry="loadDocument(previewTarget.id)"
      @download="handleDownload(previewTarget.id)"
    />
  </div>
</template>

<style scoped>
.delivery-notes-list {
  min-width: 0;
}
.delivery-notes-list :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.delivery-filters {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  margin-bottom: 1rem;
}
.delivery-filters__main {
  display: grid;
  grid-template-columns: minmax(14rem, 2.2fr) minmax(9rem, 1fr) minmax(9rem, 1fr) auto;
  align-items: end;
  gap: 0.85rem;
}
.delivery-search,
.delivery-filter-date {
  min-width: 0;
}
.delivery-search :deep(.search),
.delivery-search :deep(.search input) {
  width: 100%;
  min-width: 0;
}
.delivery-search :deep(.search input) {
  min-height: 2.6rem;
  font-size: 0.89rem;
}
.delivery-clear-btn {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  flex: none;
}
.delivery-date-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.85rem;
  font-weight: 600;
}
.delivery-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 0 0.8rem;
}
.delivery-results p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}
.delivery-results > span {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.delivery-table {
  min-width: 0;
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-table-row-odd);
}
.delivery-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.delivery-table thead {
  background: var(--color-table-header-bg);
}
.col-note {
  width: 24%;
}
.col-origin {
  width: 30%;
}
.col-date {
  width: 20%;
}
.col-coverage {
  width: 16%;
}
.col-actions {
  width: 10%;
}
.delivery-table th,
.delivery-table td {
  text-align: left;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
  vertical-align: middle;
}
.delivery-table th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  font-size: 0.76rem;
  font-weight: 650;
  border-top: 0;
}
.delivery-table thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.delivery-table thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.delivery-table tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.delivery-table tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.delivery-table tbody tr:last-child td {
  border-bottom: 0;
}
.delivery-table tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.note-identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.note-badge {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  border: 1px solid color-mix(in srgb, var(--color-success) 35%, transparent);
  background: var(--color-success-soft);
  color: var(--color-success);
}
.note-identity__text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.note-code {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.note-code:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.note-subtitle {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}
.origin-content {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}
.origin-info {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.origin-info strong {
  color: var(--color-text);
  font-size: 0.87rem;
  font-weight: 650;
  line-height: 1.3;
  white-space: normal;
  overflow-wrap: anywhere;
}
.origin-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.origin-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--color-primary-accent);
  font-size: 0.77rem;
  font-weight: 650;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.origin-chip:hover {
  text-decoration: underline;
}
.origin-proforma {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}
.delivery-table td.actions-cell,
.delivery-table th.actions-heading {
  text-align: right;
  padding-right: 1rem;
}
.delivery-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.delivery-pagination p {
  margin: 0;
}
.delivery-pagination__buttons {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.delivery-pagination button {
  min-height: 2.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 650;
  cursor: pointer;
}
.delivery-pagination button:not(:disabled):hover {
  background: var(--color-surface-hover);
}
.delivery-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 72rem) {
  .delivery-filters__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .delivery-search {
    grid-column: 1 / -1;
  }
  .delivery-table th,
  .delivery-table td {
    padding: 0.75rem 0.65rem;
  }
}
@media (max-width: 53rem) {
  .delivery-table {
    background: transparent;
    border: 0;
  }
  .delivery-table colgroup,
  .delivery-table thead {
    display: none;
  }
  .delivery-table tbody {
    display: grid;
    gap: 0.75rem;
  }
  .delivery-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem 1rem;
    padding: 1rem;
    border: 1px solid var(--color-table-border);
    border-radius: var(--radius-card);
  }
  .delivery-table tbody tr:nth-child(odd) {
    background-color: var(--color-table-row-odd);
  }
  .delivery-table tbody tr:nth-child(even) {
    background-color: var(--color-table-row-even);
  }
  .delivery-table tbody td {
    display: block;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .note-cell {
    grid-column: 1;
  }
  .coverage-cell {
    grid-column: 2;
    text-align: right;
  }
  .origin-cell {
    grid-column: 1 / -1;
    padding-top: 0.35rem;
    border-top: 1px solid var(--color-border);
  }
  .date-cell {
    grid-column: 1;
  }
  .delivery-table td.actions-cell {
    grid-column: 2;
    padding-right: 0;
    text-align: right;
  }
}
@media (max-width: 36rem) {
  .delivery-filters__main {
    grid-template-columns: 1fr;
  }
  .delivery-search {
    grid-column: auto;
  }
  .delivery-results > span {
    display: none;
  }
  .delivery-pagination {
    justify-content: center;
  }
}
</style>
