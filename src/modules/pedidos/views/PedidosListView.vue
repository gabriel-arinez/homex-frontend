<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Hammer,
  PackageCheck,
  RotateCcw,
  Truck,
} from '@lucide/vue'
import type { Pedido, ProformaListado, ValorCatalogoPublico } from '@/generated/api'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { pedidosService } from '../services/pedidosService'
import OrderActionsMenu from '../components/OrderActionsMenu.vue'
import Button from '@/shared/ui/Button.vue'
import ClientAvatar from '@/shared/ui/ClientAvatar.vue'
import CreatorTag from '@/shared/ui/CreatorTag.vue'
import DatePresentation from '@/shared/ui/DatePresentation.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import TextField from '@/shared/ui/TextField.vue'
import { dateRangeError, isValidDate, localToday } from '@/shared/validation/dateRange'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const today = localToday()
const routeDate = (key: string) => {
  const val = typeof route.query[key] === 'string' ? String(route.query[key]) : ''
  return isValidDate(val) ? val : ''
}

const rows = ref<Pedido[]>([])
const states = ref<ValorCatalogoPublico[]>([])
const proformasById = ref<Record<number, ProformaListado>>({})
const loading = ref(true)
const error = ref('')

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const stateFilter = ref(typeof route.query.estado === 'string' ? route.query.estado : '')
const dateFrom = ref(routeDate('desde'))
const dateTo = ref(routeDate('hasta'))
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 10
const dateError = computed(() => dateRangeError(dateFrom.value, dateTo.value, today))

const statusName = (id: number) => states.value.find((x) => x.id === id)?.nombre ?? `Estado ${id}`
const statusCode = (id: number) => states.value.find((x) => x.id === id)?.codigo ?? ''

function orderStatusIcon(code: string) {
  if (code === 'CONFIRMADO') return ClipboardCheck
  if (code === 'EN_PRODUCCION') return Hammer
  if (code === 'LISTO_ENTREGA') return PackageCheck
  if (code === 'ENTREGADO') return Truck
  if (code === 'CANCELADO') return Ban
  return ClipboardList
}

function orderStatusTone(code: string): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  if (code === 'CONFIRMADO' || code === 'LISTO_ENTREGA') return 'info'
  if (code === 'EN_PRODUCCION') return 'warning'
  if (code === 'ENTREGADO') return 'success'
  if (code === 'CANCELADO') return 'danger'
  return 'neutral'
}

function proformaOf(pedido: Pedido): ProformaListado | undefined {
  return proformasById.value[pedido.proforma]
}

function clientName(pedido: Pedido): string {
  return (
    pedido.cliente_resumen?.empresa?.trim() ||
    pedido.cliente_resumen?.nombre?.trim() ||
    proformaOf(pedido)?.cliente_resumen?.empresa?.trim() ||
    proformaOf(pedido)?.cliente_resumen?.nombre?.trim() ||
    ''
  )
}

function quoteTitle(pedido: Pedido): string {
  return (
    pedido.proforma_titulo?.trim() ||
    proformaOf(pedido)?.titulo?.trim() ||
    'Orden de venta confirmada'
  )
}

function toIsoDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return rows.value.filter((pedido) => {
    if (stateFilter.value && String(pedido.estado) !== stateFilter.value) return false
    if (!dateError.value) {
      const isoDay = toIsoDate(pedido.fecha_confirmacion)
      if (dateFrom.value && isoDay && isoDay < dateFrom.value) return false
      if (dateTo.value && isoDay && isoDay > dateTo.value) return false
    }
    if (!term) return true
    const clean = term.startsWith('#') ? term.slice(1) : term
    const client = clientName(pedido).toLowerCase()
    const title = quoteTitle(pedido).toLowerCase()
    return (
      String(pedido.id).includes(clean) ||
      String(pedido.proforma).includes(clean) ||
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

const hasFilters = computed(() =>
  Boolean(search.value.trim() || stateFilter.value || dateFrom.value || dateTo.value),
)

function syncRoute() {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (stateFilter.value) query.estado = stateFilter.value
  if (dateFrom.value) query.desde = dateFrom.value
  if (dateTo.value) query.hasta = dateTo.value
  if (page.value > 1) query.pagina = String(page.value)
  void router.replace({ query })
}

function clearFilters() {
  search.value = ''
  stateFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
}

watch([search, stateFilter, dateFrom, dateTo], () => {
  page.value = 1
  syncRoute()
})

watch(page, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
  syncRoute()
})

async function loadQuoteContext() {
  try {
    const response = await proformasService.list({ page_size: 100 })
    const map: Record<number, ProformaListado> = {}
    for (const item of response.results) {
      map[item.id] = item
    }
    proformasById.value = map
  } catch {
    proformasById.value = {}
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [pedidos, estados] = await Promise.all([
      pedidosService.list(),
      pedidosService.options('ESTADO_PEDIDO'),
    ])
    rows.value = pedidos
    states.value = estados
    if (page.value > totalPages.value) page.value = totalPages.value
    if (pedidos.some((p) => p.cliente_resumen === undefined && p.proforma_titulo === undefined)) {
      void loadQuoteContext()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="orders-list">
    <PageHeader
      title="Pedidos"
      description="Pedidos confirmados y su estado operativo real."
      show-menu
      @menu="emit('openMenu')"
    />

    <section class="order-filters" aria-label="Buscar y filtrar pedidos">
      <div class="order-filters__main">
        <div class="order-search">
          <SearchField v-model="search" label="Buscar por pedido, proforma o cliente" />
        </div>
        <div class="order-filter-select">
          <Select
            v-model="stateFilter"
            name="estado-pedido"
            label="Estado"
            :active="Boolean(stateFilter)"
            :options="[
              { label: 'Todos', value: '' },
              ...states.map((x) => ({ label: x.nombre, value: String(x.id) })),
            ]"
          />
        </div>
        <div class="order-filter-date">
          <TextField
            v-model="dateFrom"
            name="fecha-desde-pedido"
            label="Desde"
            type="date"
            :active="Boolean(dateFrom)"
            :max="dateTo && dateTo < today ? dateTo : today"
          />
        </div>
        <div class="order-filter-date">
          <TextField
            v-model="dateTo"
            name="fecha-hasta-pedido"
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
          class="order-clear-btn"
          aria-label="Limpiar filtros"
          title="Limpiar filtros"
          @click="clearFilters"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </Button>
      </div>
      <p v-if="dateError" class="order-date-error" role="alert">{{ dateError }}</p>
    </section>

    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="!filtered.length"
      :title="hasFilters ? 'Sin coincidencias' : 'Sin pedidos'"
      :description="
        hasFilters
          ? 'No encontramos pedidos con los filtros actuales.'
          : 'No hay pedidos para mostrar.'
      "
    >
      <Button v-if="hasFilters" variant="secondary" @click="clearFilters">Limpiar filtros</Button>
    </EmptyState>
    <template v-else>
      <div class="order-results">
        <p>{{ total }} pedido{{ total === 1 ? '' : 's' }}</p>
        <span>Control operativo HOMEX</span>
      </div>
      <div class="order-table">
        <table>
          <caption class="sr-only">
            Listado de pedidos
          </caption>
          <colgroup>
            <col class="col-order" />
            <col class="col-client" />
            <col class="col-date" />
            <col class="col-status" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Cliente y proforma</th>
              <th scope="col">Confirmación</th>
              <th scope="col">Estado</th>
              <th scope="col" class="actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paginated" :key="row.id">
              <td class="order-cell">
                <div class="order-identity">
                  <span
                    class="order-badge"
                    :class="`order-badge--${orderStatusTone(statusCode(row.estado))}`"
                  >
                    <component
                      :is="orderStatusIcon(statusCode(row.estado))"
                      :size="16"
                      aria-hidden="true"
                    />
                  </span>
                  <div class="order-identity__text">
                    <RouterLink :to="`/pedidos/${row.id}`" class="order-code">
                      Pedido #{{ row.id }}
                    </RouterLink>
                    <span class="order-subtitle" :title="quoteTitle(row)">
                      {{ quoteTitle(row) }}
                    </span>
                  </div>
                </div>
              </td>
              <td class="client-cell" data-label="Cliente y proforma">
                <div class="client-content">
                  <ClientAvatar :name="clientName(row)" :size="34" />
                  <div class="client-info">
                    <strong v-if="clientName(row)" :title="clientName(row)">
                      {{ clientName(row) }}
                    </strong>
                    <span v-else class="origin-client-empty">Cliente sin especificar</span>
                    <RouterLink :to="`/proformas/${row.proforma}/editar`" class="proforma-chip">
                      <FileText :size="13" aria-hidden="true" />
                      Proforma #{{ row.proforma }}
                    </RouterLink>
                    <CreatorTag
                      v-if="row.vendedor_resumen?.display_name"
                      :name="row.vendedor_resumen.display_name"
                    />
                  </div>
                </div>
              </td>
              <td class="date-cell" data-label="Confirmación">
                <DatePresentation :timestamp="row.fecha_confirmacion" />
              </td>
              <td class="status-cell" data-label="Estado">
                <StatusBadge :status="statusCode(row.estado)" :label="statusName(row.estado)" />
              </td>
              <td class="actions-cell">
                <OrderActionsMenu
                  :id="row.id"
                  :proforma-id="row.proforma"
                  :estado-codigo="statusCode(row.estado)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="order-pagination" aria-label="Paginación de pedidos">
        <p>Mostrando {{ fromItem }}–{{ toItem }} de {{ total }} registros</p>
        <div v-if="totalPages > 1" class="order-pagination__buttons">
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
  </div>
</template>

<style scoped>
.orders-list {
  min-width: 0;
}
.orders-list :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.order-filters {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  margin-bottom: 1rem;
}
.order-filters__main {
  display: grid;
  grid-template-columns:
    minmax(14rem, 2fr) minmax(9.5rem, 1fr) minmax(8.5rem, 0.9fr) minmax(8.5rem, 0.9fr)
    auto;
  align-items: end;
  gap: 0.85rem;
}
.order-search,
.order-filter-select,
.order-filter-date {
  min-width: 0;
}
.order-search :deep(.search),
.order-search :deep(.search input),
.order-filter-select :deep(.select select) {
  width: 100%;
  min-width: 0;
}
.order-search :deep(.search input) {
  min-height: 2.6rem;
  font-size: 0.89rem;
}
.order-clear-btn {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  flex: none;
}
.order-date-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.85rem;
  font-weight: 600;
}
.order-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 0 0.8rem;
}
.order-results p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}
.order-results > span {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.order-table {
  min-width: 0;
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-table-row-odd);
}
.order-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.order-table thead {
  background: var(--color-table-header-bg);
}
.col-order {
  width: 24%;
}
.col-client {
  width: 30%;
}
.col-date {
  width: 18%;
}
.col-status {
  width: 16%;
}
.col-actions {
  width: 12%;
}
.order-table th,
.order-table td {
  text-align: left;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
  vertical-align: middle;
}
.order-table th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  font-size: 0.76rem;
  font-weight: 650;
  border-top: 0;
}
.order-table thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.order-table thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.order-table tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.order-table tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.order-table tbody tr:last-child td {
  border-bottom: 0;
}
.order-table tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.order-identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.order-badge {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
}
.order-badge--info {
  background: var(--color-info-soft);
  color: var(--color-info);
  border-color: color-mix(in srgb, var(--color-info) 35%, transparent);
}
.order-badge--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
}
.order-badge--success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.order-badge--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.order-badge--neutral {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}
.order-badge svg {
  color: currentColor;
}
.order-identity__text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.order-code {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.order-code:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.order-subtitle {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}
.client-content {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}
.client-info {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.client-info strong {
  color: var(--color-text);
  font-size: 0.87rem;
  font-weight: 650;
  line-height: 1.3;
  white-space: normal;
  overflow-wrap: anywhere;
}
.proforma-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-primary-accent);
  font-size: 0.77rem;
  font-weight: 650;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
  width: fit-content;
}
.proforma-chip:hover {
  text-decoration: underline;
}
.date-stack {
  display: grid;
  gap: 0.18rem;
}
.date-time {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text);
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.date-time svg {
  color: var(--color-text-secondary);
  flex: none;
}
.date-day {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.order-table td.actions-cell,
.order-table th.actions-heading {
  text-align: right;
  padding-right: 1rem;
}
.order-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.order-pagination p {
  margin: 0;
}
.order-pagination__buttons {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.order-pagination button {
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
.order-pagination button:not(:disabled):hover {
  background: var(--color-surface-hover);
}
.order-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 72rem) {
  .order-filters__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .order-search {
    grid-column: 1 / -1;
  }
  .order-table th,
  .order-table td {
    padding: 0.75rem 0.65rem;
  }
}
@media (max-width: 53rem) {
  .order-table {
    background: transparent;
    border: 0;
  }
  .order-table colgroup,
  .order-table thead {
    display: none;
  }
  .order-table tbody {
    display: grid;
    gap: 0.75rem;
  }
  .order-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem 1rem;
    padding: 1rem;
    border: 1px solid var(--color-table-border);
    border-radius: var(--radius-card);
  }
  .order-table tbody tr:nth-child(odd) {
    background-color: var(--color-table-row-odd);
  }
  .order-table tbody tr:nth-child(even) {
    background-color: var(--color-table-row-even);
  }
  .order-table tbody td {
    display: block;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .order-cell {
    grid-column: 1;
  }
  .status-cell {
    grid-column: 2;
    text-align: right;
  }
  .client-cell {
    grid-column: 1 / -1;
    padding-top: 0.35rem;
    border-top: 1px solid var(--color-border);
  }
  .date-cell {
    grid-column: 1;
  }
  .order-table td.actions-cell {
    grid-column: 2;
    padding-right: 0;
    text-align: right;
  }
}
@media (max-width: 36rem) {
  .order-filters__main {
    grid-template-columns: 1fr;
  }
  .order-search {
    grid-column: auto;
  }
  .order-results > span {
    display: none;
  }
  .order-pagination {
    justify-content: center;
  }
}
</style>
