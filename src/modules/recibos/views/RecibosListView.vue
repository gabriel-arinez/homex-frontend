<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Receipt,
  RotateCcw,
} from '@lucide/vue'
import type { Recibo, ValorCatalogoPublico } from '@/generated/api'
import DocumentViewerModal from '@/modules/proformas/components/DocumentViewerModal.vue'
import { fechaComercial } from '@/shared/date/presentacionFecha'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import { recibosService } from '../services/recibosService'
import ReceiptActionsMenu from '../components/ReceiptActionsMenu.vue'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ClientAvatar from '@/shared/ui/ClientAvatar.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
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

const rows = ref<Recibo[]>([])
const paymentTypes = ref<ValorCatalogoPublico[]>([])
const loading = ref(true)
const error = ref('')
const toastMessage = ref('')
const toastTone = ref<'success' | 'danger'>('success')

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const stateFilter = ref(typeof route.query.estado === 'string' ? route.query.estado : '')
const paymentFilter = ref(typeof route.query.tipo_pago === 'string' ? route.query.tipo_pago : '')
const dateFrom = ref(routeDate('desde'))
const dateTo = ref(routeDate('hasta'))
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 10
const dateError = computed(() => dateRangeError(dateFrom.value, dateTo.value, today))

const money = (v: string | number) => {
  const amount = Number(v)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount)
}

