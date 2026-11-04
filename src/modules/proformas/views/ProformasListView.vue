<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Plus,
  SlidersHorizontal,
} from '@lucide/vue'
import type { Cliente, ProformaListado, ValorCatalogoPublico } from '@/generated/api'
import { proformasService } from '../services/proformasService'
import { presentarCreacion } from '../utils/fechaCreacion'
import ClienteSelector from '../components/ClienteSelector.vue'
import ProformaActionsMenu from '../components/ProformaActionsMenu.vue'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const queryString = (key: string) =>
  typeof route.query[key] === 'string' ? String(route.query[key]) : ''
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
const routeDate = (key: string) => (validDate(queryString(key)) ? queryString(key) : '')
const routePage = () => {
  const parsed = Number(queryString('pagina'))
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}
const rows = ref<ProformaListado[]>([])
const ahora = ref(Date.now())
const filasConCreacion = computed(() =>
  rows.value.map((row) => {
    const creadoEn = (row as ProformaListado & { creado_en?: string | null }).creado_en
    return {
      ...row,
      creado_en: creadoEn,
      creacion: presentarCreacion(creadoEn, row.fecha, ahora.value),
    }
  }),
)
const states = ref<ValorCatalogoPublico[]>([])
const currencies = ref<ValorCatalogoPublico[]>([])
const loading = ref(true)
const error = ref('')
const search = ref(queryString('q'))
const state = ref(queryString('estado'))
const currency = ref(queryString('moneda'))
const customer = ref(
  /^\d+$/.test(queryString('cliente')) && Number(queryString('cliente')) > 0
    ? queryString('cliente')
    : '',
)
const customerName = ref('')
const dateFrom = ref(routeDate('fecha_desde'))
const dateTo = ref(routeDate('fecha_hasta'))
const page = ref(routePage())
const total = ref(0)
const size = 10
const showAdvanced = ref(
  Boolean(currency.value || customer.value || dateFrom.value || dateTo.value),
)
const pages = computed(() => Math.max(1, Math.ceil(total.value / size)))
const fromItem = computed(() => (page.value - 1) * size + 1)
const toItem = computed(() => Math.min(total.value, page.value * size))
const dateError = computed(() =>
  dateFrom.value && dateTo.value && dateFrom.value > dateTo.value
    ? 'La fecha inicial no puede ser posterior a la fecha final.'
    : '',
)
const hasFilters = computed(() =>
  Boolean(
    search.value.trim() ||
    state.value ||
    currency.value ||
    customer.value ||
    dateFrom.value ||
    dateTo.value,
  ),
)
const filters = computed(() => [
  ...(search.value.trim() ? [{ key: 'q', label: `Búsqueda: ${search.value.trim()}` }] : []),
  ...(state.value
    ? [
        {
          key: 'state',
          label: `Estado: ${states.value.find((x) => x.codigo === state.value)?.nombre ?? state.value}`,
        },
      ]
    : []),
  ...(currency.value
    ? [
        {
          key: 'currency',
          label: `Moneda: ${currencies.value.find((x) => x.codigo === currency.value)?.nombre ?? currency.value}`,
        },
      ]
    : []),
  ...(customer.value
    ? [{ key: 'customer', label: `Cliente: ${customerName.value || '#' + customer.value}` }]
    : []),
  ...(dateFrom.value ? [{ key: 'from', label: `Desde: ${dateFrom.value}` }] : []),
  ...(dateTo.value ? [{ key: 'to', label: `Hasta: ${dateTo.value}` }] : []),
])

let requestId = 0
let debounce: ReturnType<typeof setTimeout> | undefined
let intervaloCreacion: ReturnType<typeof setInterval> | undefined
let restoringRoute = false
let synchronizing = false
let mounted = false

