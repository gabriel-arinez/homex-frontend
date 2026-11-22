<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CornerDownRight,
  Cpu,
  Download,
  PackagePlus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  UserCheck,
} from '@lucide/vue'
import type {
  CatalogoMotivosAjuste,
  MovimientoReporteItem,
  MovimientoStock,
  Producto,
  ReporteResumen,
  ValorCatalogoPublico,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { productosService } from '@/modules/productos/services/productosService'
import {
  disponibilidadMeta,
  estadoStockMeta,
  unidadesProducto,
} from '@/modules/productos/utils/presentacionCatalogo'
import { ApiError } from '@/shared/api'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { generateUuidV4 } from '@/shared/utils/uuid'
import { movimientosStockService } from '../services/movimientosStockService'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import DatePresentation from '@/shared/ui/DatePresentation.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import TextAreaField from '@/shared/ui/TextAreaField.vue'
import TextField from '@/shared/ui/TextField.vue'
import Toast from '@/shared/ui/Toast.vue'
import { dateRangeError, isValidDate, localToday } from '@/shared/validation/dateRange'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const today = localToday()
const canAdmin = computed(() => session.can('comercial.administrar'))

const queryString = (key: string) =>
  typeof route.query[key] === 'string' ? String(route.query[key]) : ''
const routeDate = (key: string) => (isValidDate(queryString(key)) ? queryString(key) : '')
const routePositiveInt = (key: string) =>
  /^\d+$/.test(queryString(key)) && Number(queryString(key)) > 0 ? queryString(key) : ''

const rows = ref<Array<MovimientoStock | MovimientoReporteItem>>([])
const types = ref<ValorCatalogoPublico[]>([])
const total = ref(0)
const loading = ref(true)
const referenceLoading = ref(true)
const error = ref('')
const referenceError = ref('')
const toastMessage = ref('')
const toastTone = ref<'success' | 'danger'>('success')

// P1: Cabecera contextual cuando se filtra por un producto específico
const selectedProduct = ref<Producto | null>(null)
const selectedProductLoading = ref(false)

// P6: Modo reporte con saldos históricos y exportación CSV
const reportMode = ref(queryString('vista') === 'reporte')
const saldoReconstruible = ref(false)
const limitacionSaldo = ref<string | null>(null)
const reporteResumen = ref<ReporteResumen | null>(null)
const exportingCsv = ref(false)

const search = ref(queryString('q'))
const type = ref(queryString('tipo'))
const direccion = ref<'ENTRADA' | 'SALIDA' | ''>(
  queryString('direccion') === 'ENTRADA' || queryString('direccion') === 'SALIDA'
    ? (queryString('direccion') as 'ENTRADA' | 'SALIDA')
    : '',
)
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
    direccion.value ||
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
  ...(direccion.value
    ? [
        {
          key: 'direccion',
          label: `Dirección: ${direccion.value === 'ENTRADA' ? 'Entradas (+)' : 'Salidas (-)'}`,
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

const MOVEMENT_SHORT_LABELS: Record<string, string> = {
  VENTA: 'Venta confirmada',
  CARGA_INICIAL: 'Carga inicial',
  AJUSTE: 'Ajuste de stock',
  REVERSA_VENTA: 'Devolución por cancelación',
}

function movementLabel(code: string, fallback: string): string {
  return MOVEMENT_SHORT_LABELS[code] ?? fallback
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
  if (key === 'direccion') direccion.value = ''
  if (key === 'pedido') pedido.value = ''
  if (key === 'producto') producto.value = ''
  if (key === 'desde') fechaDesde.value = ''
  if (key === 'hasta') fechaHasta.value = ''
}

function clearFilters() {
  search.value = ''
  type.value = ''
  direccion.value = ''
  pedido.value = ''
  producto.value = ''
  fechaDesde.value = ''
  fechaHasta.value = ''
}

function currentQuery() {
  return {
    q: search.value.trim() || undefined,
    tipo: type.value || undefined,
    direccion: direccion.value || undefined,
    pedido: pedido.value || undefined,
    producto: producto.value || undefined,
    desde: fechaDesde.value || undefined,
    hasta: fechaHasta.value || undefined,
    vista: reportMode.value ? 'reporte' : undefined,
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

async function loadSelectedProduct() {
  const id = Number(producto.value)
  if (!producto.value || !Number.isInteger(id) || id <= 0) {
    selectedProduct.value = null
    return
  }
  selectedProductLoading.value = true
  try {
    selectedProduct.value = await productosService.get(id)
  } catch {
    selectedProduct.value = null
  } finally {
    selectedProductLoading.value = false
  }
}

async function load() {
  const currentRequest = ++requestId
  if (dateError.value) {
    rows.value = []
    total.value = 0
    reporteResumen.value = null
    saldoReconstruible.value = false
    limitacionSaldo.value = null
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  const params = {
    search: search.value.trim() || undefined,
    tipo_movimiento: type.value || undefined,
    direccion: direccion.value || undefined,
    pedido: pedido.value ? Number(pedido.value) : undefined,
    producto: producto.value ? Number(producto.value) : undefined,
    fecha_desde: fechaDesde.value || undefined,
    fecha_hasta: fechaHasta.value || undefined,
    page: page.value,
    page_size: pageSize,
  }
  try {
    if (reportMode.value) {
      const result = await movimientosStockService.reporte(params)
      if (currentRequest !== requestId) return
      rows.value = result.results
      total.value = result.count
      saldoReconstruible.value = result.saldo_reconstruible
      limitacionSaldo.value = result.limitacion_saldo
      reporteResumen.value = result.resumen
    } else {
      const result = await movimientosStockService.list(params)
      if (currentRequest !== requestId) return
      rows.value = result.results
      total.value = result.count
      saldoReconstruible.value = false
      limitacionSaldo.value = null
      reporteResumen.value = null
    }
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

async function exportCsv() {
  if (dateError.value || exportingCsv.value) return
  exportingCsv.value = true
  try {
    const blob = await movimientosStockService.exportarCsv({
      search: search.value.trim() || undefined,
      tipo_movimiento: type.value || undefined,
      direccion: direccion.value || undefined,
      pedido: pedido.value ? Number(pedido.value) : undefined,
      producto: producto.value ? Number(producto.value) : undefined,
      fecha_desde: fechaDesde.value || undefined,
      fecha_hasta: fechaHasta.value || undefined,
    })
    downloadBlob(blob, 'movimientos-stock.csv')
    toastTone.value = 'success'
    toastMessage.value = 'Reporte CSV exportado correctamente.'
  } catch (err) {
    toastTone.value = 'danger'
    toastMessage.value = err instanceof ApiError ? err.message : 'No pudimos exportar el CSV.'
  } finally {
    exportingCsv.value = false
  }
}

// P2: Modal de registro de entrada / salida manual (solo administración comercial)
const ajusteOpen = ref(false)
const ajusteTipo = ref<'ENTRADA' | 'SALIDA'>('ENTRADA')
const ajusteProductoId = ref('')
const ajusteProductoSearch = ref('')
const ajusteProductos = ref<Producto[]>([])
const ajusteProductosLoading = ref(false)
const ajusteCantidad = ref('')
const ajusteMotivo = ref('')
const ajusteObservaciones = ref('')
const ajusteSaving = ref(false)
const ajusteError = ref('')
const ajusteIdempotencyKey = ref('')
const motivosCatalogo = ref<CatalogoMotivosAjuste | null>(null)

const ajusteProductoSeleccionado = computed(
  () =>
    ajusteProductos.value.find((p) => String(p.id) === ajusteProductoId.value) ??
    (selectedProduct.value && String(selectedProduct.value.id) === ajusteProductoId.value
      ? selectedProduct.value
      : null),
)

const motivosDisponibles = computed(() => {
  if (!motivosCatalogo.value) return []
  return ajusteTipo.value === 'ENTRADA'
    ? motivosCatalogo.value.ENTRADA
    : motivosCatalogo.value.SALIDA
})

const motivoSeleccionadoMeta = computed(
  () => motivosDisponibles.value.find((m) => m.codigo === ajusteMotivo.value) ?? null,
)

const stockResultanteEstimado = computed(() => {
  const prod = ajusteProductoSeleccionado.value
  const qty = Number(ajusteCantidad.value)
  if (!prod || !Number.isFinite(qty) || qty <= 0) return null
  const actual = Number(prod.stock)
  return ajusteTipo.value === 'ENTRADA' ? actual + qty : actual - qty
})

watch(ajusteTipo, () => {
  const validCodes = new Set(motivosDisponibles.value.map((m) => m.codigo))
  if (!validCodes.has(ajusteMotivo.value)) {
    ajusteMotivo.value = motivosDisponibles.value[0]?.codigo ?? ''
  }
})

async function loadAjusteProductos(term = '') {
  ajusteProductosLoading.value = true
  try {
    const res = await productosService.list({
      search: term.trim() || undefined,
      page_size: 25,
    })
    ajusteProductos.value = res.results
  } catch {
    ajusteProductos.value = []
  } finally {
    ajusteProductosLoading.value = false
  }
}

async function openAjusteModal(tipoInicial: 'ENTRADA' | 'SALIDA' = 'ENTRADA') {
  ajusteTipo.value = tipoInicial
  ajusteCantidad.value = ''
  ajusteObservaciones.value = ''
  ajusteError.value = ''
  ajusteIdempotencyKey.value = generateUuidV4()
  ajusteProductoId.value = selectedProduct.value ? String(selectedProduct.value.id) : ''
  ajusteOpen.value = true

  if (!motivosCatalogo.value) {
    try {
      motivosCatalogo.value = await movimientosStockService.motivosAjuste()
    } catch {
      motivosCatalogo.value = null
    }
  }
  ajusteMotivo.value = motivosDisponibles.value[0]?.codigo ?? ''
  await loadAjusteProductos(ajusteProductoSearch.value)
}

async function submitAjuste() {
  if (ajusteSaving.value) return
  ajusteError.value = ''
  const prodId = Number(ajusteProductoId.value)
  if (!prodId) {
    ajusteError.value = 'Selecciona un producto.'
    return
  }
  const qty = Number(ajusteCantidad.value)
  if (!Number.isFinite(qty) || qty <= 0) {
    ajusteError.value = 'Ingresa una cantidad mayor a cero.'
    return
  }
  if (!ajusteMotivo.value) {
    ajusteError.value = 'Selecciona un motivo.'
    return
  }
  if (motivoSeleccionadoMeta.value?.requiere_observaciones && !ajusteObservaciones.value.trim()) {
    ajusteError.value = 'Las correcciones excepcionales requieren una observación justificativa.'
    return
  }

  ajusteSaving.value = true
  try {
    await movimientosStockService.registrarAjuste(
      {
        producto: prodId,
        tipo_operacion: ajusteTipo.value,
        cantidad: ajusteCantidad.value.trim(),
        motivo: ajusteMotivo.value as never,
        observaciones: ajusteObservaciones.value.trim(),
      },
      ajusteIdempotencyKey.value,
    )
    ajusteOpen.value = false
    toastTone.value = 'success'
    toastMessage.value =
      ajusteTipo.value === 'ENTRADA'
        ? 'Entrada de stock registrada correctamente.'
        : 'Salida de stock registrada correctamente.'
    await Promise.all([load(), loadSelectedProduct()])
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      ajusteIdempotencyKey.value = generateUuidV4()
    }
    ajusteError.value =
      err instanceof ApiError ? err.message : 'No pudimos registrar el movimiento.'
  } finally {
    ajusteSaving.value = false
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

watch(
  [search, type, direccion, pedido, producto, fechaDesde, fechaHasta, reportMode],
  (_newValues, oldValues) => {
    if (restoringRoute || !mounted) return
    if (page.value !== 1) page.value = 1
    if (oldValues && producto.value !== oldValues[4]) {
      void loadSelectedProduct()
    }
    const onlySearchChanged =
      oldValues &&
      type.value === oldValues[1] &&
      direccion.value === oldValues[2] &&
      pedido.value === oldValues[3] &&
      producto.value === oldValues[4] &&
      fechaDesde.value === oldValues[5] &&
      fechaHasta.value === oldValues[6] &&
      reportMode.value === oldValues[7]
    scheduleLoad(onlySearchChanged ? 300 : 0)
  },
)

watch(page, () => {
  if (restoringRoute || !mounted) return
  scheduleLoad(0)
})

watch(
  () => route.fullPath,
  async () => {
    if (synchronizing || !mounted) return
    const incomingDir = queryString('direccion')
    const incoming = {
      search: queryString('q'),
      type: queryString('tipo'),
      direccion: (incomingDir === 'ENTRADA' || incomingDir === 'SALIDA' ? incomingDir : '') as
        'ENTRADA' | 'SALIDA' | '',
      pedido: routePositiveInt('pedido'),
      producto: routePositiveInt('producto'),
      fechaDesde: routeDate('desde'),
      fechaHasta: routeDate('hasta'),
      reportMode: queryString('vista') === 'reporte',
      page: Math.max(1, Number(queryString('pagina')) || 1),
    }
    if (
      search.value === incoming.search &&
      type.value === incoming.type &&
      direccion.value === incoming.direccion &&
      pedido.value === incoming.pedido &&
      producto.value === incoming.producto &&
      fechaDesde.value === incoming.fechaDesde &&
      fechaHasta.value === incoming.fechaHasta &&
      reportMode.value === incoming.reportMode &&
      page.value === incoming.page
    ) {
      return
    }
    restoringRoute = true
    search.value = incoming.search
    type.value = incoming.type
    direccion.value = incoming.direccion
    pedido.value = incoming.pedido
    producto.value = incoming.producto
    fechaDesde.value = incoming.fechaDesde
    fechaHasta.value = incoming.fechaHasta
    reportMode.value = incoming.reportMode
    page.value = incoming.page
    if (debounce) clearTimeout(debounce)
    await nextTick()
    restoringRoute = false
    void load()
    void loadSelectedProduct()
  },
)

onMounted(() => {
  mounted = true
  void load()
  void loadSelectedProduct()
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
    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      :tone="toastTone"
      @close="toastMessage = ''"
    />

    <PageHeader
      title="Movimientos de stock"
      description="Historial inmutable generado por las operaciones comerciales y ajustes autorizados de HOMEX."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button
          variant="secondary"
          :disabled="exportingCsv || Boolean(dateError)"
          @click="exportCsv"
        >
          <Download :size="16" aria-hidden="true" />
          {{ exportingCsv ? 'Exportando...' : 'Exportar CSV' }}
        </Button>
        <Button v-if="canAdmin" @click="openAjusteModal('ENTRADA')">
          <Plus :size="16" aria-hidden="true" />
          Registrar movimiento
        </Button>
      </template>
    </PageHeader>

    <section
      v-if="selectedProduct && !selectedProductLoading"
      class="product-context-card"
      aria-label="Resumen contextual del producto"
    >
      <div class="product-context-card__header">
        <div>
          <RouterLink :to="`/productos/${selectedProduct.id}`" class="product-context-card__title">
            {{ selectedProduct.nombre }}
          </RouterLink>
          <p class="product-context-card__meta">
            SKU: {{ selectedProduct.sku || `#${selectedProduct.id}` }} · Unidad:
            {{ selectedProduct.unidad_stock_info?.nombre || '—' }}
          </p>
        </div>
        <div class="product-context-card__actions">
          <Badge
            v-if="estadoStockMeta(selectedProduct.estado_stock).showBadge"
            :tone="estadoStockMeta(selectedProduct.estado_stock).tone"
          >
            {{ estadoStockMeta(selectedProduct.estado_stock).label }}
          </Badge>
          <Button variant="secondary" @click="router.push(`/productos/${selectedProduct.id}`)">
            Volver al producto
          </Button>
        </div>
      </div>
      <div class="product-context-card__kpis">
        <div>
          <span>Stock actual</span>
          <strong>{{ unidadesProducto(selectedProduct, selectedProduct.stock) }}</strong>
        </div>
        <div>
          <span>Demanda pendiente</span>
          <strong>{{
            unidadesProducto(selectedProduct, selectedProduct.demanda_pendiente)
          }}</strong>
        </div>
        <div>
          <span>Disponibilidad referencial</span>
          <Badge :tone="disponibilidadMeta(selectedProduct.disponibilidad_referencial).tone">
            {{ unidadesProducto(selectedProduct, selectedProduct.disponibilidad_referencial) }}
          </Badge>
        </div>
      </div>
    </section>

    <section class="stock-filters" aria-label="Buscar y filtrar movimientos de stock">
      <div class="stock-filters__main">
        <div class="stock-search">
          <SearchField v-model="search" label="Buscar por SKU, producto, responsable o #pedido" />
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
        <div class="stock-filter-select">
          <Select
            v-model="direccion"
            name="direccion-movimiento"
            label="Dirección"
            :options="[
              { label: 'Todas', value: '' },
              { label: 'Entradas (+)', value: 'ENTRADA' },
              { label: 'Salidas (-)', value: 'SALIDA' },
            ]"
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
    <template v-else>
      <section
        v-if="reportMode && reporteResumen"
        class="report-summary-bar"
        aria-label="Resumen del período"
      >
        <div>
          <span>Entradas del período</span>
          <strong class="variation-qty--in"
            >+{{ reporteResumen.total_entradas }} {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div>
          <span>Salidas del período</span>
          <strong class="variation-qty--out"
            >-{{ reporteResumen.total_salidas }} {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div>
          <span>Variación neta</span>
          <strong
            >{{ Number(reporteResumen.variacion_neta) > 0 ? '+' : ''
            }}{{ reporteResumen.variacion_neta }} {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div v-if="reporteResumen.saldo_inicial_periodo != null">
          <span>Saldo inicial del período</span>
          <strong
            >{{ reporteResumen.saldo_inicial_periodo }} {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div v-if="reporteResumen.saldo_final_periodo != null">
          <span>Saldo final del período</span>
          <strong
            >{{ reporteResumen.saldo_final_periodo }} {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
      </section>

      <p v-if="reportMode && limitacionSaldo" class="report-limitation-note" role="status">
        {{ limitacionSaldo }}
      </p>

      <EmptyState
        v-if="!rows.length"
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
          <span>{{ reportMode ? 'Reporte operativo HOMEX' : 'Kardex operativo HOMEX' }}</span>
        </div>

        <div class="stock-table">
          <table>
            <caption class="sr-only">
              Historial de movimientos de stock
            </caption>
            <colgroup>
              <col class="col-product" />
              <col class="col-variation" />
              <col v-if="reportMode && saldoReconstruible" class="col-balance" />
              <col class="col-trace" />
              <col class="col-actor" />
              <col class="col-date" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Producto y movimiento</th>
                <th scope="col">Tipo y variación</th>
                <th v-if="reportMode && saldoReconstruible" scope="col">Saldo</th>
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
                      <RouterLink
                        :to="`/productos/${row.producto}`"
                        class="product-identity__link"
                        :title="row.producto_resumen.nombre"
                      >
                        {{ row.producto_resumen.nombre }}
                      </RouterLink>
                      <span class="product-sku">
                        SKU: {{ row.producto_resumen.sku || `Prod. ${row.producto}` }} · Mov.
                        {{ row.id }}
                      </span>
                    </div>
                  </div>
                </td>

                <td class="variation-cell" data-label="Tipo y variación">
                  <div class="variation-stack">
                    <div class="variation-badges">
                      <Badge
                        :tone="movementTone(row.tipo_movimiento_info.codigo)"
                        :title="row.tipo_movimiento_info.nombre"
                      >
                        {{
                          movementLabel(
                            row.tipo_movimiento_info.codigo,
                            row.tipo_movimiento_info.nombre,
                          )
                        }}
                      </Badge>
                      <Badge v-if="row.motivo_label" tone="neutral">
                        {{ row.motivo_label }}
                      </Badge>
                    </div>
                    <div class="variation-amount">
                      <component
                        :is="Number(row.cantidad) < 0 ? ArrowDownRight : ArrowUpRight"
                        :size="14"
                        :class="
                          Number(row.cantidad) < 0 ? 'variation-qty--out' : 'variation-qty--in'
                        "
                        aria-hidden="true"
                      />
                      <strong
                        class="variation-qty"
                        :class="
                          Number(row.cantidad) < 0 ? 'variation-qty--out' : 'variation-qty--in'
                        "
                      >
                        {{ Number(row.cantidad) > 0 ? '+' : '' }}{{ row.cantidad }}
                      </strong>
                      <span class="variation-unit">
                        {{ row.producto_resumen.unidad_stock_info.nombre }}
                        ({{ Number(row.cantidad) < 0 ? 'Salida' : 'Entrada' }})
                      </span>
                    </div>
                  </div>
                </td>

                <td v-if="reportMode && saldoReconstruible" class="balance-cell" data-label="Saldo">
                  <div
                    v-if="'saldo_posterior' in row && row.saldo_posterior != null"
                    class="balance-stack"
                  >
                    <strong
                      >{{ row.saldo_posterior }}
                      {{ row.producto_resumen.unidad_stock_info.nombre }}</strong
                    >
                    <small>Ant.: {{ row.saldo_anterior }}</small>
                  </div>
                  <span v-else>—</span>
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
                      <UserCheck
                        v-if="row.responsable?.display_name"
                        :size="14"
                        aria-hidden="true"
                      />
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
    </template>

    <Modal
      :open="ajusteOpen"
      title="Registrar movimiento de inventario"
      description="Registra una entrada o salida manual de tipo Ajuste. Esta operación quedará registrada permanentemente y no podrá editarse ni eliminarse."
      @close="ajusteOpen = false"
    >
      <form id="ajuste-stock-form" class="ajuste-form" @submit.prevent="submitAjuste">
        <div class="ajuste-tipo-toggle" role="group" aria-label="Tipo de operación">
          <button
            type="button"
            class="ajuste-tipo-btn"
            :class="{ 'ajuste-tipo-btn--active-in': ajusteTipo === 'ENTRADA' }"
            @click="ajusteTipo = 'ENTRADA'"
          >
            <ArrowUpRight :size="16" aria-hidden="true" />
            Entrada (+)
          </button>
          <button
            type="button"
            class="ajuste-tipo-btn"
            :class="{ 'ajuste-tipo-btn--active-out': ajusteTipo === 'SALIDA' }"
            @click="ajusteTipo = 'SALIDA'"
          >
            <ArrowDownRight :size="16" aria-hidden="true" />
            Salida (-)
          </button>
        </div>

        <div class="ajuste-product-picker">
          <SearchField
            v-model="ajusteProductoSearch"
            label="Buscar producto por nombre o SKU"
            @update:model-value="loadAjusteProductos"
          />
          <Select
            v-model="ajusteProductoId"
            name="ajuste-producto"
            label="Producto"
            :disabled="ajusteProductosLoading"
            :options="[
              { label: 'Selecciona un producto', value: '' },
              ...ajusteProductos.map((p) => ({
                label: `${p.nombre} (${p.sku || `#${p.id}`}) · Stock: ${unidadesProducto(p, p.stock)}`,
                value: String(p.id),
              })),
            ]"
          />
        </div>

        <TextField
          v-model="ajusteCantidad"
          name="ajuste-cantidad"
          :label="`Cantidad${ajusteProductoSeleccionado ? ` (${ajusteProductoSeleccionado.unidad_stock_info?.nombre || ''})` : ''}`"
          type="number"
          :step="ajusteProductoSeleccionado?.unidad_stock_info?.codigo === 'M2' ? '0.0001' : '1'"
          min="0"
          placeholder="0"
        />

        <Select
          v-model="ajusteMotivo"
          name="ajuste-motivo"
          label="Motivo"
          :options="motivosDisponibles.map((m) => ({ label: m.nombre, value: m.codigo }))"
        />

        <TextAreaField
          v-model="ajusteObservaciones"
          name="ajuste-observaciones"
          :label="
            motivoSeleccionadoMeta?.requiere_observaciones
              ? 'Observaciones (obligatoria para corrección excepcional)'
              : 'Observaciones (opcional)'
          "
          placeholder="Describe el respaldo o detalle del movimiento..."
          :rows="3"
        />

        <div v-if="ajusteProductoSeleccionado" class="ajuste-preview">
          <div>
            <span>Stock actual</span>
            <strong>{{
              unidadesProducto(ajusteProductoSeleccionado, ajusteProductoSeleccionado.stock)
            }}</strong>
          </div>
          <div>
            <span>Variación solicitada</span>
            <strong :class="ajusteTipo === 'ENTRADA' ? 'variation-qty--in' : 'variation-qty--out'">
              {{ ajusteTipo === 'ENTRADA' ? '+' : '-' }}{{ ajusteCantidad || '0' }}
            </strong>
          </div>
          <div>
            <span>Stock resultante estimado</span>
            <strong>
              {{
                stockResultanteEstimado !== null
                  ? unidadesProducto(ajusteProductoSeleccionado, stockResultanteEstimado)
                  : '—'
              }}
            </strong>
          </div>
        </div>

        <p v-if="ajusteError" class="stock-alert" role="alert">{{ ajusteError }}</p>
      </form>
      <template #footer>
        <Button variant="secondary" :disabled="ajusteSaving" @click="ajusteOpen = false">
          Cancelar
        </Button>
        <Button type="submit" form="ajuste-stock-form" :disabled="ajusteSaving">
          {{ ajusteSaving ? 'Registrando...' : 'Confirmar movimiento' }}
        </Button>
      </template>
    </Modal>
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
.product-context-card {
  display: grid;
  gap: 0.9rem;
  padding: 1rem 1.15rem;
  margin-bottom: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card, var(--radius-control));
  background: var(--color-surface);
}
.product-context-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}
.product-context-card__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}
.product-context-card__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
}
.product-context-card__title:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.product-context-card__meta {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
.product-context-card__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.75rem;
}
.product-context-card__kpis > div {
  display: grid;
  gap: 0.2rem;
  justify-items: start;
}
.product-context-card__kpis span {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
.report-summary-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.report-summary-bar > div {
  display: grid;
  gap: 0.15rem;
}
.report-summary-bar span {
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}
.report-limitation-note {
  margin: 0 0 0.75rem;
  padding: 0.65rem 0.9rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  font-size: 0.84rem;
}
.product-identity__link {
  font-weight: 650;
  color: var(--color-text);
  text-decoration: none;
}
.product-identity__link:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.variation-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.balance-stack {
  display: grid;
  gap: 0.15rem;
  font-variant-numeric: tabular-nums;
}
.balance-stack small {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.ajuste-form {
  display: grid;
  gap: 0.9rem;
}
.ajuste-tipo-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
.ajuste-tipo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
}
.ajuste-tipo-btn--active-in {
  border-color: var(--color-success, #16a34a);
  background: color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent);
}
.ajuste-tipo-btn--active-out {
  border-color: var(--color-danger, #dc2626);
  background: color-mix(in srgb, var(--color-danger, #dc2626) 12%, transparent);
}
.ajuste-product-picker {
  display: grid;
  gap: 0.65rem;
}
.ajuste-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-hover);
}
.ajuste-preview > div {
  display: grid;
  gap: 0.15rem;
}
.ajuste-preview span {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
