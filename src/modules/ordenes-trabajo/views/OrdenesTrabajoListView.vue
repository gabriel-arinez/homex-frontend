<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Hammer,
  MapPin,
  PackageCheck,
  RotateCcw,
  Truck,
} from '@lucide/vue'
import type { OrdenTrabajo, ProformaListado } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import DocumentViewerModal from '@/modules/proformas/components/DocumentViewerModal.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { buildExportFilename } from '@/shared/download/exportFilename'
import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import { ordenesTrabajoService } from '../services/ordenesTrabajoService'
import WorkOrderActionsMenu from '../components/WorkOrderActionsMenu.vue'
import Button from '@/shared/ui/Button.vue'
import ClientAvatar from '@/shared/ui/ClientAvatar.vue'
import DatePresentation from '@/shared/ui/DatePresentation.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import TextField from '@/shared/ui/TextField.vue'
import Toast from '@/shared/ui/Toast.vue'
import { dateRangeError, isValidDate, localToday } from '@/shared/validation/dateRange'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const canOperateCommercial = computed(() => session.can('comercial.operar'))
const today = localToday()
const routeDate = (key: string) => {
  const val = typeof route.query[key] === 'string' ? String(route.query[key]) : ''
  return isValidDate(val) ? val : ''
}

const rows = ref<OrdenTrabajo[]>([])
const proformasByNumero = ref<Record<number, ProformaListado>>({})
const loading = ref(true)
const error = ref('')
const toastMessage = ref('')
const toastTone = ref<'success' | 'danger'>('success')

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const stateFilter = ref(typeof route.query.estado === 'string' ? route.query.estado : '')
const workTypeFilter = ref(typeof route.query.tipo === 'string' ? route.query.tipo : '')
const dateFrom = ref(routeDate('desde'))
const dateTo = ref(routeDate('hasta'))
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 10
const dateError = computed(() => dateRangeError(dateFrom.value, dateTo.value, today))

const availableStates = computed(() => {
  const map = new Map<string, string>()
  for (const item of rows.value) {
    if (item.estado_info?.codigo) {
      map.set(item.estado_info.codigo, item.estado_info.nombre)
    }
  }
  return Array.from(map.entries()).map(([codigo, nombre]) => ({ codigo, nombre }))
})

function isFabricationLine(line: NonNullable<OrdenTrabajo['detalles']>[number]): boolean {
  return line.tipo_item_info?.codigo === 'MUEBLE_MEDIDA' || Boolean(line.especificacion)
}

function hasFabrication(ot: OrdenTrabajo): boolean {
  return (ot.detalles ?? []).some(isFabricationLine)
}

function workSummary(ot: OrdenTrabajo): string {
  const detalles = ot.detalles ?? []
  if (!detalles.length) return 'Sin líneas registradas'
  const fabCount = detalles.filter(isFabricationLine).length
  const totalCount = detalles.length
  const base = `${totalCount} ítem${totalCount === 1 ? '' : 's'}`
  if (fabCount > 0) return `${base} · ${fabCount} a medida`
  return `${base} · Catálogo`
}

function proformaOf(ot: OrdenTrabajo): ProformaListado | undefined {
  return proformasByNumero.value[ot.proforma_numero]
}

function clientName(ot: OrdenTrabajo): string {
  return (
    ot.cliente_resumen?.empresa?.trim() ||
    ot.cliente_resumen?.nombre?.trim() ||
    proformaOf(ot)?.cliente_resumen?.empresa?.trim() ||
    proformaOf(ot)?.cliente_resumen?.nombre?.trim() ||
    ''
  )
}

function quoteTitle(ot: OrdenTrabajo): string {
  return ot.proforma_titulo?.trim() || proformaOf(ot)?.titulo?.trim() || workSummary(ot)
}