function paymentTypeName(id: number): string {
  return paymentTypes.value.find((item) => item.id === id)?.nombre ?? `Tipo #${id}`
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
  return rows.value.filter((rec) => {
    if (stateFilter.value && rec.estado !== stateFilter.value) return false
    if (paymentFilter.value && String(rec.tipo_pago) !== paymentFilter.value) return false
    if (!dateError.value) {
      const isoDay = toIsoDate(rec.fecha)
      if (dateFrom.value && isoDay && isoDay < dateFrom.value) return false
      if (dateTo.value && isoDay && isoDay > dateTo.value) return false
    }
    if (!term) return true
    const clean = term.startsWith('#') ? term.slice(1) : term
    return (
      String(rec.numero).includes(clean) ||
      String(rec.pedido).includes(clean) ||
      rec.nombre_completo.toLowerCase().includes(term) ||
      rec.concepto.toLowerCase().includes(term) ||
      (rec.banco ?? '').toLowerCase().includes(term) ||
      (rec.numero_cheque ?? '').toLowerCase().includes(term)
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
    paymentFilter.value ||
    dateFrom.value ||
    dateTo.value,
  ),
)

const activeFilterChips = computed(() => {
  const items: { key: string; label: string }[] = []
  if (search.value.trim()) items.push({ key: 'search', label: `Búsqueda: ${search.value.trim()}` })
  if (stateFilter.value) {
    items.push({
      key: 'state',
      label: `Estado: ${stateFilter.value === 'EMITIDO' ? 'Emitidos' : 'Anulados'}`,
    })
  }
  if (paymentFilter.value) {
    items.push({
      key: 'payment',
      label: `Pago: ${paymentTypeName(Number(paymentFilter.value))}`,
    })
  }
  if (dateFrom.value) items.push({ key: 'from', label: `Desde: ${dateFrom.value}` })
  if (dateTo.value) items.push({ key: 'to', label: `Hasta: ${dateTo.value}` })
  return items
})

function syncRoute() {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (stateFilter.value) query.estado = stateFilter.value
  if (paymentFilter.value) query.tipo_pago = paymentFilter.value
  if (dateFrom.value) query.desde = dateFrom.value
  if (dateTo.value) query.hasta = dateTo.value
  if (page.value > 1) query.pagina = String(page.value)
  void router.replace({ query })
}

function clearFilters() {
  search.value = ''
  stateFilter.value = ''
  paymentFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
}

function removeFilter(key: string) {
  if (key === 'search') search.value = ''
  if (key === 'state') stateFilter.value = ''
  if (key === 'payment') paymentFilter.value = ''
  if (key === 'from') dateFrom.value = ''
  if (key === 'to') dateTo.value = ''
}

watch([search, stateFilter, paymentFilter, dateFrom, dateTo], () => {
  page.value = 1
  syncRoute()
})

watch(page, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
  syncRoute()
})

const previewOpen = ref(false)
const previewRecibo = ref<Recibo | null>(null)
const downloadingPdf = ref(false)
const {
  blob: pdfBlob,
  url: pdfUrl,
  loading: pdfLoading,
  error: pdfError,
  load: loadPdf,
  clear: clearPdf,
} = usePdfDocument(recibosService.documentPdf)

async function openPreview(id: number) {
  const target = rows.value.find((row) => row.id === id)
  if (!target) return
  previewRecibo.value = target
  previewOpen.value = true
  await loadPdf(id)
}

function closePreview() {
  previewOpen.value = false
  previewRecibo.value = null
  clearPdf()
}

async function handleDownload(id: number) {
  const target = rows.value.find((row) => row.id === id)
  if (!target || downloadingPdf.value) return
  downloadingPdf.value = true
  try {
    const file =
      previewOpen.value && previewRecibo.value?.id === id && pdfBlob.value
        ? pdfBlob.value
        : await loadPdf(id)
    if (!file) throw new Error(pdfError.value || 'No se pudo descargar el recibo.')
    downloadBlob(file, `recibo-${target.numero}.pdf`)
    if (!previewOpen.value) clearPdf()
    toastTone.value = 'success'
    toastMessage.value = `Recibo #${target.numero} descargado en PDF.`
  } catch (cause) {
    toastTone.value = 'danger'
    toastMessage.value = cause instanceof Error ? cause.message : 'No se pudo descargar el recibo.'
  } finally {
    downloadingPdf.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [receiptsRes, typesRes] = await Promise.allSettled([
      recibosService.list(),
      recibosService.paymentTypes(),
    ])
    if (receiptsRes.status === 'fulfilled') {
      rows.value = receiptsRes.value
      if (page.value > totalPages.value) page.value = totalPages.value
    } else {
      throw receiptsRes.reason
    }
    paymentTypes.value = typesRes.status === 'fulfilled' ? typesRes.value : []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los recibos.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="receipts-list">
    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      :tone="toastTone"
      @close="toastMessage = ''"
    />

    <PageHeader
      title="Recibos"
      description="Historial inmutable de cobros registrados."
      show-menu
      @menu="emit('openMenu')"
    />

    <section class="receipt-filters" aria-label="Buscar y filtrar recibos">
      <div class="receipt-filters__main">
        <div class="receipt-search">
          <SearchField v-model="search" label="Buscar por # recibo, pedido, cliente o concepto" />
        </div>
        <div class="receipt-filter-select">
          <Select
            v-model="stateFilter"
            name="estado-recibo"
            label="Estado"
            :options="[
              { label: 'Todos', value: '' },
              { label: 'Emitidos', value: 'EMITIDO' },
              { label: 'Anulados', value: 'ANULADO' },
            ]"
          />
        </div>
        <div class="receipt-filter-select">
          <Select
            v-model="paymentFilter"
            name="tipo-pago-recibo"
            label="Tipo de pago"
            :options="[
              { label: 'Todos', value: '' },
              ...paymentTypes.map((t) => ({ label: t.nombre, value: String(t.id) })),
            ]"
          />
        </div>
        <div class="receipt-filter-date">
          <TextField
            v-model="dateFrom"
            name="fecha-desde-recibo"
            label="Desde"
            type="date"
            :max="dateTo && dateTo < today ? dateTo : today"
          />
        </div>
        <div class="receipt-filter-date">
          <TextField
            v-model="dateTo"
            name="fecha-hasta-recibo"
            label="Hasta"
            type="date"
            :min="dateFrom || undefined"
            :max="today"
          />
        </div>
        <Button
          v-if="hasFilters"
          variant="secondary"
          class="receipt-clear-btn"
          aria-label="Limpiar filtros"
          title="Limpiar filtros"
          @click="clearFilters"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </Button>
      </div>
      <p v-if="dateError" class="receipt-date-error" role="alert">{{ dateError }}</p>
      <ActiveFilters
        v-if="activeFilterChips.length"
        :filters="activeFilterChips"
        @remove="removeFilter"
        @clear="clearFilters"
      />
    </section>

    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="!filtered.length"
      :title="hasFilters ? 'Sin coincidencias' : 'Sin recibos'"
      :description="
        hasFilters
          ? 'No encontramos recibos con los filtros actuales.'
          : 'Los recibos se emiten desde un pedido confirmado.'
      "
    >
      <Button v-if="hasFilters" variant="secondary" @click="clearFilters">Limpiar filtros</Button>
    </EmptyState>
    <template v-else>
      <div class="receipt-results">
        <p>{{ total }} recibo{{ total === 1 ? '' : 's' }}</p>
        <span>Control de cobros HOMEX</span>
      </div>

      <div class="receipt-table">
        <table>
          <caption class="sr-only">
            Listado de recibos
          </caption>
          <colgroup>
            <col class="col-receipt" />
            <col class="col-payer" />
            <col class="col-date" />
            <col class="col-amounts" />
            <col class="col-status-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Recibo y concepto</th>
              <th scope="col">Pagador y pedido</th>
              <th scope="col">Emisión</th>
              <th scope="col" class="numeric">Importes</th>
              <th scope="col" class="actions-heading">Estado y acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paginated" :key="row.id">
              <td class="receipt-cell">
                <div class="receipt-identity">
                  <span
                    class="receipt-badge"
                    :class="
                      row.estado === 'ANULADO' ? 'receipt-badge--danger' : 'receipt-badge--success'
                    "
                  >
                    <Ban v-if="row.estado === 'ANULADO'" :size="16" aria-hidden="true" />
                    <Receipt v-else :size="16" aria-hidden="true" />
                  </span>
                  <div class="receipt-identity__text">
                    <RouterLink :to="`/recibos/${row.id}`" class="receipt-code">
                      Recibo #{{ row.numero }}
                    </RouterLink>
                    <span class="receipt-concept" :title="row.concepto">
                      {{ row.concepto }}
                    </span>
                  </div>
                </div>
              </td>

              <td class="payer-cell" data-label="Pagador y pedido">
                <div class="payer-content">
                  <ClientAvatar :name="row.nombre_completo" :size="34" />
                  <div class="payer-info">
                    <strong :title="row.nombre_completo">{{ row.nombre_completo }}</strong>
                    <div class="payer-meta">
                      <RouterLink :to="`/pedidos/${row.pedido}`" class="order-chip">
                        <ClipboardList :size="13" aria-hidden="true" />
                        Pedido #{{ row.pedido }}
                      </RouterLink>
                      <span class="payment-chip">
                        <CreditCard :size="12" aria-hidden="true" />
                        {{ paymentTypeName(row.tipo_pago) }}
                      </span>
                    </div>
                  </div>
                </div>
              </td>

              <td class="date-cell" data-label="Emisión">
                <span class="date-label">{{ fechaComercial(String(row.fecha)) }}</span>
              </td>

              <td class="amounts-cell numeric" data-label="Importes">
                <div class="amounts-stack">
                  <strong class="amount-paid">{{ money(row.pago_actual) }}</strong>
                  <span class="amount-sub">
                    A cuenta: {{ money(row.a_cuenta) }} · Saldo: {{ money(row.saldo) }}
                  </span>
                </div>
              </td>

              <td class="status-actions-cell" data-label="Estado y acciones">
                <div class="status-actions-wrap">
                  <Badge :tone="row.estado === 'ANULADO' ? 'danger' : 'success'">
                    {{ row.estado }}
                  </Badge>
                  <ReceiptActionsMenu
                    :id="row.id"
                    :numero="row.numero"
                    :pedido-id="row.pedido"
                    :estado="row.estado"
                    @download="handleDownload"
                    @preview="openPreview"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="receipt-pagination" aria-label="Paginación de recibos">
        <p>Mostrando {{ fromItem }}–{{ toItem }} de {{ total }} registros</p>
        <div v-if="totalPages > 1" class="receipt-pagination__buttons">
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
      :open="previewOpen"
      :title="previewRecibo ? `Recibo #${previewRecibo.numero}` : 'Comprobante de recibo'"
      subtitle="Hoja carta con Copia Cliente y Copia HOMEX listas para impresión."
      :pdf-url="pdfUrl"
      :loading="pdfLoading"
      :error="pdfError"
      :downloading="downloadingPdf"
      :can-download-pdf="Boolean(previewRecibo)"
      @close="closePreview"
      @download="previewRecibo && handleDownload(previewRecibo.id)"
      @retry="previewRecibo && loadPdf(previewRecibo.id)"
    />
  </div>
</template>

<style scoped>
.receipts-list {
  min-width: 0;
}
.receipts-list :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.receipt-filters {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  margin-bottom: 1rem;
}
.receipt-filters__main {
  display: grid;
  grid-template-columns:
    minmax(13rem, 2fr)
    minmax(8.5rem, 1fr)
    minmax(9.5rem, 1fr)
    minmax(8rem, 0.85fr)
    minmax(8rem, 0.85fr)
    auto;
  align-items: end;
  gap: 0.85rem;
}
.receipt-search,
.receipt-filter-select,
.receipt-filter-date {
  min-width: 0;
}
.receipt-search :deep(.search),
.receipt-search :deep(.search input),
.receipt-filter-select :deep(.select select) {
  width: 100%;
  min-width: 0;
}
.receipt-search :deep(.search input) {
  min-height: 2.6rem;
  font-size: 0.89rem;
}
.receipt-clear-btn {
  min-height: 2.6rem;
  padding: 0 0.75rem;
}
.receipt-date-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.85rem;
  font-weight: 600;
}
.receipt-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 0 0.8rem;
}
.receipt-results p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}
.receipt-results > span {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.receipt-table {
  min-width: 0;
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-table-row-odd);
}
.receipt-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.receipt-table thead {
  background: var(--color-table-header-bg);
}
.col-receipt {
  width: 23%;
}
.col-payer {
  width: 26%;
}
.col-date {
  width: 15%;
}
.col-amounts {
  width: 21%;
}
.col-status-actions {
  width: 15%;
}
.receipt-table th,
.receipt-table td {
  text-align: left;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
  vertical-align: middle;
}
.receipt-table th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  font-size: 0.76rem;
  font-weight: 650;
  border-top: 0;
}
.receipt-table th.numeric,
.receipt-table td.numeric {
  text-align: right;
}
.receipt-table th.actions-heading {
  text-align: right;
}
.receipt-table thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.receipt-table thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.receipt-table tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.receipt-table tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.receipt-table tbody tr:last-child td {
  border-bottom: 0;
}
.receipt-table tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.receipt-identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.receipt-badge {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
}
.receipt-badge--success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.receipt-badge--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.receipt-identity__text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.receipt-code {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.receipt-code:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.receipt-concept {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.payer-content {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}
.payer-info {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.payer-info strong {
  color: var(--color-text);
  font-size: 0.87rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.payer-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.order-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--color-primary-accent);
  font-size: 0.77rem;
  font-weight: 650;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.order-chip:hover {
  text-decoration: underline;
}
.payment-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
}
.amounts-stack {
  display: grid;
  gap: 0.18rem;
  justify-items: end;
}
.amount-paid {
  font-size: 0.92rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.amount-sub {
  color: var(--color-text-secondary);
  font-size: 0.73rem;
  font-variant-numeric: tabular-nums;
}
.status-actions-wrap {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}
.receipt-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.receipt-pagination p {
  margin: 0;
}
.receipt-pagination__buttons {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.receipt-pagination button {
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
.receipt-pagination button:not(:disabled):hover {
  background: var(--color-surface-hover);
}
.receipt-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 78rem) {
  .receipt-filters__main {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .receipt-search {
    grid-column: 1 / -1;
  }
}
@media (max-width: 64rem) {
  .receipt-filters__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .receipt-table th,
  .receipt-table td {
    padding: 0.75rem 0.65rem;
  }
}
@media (max-width: 53rem) {
  .receipt-table {
    background: transparent;
    border: 0;
  }
  .receipt-table colgroup,
  .receipt-table thead {
    display: none;
  }
  .receipt-table tbody {
    display: grid;
    gap: 0.75rem;
  }
  .receipt-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem 1rem;
    padding: 1rem;
    border: 1px solid var(--color-table-border);
    border-radius: var(--radius-card);
  }
  .receipt-table tbody tr:nth-child(odd) {
    background-color: var(--color-table-row-odd);
  }
  .receipt-table tbody tr:nth-child(even) {
    background-color: var(--color-table-row-even);
  }
  .receipt-table tbody td {
    display: block;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .receipt-cell {
    grid-column: 1;
  }
  .status-actions-cell {
    grid-column: 2;
  }
  .payer-cell {
    grid-column: 1 / -1;
    padding-top: 0.35rem;
    border-top: 1px solid var(--color-border);
  }
  .date-cell {
    grid-column: 1;
  }
  .amounts-cell {
    grid-column: 2;
    text-align: right;
  }
  .amounts-stack {
    justify-items: end;
  }
}
@media (max-width: 36rem) {
  .receipt-filters__main {
    grid-template-columns: 1fr;
  }
  .receipt-search {
    grid-column: auto;
  }
  .receipt-results > span {
    display: none;
  }
  .receipt-pagination {
    justify-content: center;
  }
}
</style>