function money(value: string, code: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'Importe pendiente'
  try {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}
function tone(code: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (code === 'APROBADA') return 'success'
  if (code === 'EN_REVISION') return 'warning'
  if (code === 'ENVIADA') return 'info'
  if (code === 'NO_CONCRETADA' || code === 'CANCELADA') return 'danger'
  return 'neutral'
}
function editable(row: ProformaListado) {
  return ['BORRADOR', 'EN_REVISION'].includes(row.estado_info.codigo)
}
function customerLabel(row: ProformaListado) {
  return row.cliente_resumen?.empresa?.trim() || row.cliente_resumen?.nombre?.trim() || 'Prospecto'
}
function selectCustomer(value: Cliente | null) {
  customerName.value =
    value?.empresa?.trim() ||
    (value ? [value.nombres, value.apellidos].filter(Boolean).join(' ').trim() : '') ||
    ''
}

function currentQuery() {
  return {
    q: search.value.trim() || undefined,
    estado: state.value || undefined,
    moneda: currency.value || undefined,
    cliente: customer.value || undefined,
    fecha_desde: dateFrom.value || undefined,
    fecha_hasta: dateTo.value || undefined,
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
async function load() {
  const id = ++requestId
  if (dateError.value) {
    rows.value = []
    total.value = 0
    error.value = ''
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const response = await proformasService.list({
      search: search.value.trim() || undefined,
      estado: state.value || undefined,
      moneda: currency.value || undefined,
      cliente: customer.value ? Number(customer.value) : undefined,
      fecha_desde: dateFrom.value || undefined,
      fecha_hasta: dateTo.value || undefined,
      page: page.value,
      page_size: size,
    })
    if (id !== requestId) return
    rows.value = response.results
    total.value = response.count
    if (page.value > pages.value) {
      page.value = pages.value
      return
    }
  } catch (cause) {
    if (id !== requestId) return
    rows.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las proformas.'
  } finally {
    if (id === requestId) loading.value = false
  }
}
function scheduleLoad(delay = 0) {
  ++requestId // Una búsqueda nueva invalida respuestas anteriores incluso durante el debounce.
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    syncRoute()
    void load()
  }, delay)
}
watch([search, state, currency, customer, dateFrom, dateTo], (_newValues, oldValues) => {
  if (restoringRoute || !mounted) return
  if (page.value !== 1) page.value = 1
  const onlySearchChanged =
    oldValues &&
    state.value === oldValues[1] &&
    currency.value === oldValues[2] &&
    customer.value === oldValues[3] &&
    dateFrom.value === oldValues[4] &&
    dateTo.value === oldValues[5]
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
      state: queryString('estado'),
      currency: queryString('moneda'),
      customer: /^\d+$/.test(queryString('cliente')) ? queryString('cliente') : '',
      dateFrom: routeDate('fecha_desde'),
      dateTo: routeDate('fecha_hasta'),
      page: routePage(),
    }
    if (
      search.value === incoming.search &&
      state.value === incoming.state &&
      currency.value === incoming.currency &&
      customer.value === incoming.customer &&
      dateFrom.value === incoming.dateFrom &&
      dateTo.value === incoming.dateTo &&
      page.value === incoming.page
    )
      return
    restoringRoute = true
    search.value = incoming.search
    state.value = incoming.state
    currency.value = incoming.currency
    customer.value = incoming.customer
    dateFrom.value = incoming.dateFrom
    dateTo.value = incoming.dateTo
    page.value = incoming.page
    if (incoming.currency || incoming.customer || incoming.dateFrom || incoming.dateTo)
      showAdvanced.value = true
    if (debounce) clearTimeout(debounce)
    await nextTick()
    restoringRoute = false
    void load()
  },
)
function removeFilter(key: string) {
  if (key === 'q') search.value = ''
  if (key === 'state') state.value = ''
  if (key === 'currency') currency.value = ''
  if (key === 'customer') {
    customer.value = ''
    customerName.value = ''
  }
  if (key === 'from') dateFrom.value = ''
  if (key === 'to') dateTo.value = ''
}
function clearFilters() {
  search.value = ''
  state.value = ''
  currency.value = ''
  customer.value = ''
  customerName.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
onMounted(() => {
  mounted = true
  intervaloCreacion = setInterval(() => {
    ahora.value = Date.now()
  }, 60_000)
  void load()
  void proformasService
    .options('ESTADO_PROFORMA')
    .then((value) => {
      states.value = value
    })
    .catch(() => {
      states.value = []
    })
  void proformasService
    .options('MONEDA')
    .then((value) => {
      currencies.value = value
    })
    .catch(() => {
      currencies.value = []
    })
})
onBeforeUnmount(() => {
  mounted = false
  if (intervaloCreacion) clearInterval(intervaloCreacion)
  ++requestId
  if (debounce) clearTimeout(debounce)
})
</script>

<template>
  <div class="proformas-list">
    <PageHeader
      title="Proformas"
      description="Gestiona tus cotizaciones comerciales."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button
          @click="
            router.push(
              route.fullPath === '/proformas'
                ? '/proformas/nueva'
                : { path: '/proformas/nueva', query: { returnTo: route.fullPath } },
            )
          "
        >
          <Plus :size="18" aria-hidden="true" /> Nueva proforma
        </Button>
      </template>
    </PageHeader>

    <section class="proforma-filters" aria-label="Buscar y filtrar proformas">
      <div class="proforma-filters__main">
        <div class="proforma-search">
          <SearchField v-model="search" label="Buscar por número, título o cliente" />
        </div>
        <div class="proforma-state-filter">
          <Select
            v-model="state"
            name="estado-proforma"
            label="Estado"
            :options="[
              { label: 'Todos los estados', value: '' },
              ...states.map((x) => ({ label: x.nombre, value: x.codigo })),
              ...(state && !states.some((x) => x.codigo === state)
                ? [{ label: state, value: state }]
                : []),
            ]"
          />
        </div>
        <button
          type="button"
          class="proforma-more-filters"
          :aria-expanded="showAdvanced"
          :aria-controls="showAdvanced ? 'proforma-filtros-avanzados' : undefined"
          @click="showAdvanced = !showAdvanced"
        >
          <SlidersHorizontal :size="18" aria-hidden="true" />
          Más filtros
          <ChevronDown :size="16" aria-hidden="true" :class="{ rotated: showAdvanced }" />
        </button>
      </div>
      <div v-if="showAdvanced" id="proforma-filtros-avanzados" class="proforma-filters__advanced">
        <div class="proforma-customer">
          <ClienteSelector v-model="customer" label="Cliente" @select="selectCustomer" />
        </div>
        <Select
          v-model="currency"
          name="moneda-proforma-filtro"
          label="Moneda"
          :options="[
            { label: 'Todas las monedas', value: '' },
            ...currencies.map((x) => ({ label: x.nombre, value: x.codigo })),
            ...(currency && !currencies.some((x) => x.codigo === currency)
              ? [{ label: currency, value: currency }]
              : []),
          ]"
        />
        <label class="proforma-date"
          >Desde
          <input
            v-model="dateFrom"
            type="date"
            name="fecha-desde-proforma"
            :max="dateTo || undefined"
        /></label>
        <label class="proforma-date"
          >Hasta
          <input
            v-model="dateTo"
            type="date"
            name="fecha-hasta-proforma"
            :min="dateFrom || undefined"
        /></label>
      </div>
      <p v-if="dateError" class="proforma-date-error" role="alert">{{ dateError }}</p>
    </section>

    <ActiveFilters :filters="filters" @remove="removeFilter" @clear="clearFilters" />

    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <div v-else-if="dateError" class="proforma-no-results" role="status">
      Corrige el rango de fechas para ver las proformas.
    </div>
    <EmptyState
      v-else-if="!rows.length"
      :title="hasFilters ? 'Sin resultados' : 'Sin proformas'"
      :description="
        hasFilters
          ? 'No hay proformas que coincidan con los filtros seleccionados.'
          : 'Todavía no hay proformas registradas.'
      "
    />
    <template v-else>
      <div class="proforma-results">
        <p>
          {{ total }} proforma{{ total === 1 ? '' : 's' }} encontrada{{ total === 1 ? '' : 's' }}
        </p>
        <span>Más recientes primero</span>
      </div>
      <div class="proforma-table">
        <table>
          <caption class="sr-only">
            Bandeja de proformas comerciales
          </caption>
          <colgroup>
            <col class="col-quote" />
            <col class="col-client" />
            <col class="col-date" />
            <col class="col-status" />
            <col class="col-total" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Proforma</th>
              <th scope="col">Cliente</th>
              <th scope="col">Creación</th>
              <th scope="col">Estado</th>
              <th scope="col" class="numeric">Total</th>
              <th scope="col" class="actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filasConCreacion" :key="row.id">
              <td class="quote-cell">
                <strong>#{{ row.numero }}</strong>
                <span :title="row.titulo || 'Sin título'">{{
                  row.titulo?.trim() || 'Sin título'
                }}</span>
              </td>
              <td class="client-cell">
                <strong :title="customerLabel(row)">{{ customerLabel(row) }}</strong>
                <span>{{ row.cliente_resumen ? 'Cliente registrado' : 'Prospecto' }}</span>
              </td>
              <td class="date-cell" data-label="Creación">
                <div
                  class="creation-cell"
                  :title="
                    row.creacion.historica ? 'Registro histórico sin hora de creación' : undefined
                  "
                >
                  <div
                    class="creation-primary"
                    :class="{ 'creation-primary--recent': row.creacion.reciente }"
                  >
                    <Clock3 :size="15" aria-hidden="true" />
                    <strong>{{ row.creacion.principal }}</strong>
                  </div>
                  <time
                    v-if="row.creacion.hora"
                    class="creation-hour"
                    :datetime="row.creado_en ?? undefined"
                    >{{ row.creacion.hora }}</time
                  >
                  <span v-else class="creation-hour">Hora no registrada</span>
                  <span v-if="row.creacion.mostrarFechaSeparada" class="creation-date">{{
                    row.creacion.fecha
                  }}</span>
                </div>
              </td>
              <td class="status-cell" data-label="Estado">
                <Badge :tone="tone(row.estado_info.codigo)">{{ row.estado_info.nombre }}</Badge>
              </td>
              <td class="total-cell" data-label="Total">
                <strong>{{ money(row.total, row.moneda_info.codigo) }}</strong>
              </td>
              <td class="actions-cell">
                <ProformaActionsMenu
                  v-if="editable(row)"
                  :id="row.id"
                  :numero="row.numero"
                  :return-to="route.fullPath === '/proformas' ? undefined : route.fullPath"
                />
                <RouterLink
                  v-else
                  :to="
                    route.fullPath === '/proformas'
                      ? `/proformas/${row.id}`
                      : { path: `/proformas/${row.id}`, query: { returnTo: route.fullPath } }
                  "
                  class="proforma-view-link"
                  :aria-label="`Ver proforma #${row.numero}`"
                  :title="`Ver proforma #${row.numero}`"
                  ><Eye :size="19" aria-hidden="true"
                /></RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav class="proforma-pagination" aria-label="Paginación de proformas">
        <p>Mostrando {{ fromItem }}–{{ toItem }} de {{ total }} proformas</p>
        <div v-if="pages > 1" class="proforma-pagination__buttons">
          <button type="button" :disabled="page <= 1" @click="page--">
            <ChevronLeft :size="17" aria-hidden="true" /> Anterior
          </button>
          <span>Página {{ page }} de {{ pages }}</span>
          <button type="button" :disabled="page >= pages" @click="page++">
            Siguiente <ChevronRight :size="17" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.proformas-list {
  min-width: 0;
}
.proformas-list :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.proformas-list :deep(.page-header__actions button) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.proforma-filters {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  margin-bottom: 1rem;
}
.proforma-filters__main {
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) minmax(11rem, 14rem) auto;
  align-items: end;
  gap: 0.85rem;
}
.proforma-search {
  min-width: 0;
}
.proforma-search :deep(.search) {
  width: 100%;
}
.proforma-search :deep(.search input) {
  min-width: 0;
  width: 100%;
  min-height: 2.6rem;
  font-size: 0.89rem;
}
.proforma-state-filter {
  min-width: 0;
}
.proforma-state-filter :deep(.select select) {
  width: 100%;
}
.proforma-more-filters,
.proforma-pagination button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.65rem 0.85rem;
  min-height: 2.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 650;
  cursor: pointer;
}
.proforma-more-filters:hover,
.proforma-pagination button:not(:disabled):hover {
  background: var(--color-surface-hover);
}
.proforma-more-filters .rotated {
  transform: rotate(180deg);
}
.proforma-more-filters:focus-visible,
.proforma-pagination button:focus-visible,
.proforma-view-link:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.proforma-filters__advanced {
  display: grid;
  grid-template-columns: minmax(13rem, 1.4fr) minmax(10rem, 1fr) minmax(9rem, 0.85fr) minmax(
      9rem,
      0.85fr
    );
  gap: 1rem;
  align-items: start;
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;
}
.proforma-customer {
  min-width: 0;
}
.proforma-customer :deep(.client-picker) {
  min-width: 0;
}
.proforma-customer :deep(.client-picker__hint) {
  display: none;
}
.proforma-date {
  display: grid;
  gap: 0.5rem;
  font-size: 0.87rem;
  font-weight: 650;
}
.proforma-date input {
  min-width: 0;
  width: 100%;
  min-height: 2.75rem;
  color: var(--color-text);
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  font: inherit;
}
.proforma-date-error {
  color: var(--color-danger);
  font-size: 0.8rem;
  margin: 0;
}
.proforma-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 0 0.8rem;
}
.proforma-results p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}
.proforma-results > span {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.proforma-table {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.proforma-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.col-quote {
  width: 21%;
}
.col-client {
  width: 20%;
}
.col-date {
  width: 18%;
}
.col-status {
  width: 15%;
}
.col-total {
  width: 18%;
}
.col-actions {
  width: 8%;
}
.proforma-table th,
.proforma-table td {
  text-align: left;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}
.proforma-table th {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  font-weight: 650;
}
.proforma-table tbody tr:last-child td {
  border-bottom: 0;
}
.proforma-table tbody tr:hover {
  background: var(--color-surface-hover);
}
.quote-cell,
.client-cell {
  min-width: 0;
}
.quote-cell strong,
.client-cell strong {
  display: block;
  font-weight: 700;
  font-size: 0.89rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quote-cell span,
.client-cell span {
  display: block;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.date-cell {
  font-size: 0.84rem;
  color: var(--color-text-secondary);
}
.creation-cell {
  display: grid;
  gap: 0.24rem;
  justify-items: start;
  min-width: 0;
}
.creation-primary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--color-text);
}
.creation-primary svg {
  flex: none;
  color: var(--color-text-secondary);
}
.creation-primary--recent svg {
  color: var(--color-success);
}
.creation-primary strong {
  font-weight: 650;
}
.creation-hour {
  font-size: 0.78rem;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.creation-date {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.proforma-table td.total-cell,
.proforma-table th.numeric {
  text-align: right;
  padding-right: 1rem;
}
.total-cell strong {
  display: block;
  width: 100%;
  text-align: right;
  font-size: 0.87rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.actions-cell,
.proforma-table th.actions-heading {
  text-align: right;
}
.proforma-view-link {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface);
  text-decoration: none;
}
.proforma-view-link:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary-accent);
}
.proforma-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}
.proforma-pagination p {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0;
}
.proforma-pagination__buttons {
  display: flex;
  gap: 0.8rem;
  align-items: center;
}
.proforma-pagination__buttons span {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.proforma-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.proforma-no-results {
  color: var(--color-text-secondary);
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
@media (max-width: 72rem) {
  .proforma-filters__advanced {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .col-quote {
    width: 20%;
  }
  .col-client {
    width: 20%;
  }
  .col-date {
    width: 19%;
  }
  .col-status {
    width: 15%;
  }
  .col-total {
    width: 17%;
  }
  .col-actions {
    width: 9%;
  }
  .proforma-table th,
  .proforma-table td {
    padding: 0.75rem 0.65rem;
  }
}
@media (max-width: 53rem) {
  .proforma-filters__main {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .proforma-search {
    grid-column: 1/-1;
  }
  .proforma-table {
    background: transparent;
    border: 0;
  }
  .proforma-table colgroup,
  .proforma-table thead {
    display: none;
  }
  .proforma-table tbody {
    display: grid;
    gap: 0.75rem;
  }
  .proforma-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem 1rem;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-surface);
  }
  .proforma-table tbody td {
    display: block;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .quote-cell {
    grid-column: 1/-1;
  }
  .quote-cell strong {
    font-size: 1rem;
  }
  .quote-cell span {
    font-size: 0.81rem;
  }
  .client-cell {
    grid-column: 1/-1;
  }
  .date-cell {
    grid-column: 1;
  }
  .status-cell {
    grid-column: 2;
    text-align: right;
  }
  .proforma-table td.total-cell {
    grid-column: 1;
    display: flex !important;
    flex-direction: column;
    align-items: start;
    gap: 0.3rem;
    text-align: left;
  }
  .total-cell::before {
    content: attr(data-label);
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }
  .total-cell strong {
    font-size: 1rem;
    text-align: left;
  }
  .actions-cell {
    grid-column: 2;
    align-self: end;
  }
}
@media (max-width: 36rem) {
  .proforma-filters__main,
  .proforma-filters__advanced {
    grid-template-columns: 1fr;
  }
  .proforma-search {
    grid-column: auto;
  }
  .proforma-more-filters {
    justify-self: start;
  }
  .proforma-results > span {
    display: none;
  }
  .proforma-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
  .proforma-pagination__buttons {
    width: 100%;
    justify-content: space-between;
    gap: 0.4rem;
  }
  .proforma-pagination button {
    padding: 0.55rem 0.6rem;
  }
}
</style>
