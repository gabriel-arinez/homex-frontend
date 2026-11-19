<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowDownRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CornerDownRight,
  Cpu,
  PackagePlus,
  RotateCcw,
  SlidersHorizontal,
  UserCheck,
} from '@lucide/vue'
import type { MovimientoStock, ValorCatalogoPublico } from '@/generated/api'
import { movimientosStockService } from '../services/movimientosStockService'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import DatePresentation from '@/shared/ui/DatePresentation.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import { dateRangeError, isValidDate, localToday } from '@/shared/validation/dateRange'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const today = localToday()

const queryString = (key: string) =>
  typeof route.query[key] === 'string' ? String(route.query[key]) : ''
const routeDate = (key: string) => (isValidDate(queryString(key)) ? queryString(key) : '')
const routePositiveInt = (key: string) =>
  /^\d+$/.test(queryString(key)) && Number(queryString(key)) > 0 ? queryString(key) : ''

const rows = ref<MovimientoStock[]>([])
const types = ref<ValorCatalogoPublico[]>([])
const total = ref(0)
const loading = ref(true)
const referenceLoading = ref(true)
const error = ref('')
const referenceError = ref('')

const search = ref(queryString('q'))
const type = ref(queryString('tipo'))
const pedido = ref(routePositiveInt('pedido'))
const producto = ref(routePositiveInt('producto'))
const fechaDesde = ref(routeDate('desde'))
const fechaHasta = ref(routeDate('hasta'))
const page = ref(Math.max(1, Number(queryString('pagina')) || 1))
const pageSize = 20

let requestId = 0
let debounce: ReturnType<typeof setTimeout> | undefined
let restoringRoute = false
let synchronizing = false
let mounted = false

const dateError = computed(() => dateRangeError(fechaDesde.value, fechaHasta.value, localToday()))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const fromItem = computed(() => (total.value ? (page.value - 1) * pageSize + 1 : 0))
const toItem = computed(() => Math.min(total.value, page.value * pageSize))

const hasFilters = computed(() =>
  Boolean(
    search.value.trim() ||
    type.value ||
    pedido.value ||
    producto.value ||
    fechaDesde.value ||
    fechaHasta.value,
  ),
)

const activeFilters = computed(() => [
  ...(search.value.trim() ? [{ key: 'search', label: `Búsqueda: ${search.value.trim()}` }] : []),
  ...(type.value
    ? [
        {
          key: 'type',
          label: `Tipo: ${types.value.find((item) => item.codigo === type.value)?.nombre ?? type.value}`,
        },
      ]
    : []),
  ...(pedido.value ? [{ key: 'pedido', label: `Pedido #${pedido.value}` }] : []),
  ...(producto.value ? [{ key: 'producto', label: `Producto #${producto.value}` }] : []),
  ...(fechaDesde.value ? [{ key: 'desde', label: `Desde: ${fechaDesde.value}` }] : []),
  ...(fechaHasta.value ? [{ key: 'hasta', label: `Hasta: ${fechaHasta.value}` }] : []),
])

function movementTone(code: string): 'danger' | 'info' | 'success' | 'warning' | 'neutral' {
  if (code === 'VENTA') return 'danger'
  if (code === 'REVERSA_VENTA') return 'info'
  if (code === 'CARGA_INICIAL') return 'success'
  if (code === 'AJUSTE') return 'warning'
  return 'neutral'
}

function movementIcon(code: string) {
  if (code === 'VENTA') return ArrowDownRight
  if (code === 'REVERSA_VENTA') return RotateCcw
  if (code === 'CARGA_INICIAL') return PackagePlus
  if (code === 'AJUSTE') return SlidersHorizontal
  return Boxes
}

function removeFilter(key: string) {
  if (key === 'search') search.value = ''
  if (key === 'type') type.value = ''
  if (key === 'pedido') pedido.value = ''
  if (key === 'producto') producto.value = ''
  if (key === 'desde') fechaDesde.value = ''
  if (key === 'hasta') fechaHasta.value = ''
}