function workOrderStatusIcon(code: string) {
  const normalized = code.toUpperCase()
  if (normalized.includes('PENDIENTE')) return Clock3
  if (
    normalized.includes('PRODUCCION') ||
    normalized.includes('TALLER') ||
    normalized.includes('PROCESO')
  ) {
    return Hammer
  }
  if (
    normalized.includes('LISTO') ||
    normalized.includes('TERMINAD') ||
    normalized.includes('FINALIZAD')
  ) {
    return PackageCheck
  }
  if (normalized.includes('ENTREGAD') || normalized.includes('COMPLETAD')) return CheckCircle2
  return ClipboardList
}

function workOrderTone(code: string): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  const normalized = code.toUpperCase()
  if (normalized.includes('CANCEL') || normalized.includes('ANUL')) return 'danger'
  if (
    normalized.includes('ENTREGAD') ||
    normalized.includes('FINALIZAD') ||
    normalized.includes('LISTO')
  ) {
    return 'success'
  }
  if (
    normalized.includes('PRODUCCION') ||
    normalized.includes('TALLER') ||
    normalized.includes('PROCESO')
  ) {
    return 'warning'
  }
  if (normalized.includes('PENDIENTE')) return 'info'
  return 'neutral'
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
  return rows.value.filter((ot) => {
    if (!hasFabrication(ot)) return false
    if (stateFilter.value && ot.estado_info?.codigo !== stateFilter.value) return false
    if (workTypeFilter.value === 'fabricacion' && !hasFabrication(ot)) return false
    if (workTypeFilter.value === 'catalogo' && hasFabrication(ot)) return false
    if (!dateError.value) {
      const isoDay = toIsoDate(ot.fecha)
      if (dateFrom.value && isoDay && isoDay < dateFrom.value) return false
      if (dateTo.value && isoDay && isoDay > dateTo.value) return false
    }
    if (!term) return true
    const clean = term.startsWith('#') ? term.slice(1) : term
    const client = clientName(ot).toLowerCase()
    const title = quoteTitle(ot).toLowerCase()
    const place = (ot.lugar_entrega ?? '').toLowerCase()
    return (
      String(ot.numero).includes(clean) ||
      String(ot.pedido).includes(clean) ||
      String(ot.proforma_numero).includes(clean) ||
      client.includes(term) ||
      title.includes(term) ||
      place.includes(term)
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

const hasFilters = computed(() =>
  Boolean(
    search.value.trim() ||
    stateFilter.value ||
    workTypeFilter.value ||
    dateFrom.value ||
    dateTo.value,
  ),
)

function syncRoute() {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (stateFilter.value) query.estado = stateFilter.value
  if (workTypeFilter.value) query.tipo = workTypeFilter.value
  if (dateFrom.value) query.desde = dateFrom.value
  if (dateTo.value) query.hasta = dateTo.value
  if (page.value > 1) query.pagina = String(page.value)
  void router.replace({ query })
}

function clearFilters() {
  search.value = ''
  stateFilter.value = ''
  workTypeFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
}

watch([search, stateFilter, workTypeFilter, dateFrom, dateTo], () => {
  page.value = 1
  syncRoute()
})

watch(page, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
  syncRoute()
})

async function loadQuoteContext() {
  if (!canOperateCommercial.value) {
    proformasByNumero.value = {}
    return
  }
  if (
    rows.value.length > 0 &&
    rows.value.every((ot) => ot.cliente_resumen !== undefined || ot.proforma_titulo !== undefined)
  ) {
    return
  }
  try {
    const response = await proformasService.list({ page_size: 100 })
    const map: Record<number, ProformaListado> = {}
    for (const item of response.results) {
      map[item.numero] = item
    }
    proformasByNumero.value = map
  } catch {
    proformasByNumero.value = {}
  }
}

const previewModalOpen = ref(false)
const previewTarget = ref<OrdenTrabajo | null>(null)
const downloadingPdf = ref(false)

const {
  blob: documentBlob,
  url: documentUrl,
  loading: documentLoading,
  error: documentError,
  load: loadDocument,
  clear: clearDocument,
} = usePdfDocument((orderId) => ordenesTrabajoService.documentPdf(orderId))

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
        'orden-trabajo',
        [
          target.numero,
          `pedido-${target.pedido}`,
          target.cliente_resumen?.nombre || target.cliente_resumen?.empresa,
        ],
        'pdf',
      ),
    )
    toastTone.value = 'success'
    toastMessage.value = `Orden de trabajo #${target.numero} descargada.`
  } catch (cause) {
    toastTone.value = 'danger'
    toastMessage.value =
      cause instanceof Error ? cause.message : 'No se pudo descargar la orden de trabajo.'
  } finally {
    downloadingPdf.value = false
    if (!opened) clearDocument()
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await ordenesTrabajoService.list()
    if (page.value > totalPages.value) page.value = totalPages.value
    void loadQuoteContext()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las órdenes.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="work-orders-list">
    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      :tone="toastTone"
      @close="toastMessage = ''"
    />

    <PageHeader
      title="Órdenes de trabajo"
      description="Preparación y fabricación asociada a pedidos confirmados."
      show-menu
      @menu="emit('openMenu')"
    />

    <section class="ot-filters" aria-label="Buscar y filtrar órdenes de trabajo">
      <div class="ot-filters__main">
        <div class="ot-search">
          <SearchField v-model="search" label="Buscar por OT, pedido, proforma o cliente" />
        </div>
        <div class="ot-filter-select">
          <Select
            v-model="stateFilter"
            name="estado-ot"
            label="Estado"
            :active="Boolean(stateFilter)"
            :options="[
              { label: 'Todos', value: '' },
              ...availableStates.map((s) => ({ label: s.nombre, value: s.codigo })),
            ]"
          />
        </div>
        <div class="ot-filter-select">
          <Select
            v-model="workTypeFilter"
            name="tipo-trabajo-ot"
            label="Trabajo"
            :active="Boolean(workTypeFilter)"
            :options="[
              { label: 'Todos', value: '' },
              { label: 'Con fabricación a medida', value: 'fabricacion' },
              { label: 'Solo catálogo', value: 'catalogo' },
            ]"
          />
        </div>
        <div class="ot-filter-date">
          <TextField
            v-model="dateFrom"
            name="fecha-desde-ot"
            label="Desde"
            type="date"
            :active="Boolean(dateFrom)"
            :max="dateTo && dateTo < today ? dateTo : today"
          />
        </div>
        <div class="ot-filter-date">
          <TextField
            v-model="dateTo"
            name="fecha-hasta-ot"
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
          class="ot-clear-btn"
          aria-label="Limpiar filtros"
          title="Limpiar filtros"
          @click="clearFilters"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </Button>
      </div>
      <p v-if="dateError" class="ot-date-error" role="alert">{{ dateError }}</p>
    </section>

    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="!filtered.length"
      :title="hasFilters ? 'Sin coincidencias' : 'Sin órdenes'"
      :description="
        hasFilters
          ? 'No encontramos órdenes de trabajo con los filtros actuales.'
          : 'No hay órdenes de trabajo para mostrar.'
      "
    >
      <Button v-if="hasFilters" variant="secondary" @click="clearFilters">Limpiar filtros</Button>
    </EmptyState>
    <template v-else>
      <div class="ot-results">
        <p>{{ total }} {{ total === 1 ? 'orden de trabajo' : 'órdenes de trabajo' }}</p>
        <span>Planificación de taller HOMEX</span>
      </div>
      <div class="ot-table">
        <table>
          <caption class="sr-only">
            Órdenes de trabajo
          </caption>
          <colgroup>
            <col class="col-ot" />
            <col class="col-origin" />
            <col class="col-schedule" />
            <col class="col-status" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Orden de trabajo</th>
              <th scope="col">Cliente y origen</th>
              <th scope="col">Fecha y entrega</th>
              <th scope="col">Estado</th>
              <th scope="col" class="actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paginated" :key="row.id">
              <td class="ot-cell">
                <div class="ot-identity">
                  <span
                    class="ot-badge"
                    :class="`ot-badge--${workOrderTone(row.estado_info.codigo)}`"
                  >
                    <component
                      :is="workOrderStatusIcon(row.estado_info.codigo)"
                      :size="16"
                      aria-hidden="true"
                    />
                  </span>
                  <div class="ot-identity__text">
                    <RouterLink :to="`/ordenes-trabajo/${row.id}`" class="ot-code">
                      OT #{{ row.numero }}
                    </RouterLink>
                    <span class="ot-subtitle" :title="quoteTitle(row)">
                      {{ quoteTitle(row) }}
                    </span>
                  </div>
                </div>
              </td>
              <td class="origin-cell" data-label="Cliente y origen">
                <div class="origin-content">
                  <ClientAvatar v-if="clientName(row)" :name="clientName(row)" :size="34" />
                  <div class="origin-info">
                    <strong v-if="clientName(row)" :title="clientName(row)">
                      {{ clientName(row) }}
                    </strong>
                    <div class="origin-links">
                      <RouterLink
                        v-if="canOperateCommercial"
                        :to="`/pedidos/${row.pedido}`"
                        class="origin-chip"
                      >
                        <ClipboardList :size="13" aria-hidden="true" />
                        Pedido #{{ row.pedido }}
                      </RouterLink>
                      <span v-else class="origin-proforma">
                        <ClipboardList :size="12" aria-hidden="true" />
                        Pedido #{{ row.pedido }}
                      </span>
                      <span class="origin-proforma">
                        <FileText :size="12" aria-hidden="true" />
                        Prof. #{{ row.proforma_numero }}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="date-cell" data-label="Fecha y entrega">
                <div class="schedule-stack">
                  <DatePresentation :timestamp="String(row.fecha)" :date="String(row.fecha)" />
                  <span v-if="row.fecha_entrega || row.lugar_entrega" class="schedule-meta">
                    <Truck v-if="row.fecha_entrega" :size="12" aria-hidden="true" />
                    <MapPin v-else :size="12" aria-hidden="true" />
                    {{ row.fecha_entrega || row.lugar_entrega }}
                  </span>
                </div>
              </td>
              <td class="status-cell" data-label="Estado">
                <div class="status-stack">
                  <StatusBadge :status="row.estado_info.codigo" :label="row.estado_info.nombre" />
                  <span v-if="row.estado_saldo_info" class="balance-note">
                    Saldo: {{ row.estado_saldo_info.nombre }}
                  </span>
                </div>
              </td>
              <td class="actions-cell">
                <WorkOrderActionsMenu
                  :id="row.id"
                  :numero="row.numero"
                  :pedido-id="row.pedido"
                  :can-view-order="canOperateCommercial"
                  @open-pdf="openPdfViewer"
                  @download="handleDownload"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="ot-pagination" aria-label="Paginación de órdenes de trabajo">
        <p>Mostrando {{ fromItem }}–{{ toItem }} de {{ total }} registros</p>
        <div v-if="totalPages > 1" class="ot-pagination__buttons">
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
      :title="`Orden de trabajo #${previewTarget.numero}`"
      :subtitle="`Documento PDF · Tamaño Carta (216 × 279 mm) · ${previewTarget.estado_info.nombre}`"
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
.work-orders-list {
  min-width: 0;
}
.work-orders-list :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.ot-filters {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  margin-bottom: 1rem;
}
.ot-filters__main {
  display: grid;
  grid-template-columns:
    minmax(13rem, 2fr) minmax(8.5rem, 1fr) minmax(9.5rem, 1fr) minmax(8rem, 0.85fr) minmax(
      8rem,
      0.85fr
    )
    auto;
  align-items: end;
  gap: 0.85rem;
}
.ot-search,
.ot-filter-select,
.ot-filter-date {
  min-width: 0;
}
.ot-search :deep(.search),
.ot-search :deep(.search input),
.ot-filter-select :deep(.select select) {
  width: 100%;
  min-width: 0;
}
.ot-search :deep(.search input) {
  min-height: 2.6rem;
  font-size: 0.89rem;
}
.ot-clear-btn {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  flex: none;
}
.ot-date-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.85rem;
  font-weight: 600;
}
.ot-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 0 0.8rem;
}
.ot-results p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}
.ot-results > span {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.ot-table {
  min-width: 0;
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-table-row-odd);
}
.ot-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.ot-table thead {
  background: var(--color-table-header-bg);
}
.col-ot {
  width: 24%;
}
.col-origin {
  width: 28%;
}
.col-schedule {
  width: 22%;
}
.col-status {
  width: 16%;
}
.col-actions {
  width: 10%;
}
.ot-table th,
.ot-table td {
  text-align: left;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
  vertical-align: middle;
}
.ot-table th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  font-size: 0.76rem;
  font-weight: 650;
  border-top: 0;
}
.ot-table thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.ot-table thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.ot-table tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.ot-table tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.ot-table tbody tr:last-child td {
  border-bottom: 0;
}
.ot-table tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.ot-identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.ot-badge {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
}
.ot-badge--info {
  background: var(--color-info-soft);
  color: var(--color-info);
  border-color: color-mix(in srgb, var(--color-info) 35%, transparent);
}
.ot-badge--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
}
.ot-badge--success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.ot-badge--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.ot-badge--neutral {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}
.ot-badge svg {
  color: currentColor;
}
.ot-identity__text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.ot-code {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.ot-code:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.ot-subtitle {
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
.schedule-stack {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}
.schedule-meta {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}
.schedule-meta svg {
  flex: none;
}
.status-stack {
  display: grid;
  gap: 0.25rem;
  justify-items: start;
}
.balance-note {
  color: var(--color-text-secondary);
  font-size: 0.73rem;
}
.ot-table td.actions-cell,
.ot-table th.actions-heading {
  text-align: right;
  padding-right: 1rem;
}
.ot-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.ot-pagination p {
  margin: 0;
}
.ot-pagination__buttons {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.ot-pagination button {
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
.ot-pagination button:not(:disabled):hover {
  background: var(--color-surface-hover);
}
.ot-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 72rem) {
  .ot-filters__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ot-search {
    grid-column: 1 / -1;
  }
  .ot-table th,
  .ot-table td {
    padding: 0.75rem 0.65rem;
  }
}
@media (max-width: 53rem) {
  .ot-table {
    background: transparent;
    border: 0;
  }
  .ot-table colgroup,
  .ot-table thead {
    display: none;
  }
  .ot-table tbody {
    display: grid;
    gap: 0.75rem;
  }
  .ot-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem 1rem;
    padding: 1rem;
    border: 1px solid var(--color-table-border);
    border-radius: var(--radius-card);
  }
  .ot-table tbody tr:nth-child(odd) {
    background-color: var(--color-table-row-odd);
  }
  .ot-table tbody tr:nth-child(even) {
    background-color: var(--color-table-row-even);
  }
  .ot-table tbody td {
    display: block;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .ot-cell {
    grid-column: 1;
  }
  .status-cell {
    grid-column: 2;
    text-align: right;
  }
  .status-stack {
    justify-items: end;
  }
  .origin-cell {
    grid-column: 1 / -1;
    padding-top: 0.35rem;
    border-top: 1px solid var(--color-border);
  }
  .date-cell {
    grid-column: 1;
  }
  .ot-table td.actions-cell {
    grid-column: 2;
    padding-right: 0;
    text-align: right;
  }
}
@media (max-width: 36rem) {
  .ot-filters__main {
    grid-template-columns: 1fr;
  }
  .ot-search {
    grid-column: auto;
  }
  .ot-results > span {
    display: none;
  }
  .ot-pagination {
    justify-content: center;
  }
}
</style>