function clearFilters() {
  search.value = ''
  type.value = ''
  pedido.value = ''
  producto.value = ''
  fechaDesde.value = ''
  fechaHasta.value = ''
}

function currentQuery() {
  return {
    q: search.value.trim() || undefined,
    tipo: type.value || undefined,
    pedido: pedido.value || undefined,
    producto: producto.value || undefined,
    desde: fechaDesde.value || undefined,
    hasta: fechaHasta.value || undefined,
    pagina: page.value > 1 ? String(page.value) : undefined,
  }
}

function syncRoute() {
  const query = currentQuery()
  const keys = Object.keys(query) as Array<keyof typeof query>
  if (keys.every((key) => (query[key] ?? '') === queryString(key))) return
  synchronizing = true
  void router.replace({ query }).finally(() => {
    synchronizing = false
  })
}

async function loadReferences() {
  referenceLoading.value = true
  referenceError.value = ''
  try {
    types.value = await movimientosStockService.types()
  } catch (cause) {
    referenceError.value =
      cause instanceof Error ? cause.message : 'No se pudieron cargar los tipos de movimiento.'
  } finally {
    referenceLoading.value = false
  }
}

async function load() {
  const currentRequest = ++requestId
  if (dateError.value) {
    rows.value = []
    total.value = 0
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await movimientosStockService.list({
      search: search.value.trim() || undefined,
      tipo_movimiento: type.value || undefined,
      pedido: pedido.value ? Number(pedido.value) : undefined,
      producto: producto.value ? Number(producto.value) : undefined,
      fecha_desde: fechaDesde.value || undefined,
      fecha_hasta: fechaHasta.value || undefined,
      page: page.value,
      page_size: pageSize,
    })
    if (currentRequest !== requestId) return
    rows.value = result.results
    total.value = result.count
    if (total.value > 0 && page.value > totalPages.value) {
      page.value = totalPages.value
      return
    }
  } catch (cause) {
    if (currentRequest !== requestId) return
    rows.value = []
    total.value = 0
    error.value =
      cause instanceof Error ? cause.message : 'No se pudieron cargar los movimientos de stock.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function scheduleLoad(delay = 0) {
  ++requestId
  if (debounce) clearTimeout(debounce)
  if (delay > 0) {
    debounce = setTimeout(() => {
      syncRoute()
      void load()
    }, delay)
  } else {
    syncRoute()
    void load()
  }
}

watch([search, type, pedido, producto, fechaDesde, fechaHasta], (_newValues, oldValues) => {
  if (restoringRoute || !mounted) return
  if (page.value !== 1) page.value = 1
  const onlySearchChanged =
    oldValues &&
    type.value === oldValues[1] &&
    pedido.value === oldValues[2] &&
    producto.value === oldValues[3] &&
    fechaDesde.value === oldValues[4] &&
    fechaHasta.value === oldValues[5]
  scheduleLoad(onlySearchChanged ? 300 : 0)
})

watch(page, () => {
  if (restoringRoute || !mounted) return
  scheduleLoad(0)
})

watch(
  () => route.fullPath,
  async () => {
    if (synchronizing || !mounted) return
    const incoming = {
      search: queryString('q'),
      type: queryString('tipo'),
      pedido: routePositiveInt('pedido'),
      producto: routePositiveInt('producto'),
      fechaDesde: routeDate('desde'),
      fechaHasta: routeDate('hasta'),
      page: Math.max(1, Number(queryString('pagina')) || 1),
    }
    if (
      search.value === incoming.search &&
      type.value === incoming.type &&
      pedido.value === incoming.pedido &&
      producto.value === incoming.producto &&
      fechaDesde.value === incoming.fechaDesde &&
      fechaHasta.value === incoming.fechaHasta &&
      page.value === incoming.page
    ) {
      return
    }
    restoringRoute = true
    search.value = incoming.search
    type.value = incoming.type
    pedido.value = incoming.pedido
    producto.value = incoming.producto
    fechaDesde.value = incoming.fechaDesde
    fechaHasta.value = incoming.fechaHasta
    page.value = incoming.page
    if (debounce) clearTimeout(debounce)
    await nextTick()
    restoringRoute = false
    void load()
  },
)

onMounted(() => {
  mounted = true
  void load()
  void loadReferences()
})

onBeforeUnmount(() => {
  mounted = false
  ++requestId
  if (debounce) clearTimeout(debounce)
})
</script>

<template>
  <div class="stock-movements-list">
    <PageHeader
      title="Movimientos de stock"
      description="Historial inmutable generado por las operaciones comerciales de HOMEX."
      show-menu
      @menu="emit('openMenu')"
    />

    <section class="stock-filters" aria-label="Buscar y filtrar movimientos de stock">
      <div class="stock-filters__main">
        <div class="stock-search">
          <SearchField v-model="search" label="Buscar por SKU, producto u observación" />
        </div>
        <div class="stock-filter-select">
          <Select
            v-model="type"
            name="tipo-movimiento"
            label="Tipo"
            :disabled="referenceLoading || Boolean(referenceError)"
            :options="[
              { label: 'Todos', value: '' },
              ...types.map((item) => ({ label: item.nombre, value: item.codigo })),
            ]"
          />
        </div>
        <div class="stock-filter-num">
          <TextField
            v-model="pedido"
            name="pedido-movimiento"
            label="Pedido"
            type="number"
            min="1"
          />
        </div>
        <div class="stock-filter-num">
          <TextField
            v-model="producto"
            name="producto-movimiento"
            label="Producto"
            type="number"
            min="1"
          />
        </div>
        <div class="stock-filter-date">
          <TextField
            v-model="fechaDesde"
            name="fecha-desde"
            label="Desde"
            type="date"
            :max="fechaHasta && fechaHasta < today ? fechaHasta : today"
          />
        </div>
        <div class="stock-filter-date">
          <TextField
            v-model="fechaHasta"
            name="fecha-hasta"
            label="Hasta"
            type="date"
            :min="fechaDesde || undefined"
            :max="today"
          />
        </div>
        <Button
          v-if="hasFilters"
          variant="secondary"
          class="stock-clear-btn"
          aria-label="Limpiar filtros"
          title="Limpiar filtros"
          @click="clearFilters"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </Button>
      </div>

      <p v-if="dateError" class="stock-alert" role="alert">{{ dateError }}</p>
      <p v-if="referenceError" class="stock-alert" role="alert">
        {{ referenceError }}
        <button type="button" class="stock-retry-inline" @click="loadReferences">
          Reintentar tipos
        </button>
      </p>

      <ActiveFilters
        v-if="activeFilters.length"
        :filters="activeFilters"
        @remove="removeFilter"
        @clear="clearFilters"
      />
    </section>

    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="!rows.length"
      :title="hasFilters ? 'Sin coincidencias' : 'Sin movimientos'"
      :description="
        hasFilters
          ? 'No hay movimientos que coincidan con los filtros aplicados.'
          : 'Todavía no se registraron movimientos de inventario.'
      "
    >
      <Button v-if="hasFilters" variant="secondary" @click="clearFilters">Limpiar filtros</Button>
    </EmptyState>
    <template v-else>
      <div class="stock-results">
        <p>{{ total }} movimiento{{ total === 1 ? '' : 's' }}</p>
        <span>Kardex operativo HOMEX</span>
      </div>

      <div class="stock-table">
        <table>
          <caption class="sr-only">
            Historial de movimientos de stock
          </caption>
          <colgroup>
            <col class="col-product" />
            <col class="col-variation" />
            <col class="col-trace" />
            <col class="col-actor" />
            <col class="col-date" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Producto y movimiento</th>
              <th scope="col">Tipo y variación</th>
              <th scope="col">Trazabilidad</th>
              <th scope="col">Responsable y observación</th>
              <th scope="col">Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="product-cell">
                <div class="product-identity">
                  <span
                    class="movement-badge"
                    :class="`movement-badge--${movementTone(row.tipo_movimiento_info.codigo)}`"
                  >
                    <component
                      :is="movementIcon(row.tipo_movimiento_info.codigo)"
                      :size="16"
                      aria-hidden="true"
                    />
                  </span>
                  <div class="product-identity__text">
                    <strong :title="row.producto_resumen.nombre">
                      {{ row.producto_resumen.nombre }}
                    </strong>
                    <span class="product-sku">
                      SKU: {{ row.producto_resumen.sku || `Prod. ${row.producto}` }} · Mov.
                      {{ row.id }}
                    </span>
                  </div>
                </div>
              </td>

              <td class="variation-cell" data-label="Tipo y variación">
                <div class="variation-stack">
                  <Badge :tone="movementTone(row.tipo_movimiento_info.codigo)">
                    {{ row.tipo_movimiento_info.nombre }}
                  </Badge>
                  <div class="variation-amount">
                    <strong
                      class="variation-qty"
                      :class="Number(row.cantidad) < 0 ? 'variation-qty--out' : 'variation-qty--in'"
                    >
                      {{ Number(row.cantidad) > 0 ? '+' : '' }}{{ row.cantidad }}
                    </strong>
                    <span class="variation-unit">
                      {{ row.producto_resumen.unidad_stock_info.nombre }}
                    </span>
                  </div>
                </div>
              </td>

              <td class="trace-cell" data-label="Trazabilidad">
                <div class="trace-stack">
                  <RouterLink
                    v-if="row.pedido_relacionado"
                    :to="`/pedidos/${row.pedido_relacionado}`"
                    class="trace-order-link"
                  >
                    <ClipboardList :size="13" aria-hidden="true" />
                    Pedido #{{ row.pedido_relacionado }}
                  </RouterLink>
                  <span v-else class="trace-no-order">Sin pedido</span>

                  <span v-if="row.movimiento_referencia" class="trace-ref">
                    <CornerDownRight :size="12" aria-hidden="true" />
                    Orig. #{{ row.movimiento_referencia }}
                  </span>
                </div>
              </td>

              <td class="actor-cell" data-label="Responsable y observación">
                <div class="actor-stack">
                  <span class="actor-name">
                    <UserCheck v-if="row.responsable?.display_name" :size="14" aria-hidden="true" />
                    <Cpu v-else :size="14" aria-hidden="true" />
                    <strong>{{ row.responsable?.display_name || 'Sistema' }}</strong>
                  </span>
                  <span class="actor-obs" :title="row.observaciones || 'Sin observaciones'">
                    {{ row.observaciones || '—' }}
                  </span>
                </div>
              </td>

              <td class="date-cell" data-label="Fecha">
                <DatePresentation :timestamp="String(row.fecha)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="stock-pagination" aria-label="Paginación de movimientos de stock">
        <p>Mostrando {{ fromItem }}–{{ toItem }} de {{ total }} movimientos</p>
        <div v-if="totalPages > 1" class="stock-pagination__buttons">
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
.stock-movements-list {
  min-width: 0;
}
.stock-movements-list :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.stock-filters {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  margin-bottom: 1rem;
}
.stock-filters__main {
  display: grid;
  grid-template-columns:
    minmax(13rem, 2fr)
    minmax(10rem, 1.2fr)
    minmax(6.5rem, 0.7fr)
    minmax(6.5rem, 0.7fr)
    minmax(8rem, 0.85fr)
    minmax(8rem, 0.85fr)
    auto;
  align-items: end;
  gap: 0.8rem;
}
.stock-search,
.stock-filter-select,
.stock-filter-num,
.stock-filter-date {
  min-width: 0;
}
.stock-search :deep(.search),
.stock-search :deep(.search input),
.stock-filter-select :deep(.select select) {
  width: 100%;
  min-width: 0;
}
.stock-search :deep(.search input) {
  min-height: 2.6rem;
  font-size: 0.89rem;
}
.stock-clear-btn {
  min-height: 2.6rem;
  padding: 0 0.75rem;
}
.stock-alert {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 0;
  color: var(--color-danger);
  font-size: 0.85rem;
  font-weight: 600;
}
.stock-retry-inline {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  color: var(--color-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
}
.stock-retry-inline:hover {
  background: var(--color-surface-hover);
}
.stock-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 0 0.8rem;
}
.stock-results p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}
.stock-results > span {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.stock-table {
  min-width: 0;
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-table-row-odd);
}
.stock-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.stock-table thead {
  background: var(--color-table-header-bg);
}
.col-product {
  width: 27%;
}
.col-variation {
  width: 22%;
}
.col-trace {
  width: 16%;
}
.col-actor {
  width: 21%;
}
.col-date {
  width: 14%;
}
.stock-table th,
.stock-table td {
  text-align: left;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
  vertical-align: middle;
}
.stock-table th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  font-size: 0.76rem;
  font-weight: 650;
  border-top: 0;
}
.stock-table thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.stock-table thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.stock-table tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.stock-table tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.stock-table tbody tr:last-child td {
  border-bottom: 0;
}
.stock-table tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.product-identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.movement-badge {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
}
.movement-badge--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.movement-badge--info {
  background: var(--color-info-soft);
  color: var(--color-info);
  border-color: color-mix(in srgb, var(--color-info) 35%, transparent);
}
.movement-badge--success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.movement-badge--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
}
.movement-badge--neutral {
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}
.product-identity__text {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.product-identity__text strong {
  color: var(--color-text);
  font-size: 0.89rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-sku {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.variation-stack {
  display: grid;
  gap: 0.3rem;
  justify-items: start;
  min-width: 0;
}
.variation-amount {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.variation-qty {
  font-size: 0.92rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.variation-qty--in {
  color: var(--color-success);
}
.variation-qty--out {
  color: var(--color-danger);
}
.variation-unit {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
}
.trace-stack {
  display: grid;
  gap: 0.22rem;
  justify-items: start;
  min-width: 0;
}
.trace-order-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-primary-accent);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.trace-order-link:hover {
  text-decoration: underline;
}
.trace-no-order {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.trace-ref {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}
.actor-stack {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.actor-name {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text);
  font-size: 0.84rem;
  min-width: 0;
}
.actor-name svg {
  flex: none;
  color: var(--color-text-secondary);
}
.actor-name strong {
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.actor-obs {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stock-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.stock-pagination p {
  margin: 0;
}
.stock-pagination__buttons {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.stock-pagination button {
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
.stock-pagination button:not(:disabled):hover {
  background: var(--color-surface-hover);
}
.stock-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 82rem) {
  .stock-filters__main {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .stock-search {
    grid-column: 1 / -1;
  }
}
@media (max-width: 64rem) {
  .stock-filters__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stock-table th,
  .stock-table td {
    padding: 0.75rem 0.65rem;
  }
}
@media (max-width: 53rem) {
  .stock-table {
    background: transparent;
    border: 0;
  }
  .stock-table colgroup,
  .stock-table thead {
    display: none;
  }
  .stock-table tbody {
    display: grid;
    gap: 0.75rem;
  }
  .stock-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem 1rem;
    padding: 1rem;
    border: 1px solid var(--color-table-border);
    border-radius: var(--radius-card);
  }
  .stock-table tbody tr:nth-child(odd) {
    background-color: var(--color-table-row-odd);
  }
  .stock-table tbody tr:nth-child(even) {
    background-color: var(--color-table-row-even);
  }
  .stock-table tbody td {
    display: block;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .product-cell {
    grid-column: 1 / -1;
  }
  .variation-cell {
    grid-column: 1;
  }
  .trace-cell {
    grid-column: 2;
    text-align: right;
  }
  .trace-stack {
    justify-items: end;
  }
  .actor-cell {
    grid-column: 1 / -1;
    padding-top: 0.35rem;
    border-top: 1px solid var(--color-border);
  }
  .date-cell {
    grid-column: 1 / -1;
  }
}
@media (max-width: 36rem) {
  .stock-filters__main {
    grid-template-columns: 1fr;
  }
  .stock-search {
    grid-column: auto;
  }
  .stock-results > span {
    display: none;
  }
  .stock-pagination {
    justify-content: center;
  }
}
</style>
