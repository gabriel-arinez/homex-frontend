<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  CornerDownRight,
  Cpu,
  Download,
  PackageCheck,
  PackagePlus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Tag,
} from '@lucide/vue'
import type {
  MovimientoReporteItem,
  MovimientoStock,
  Producto,
  ReporteResumen,
  ValorCatalogoPublico,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import ProductoStockAjusteModal from '@/modules/productos/components/ProductoStockAjusteModal.vue'
import { productosService } from '@/modules/productos/services/productosService'
import {
  cantidadProducto,
  disponibilidadMeta,
  estadoStockMeta,
  unidadesProducto,
} from '@/modules/productos/utils/presentacionCatalogo'
import { ApiError } from '@/shared/api'
import { downloadBlob } from '@/shared/download/downloadBlob'
import { buildExportFilename } from '@/shared/download/exportFilename'
import { movimientosStockService } from '../services/movimientosStockService'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import CreatorTag from '@/shared/ui/CreatorTag.vue'
import DatePresentation from '@/shared/ui/DatePresentation.vue'
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

function formatSignedQuantity(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === '') return '—'
  const num = Number(value)
  const formatted = cantidadProducto(value)
  if (formatted === '—') return formatted
  return Number.isFinite(num) && num > 0 ? `+${formatted}` : formatted
}

function formatMovementObservation(row: {
  observaciones?: string | null
  pedido_relacionado?: number | null
  tipo_movimiento_info?: { codigo?: string } | null
}): string {
  const obs = (row.observaciones ?? '').trim()
  if (!obs) return '—'
  if (row.pedido_relacionado) {
    const cleaned = obs
      .replace(new RegExp(`\\s*/\\s*pedido\\s*#?${row.pedido_relacionado}\\b`, 'i'), '')
      .trim()
    if (cleaned) return cleaned
  }
  return obs
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

async function exportExcel() {
  if (dateError.value || exportingCsv.value) return
  exportingCsv.value = true
  try {
    const blob = await movimientosStockService.exportarExcel({
      search: search.value.trim() || undefined,
      tipo_movimiento: type.value || undefined,
      direccion: direccion.value || undefined,
      pedido: pedido.value ? Number(pedido.value) : undefined,
      producto: producto.value ? Number(producto.value) : undefined,
      fecha_desde: fechaDesde.value || undefined,
      fecha_hasta: fechaHasta.value || undefined,
    })
    const hasFullRange = Boolean(fechaDesde.value && fechaHasta.value)
    const tipoLabel = types.value.find((t) => t.codigo === type.value)?.nombre || type.value
    const dateSegment = hasFullRange
      ? `${fechaDesde.value}_a_${fechaHasta.value}`
      : fechaDesde.value
        ? `desde-${fechaDesde.value}`
        : fechaHasta.value
          ? `hasta-${fechaHasta.value}`
          : ''
    const filename = buildExportFilename(
      producto.value || hasFullRange ? 'reporte-stock' : 'movimientos-stock',
      [
        selectedProduct.value?.sku || (producto.value ? `prod-${producto.value}` : ''),
        selectedProduct.value?.sku ? selectedProduct.value?.nombre : '',
        pedido.value ? `pedido-${pedido.value}` : '',
        tipoLabel,
        direccion.value,
        search.value.trim(),
        dateSegment,
      ],
      'xlsx',
    )
    downloadBlob(blob, filename)
    toastTone.value = 'success'
    toastMessage.value = 'Reporte Excel exportado correctamente.'
  } catch (err) {
    toastTone.value = 'danger'
    toastMessage.value = err instanceof ApiError ? err.message : 'No pudimos exportar el Excel.'
  } finally {
    exportingCsv.value = false
  }
}

// P2: Modal de registro de entrada / salida manual (solo administración comercial)
const ajusteOpen = ref(false)
const ajusteTipo = ref<'ENTRADA' | 'SALIDA'>('ENTRADA')

function openAjusteModal(tipoInicial: 'ENTRADA' | 'SALIDA' = 'ENTRADA') {
  ajusteTipo.value = tipoInicial
  ajusteOpen.value = true
}

async function onAjusteSaved(_movimiento: MovimientoStock, tipo: 'ENTRADA' | 'SALIDA') {
  toastTone.value = 'success'
  toastMessage.value =
    tipo === 'ENTRADA'
      ? 'Entrada de stock registrada correctamente.'
      : 'Salida de stock registrada correctamente.'
  await Promise.all([load(), loadSelectedProduct()])
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
          @click="exportExcel"
        >
          <Download :size="16" aria-hidden="true" />
          {{ exportingCsv ? 'Exportando...' : 'Exportar Excel' }}
        </Button>
        <Button
          v-if="canAdmin && selectedProduct?.modalidad_abastecimiento !== 'BAJO_PEDIDO'"
          @click="openAjusteModal('ENTRADA')"
        >
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
        <div class="product-context-card__identity">
          <div class="product-context-card__thumb">
            <ProductImage
              :image="selectedProduct.imagen_principal"
              :alt="selectedProduct.nombre"
              :category-code="selectedProduct.categoria_info?.codigo"
              sizes="56px"
            />
          </div>
          <div>
            <RouterLink
              :to="`/productos/${selectedProduct.id}`"
              class="product-context-card__title"
            >
              {{ selectedProduct.nombre }}
            </RouterLink>
            <p class="product-context-card__meta">
              <Tag :size="12" aria-hidden="true" />
              SKU: {{ selectedProduct.sku || `#${selectedProduct.id}` }} · Unidad:
              {{ selectedProduct.unidad_stock_info?.nombre || '—' }}
            </p>
          </div>
        </div>
        <div class="product-context-card__actions">
          <Badge
            v-if="estadoStockMeta(selectedProduct.estado_stock).showBadge"
            :tone="estadoStockMeta(selectedProduct.estado_stock).tone"
          >
            {{ estadoStockMeta(selectedProduct.estado_stock).label }}
          </Badge>
          <Button variant="secondary" @click="router.push(`/productos/${selectedProduct.id}`)">
            <ArrowLeft :size="16" aria-hidden="true" />
            Volver al producto
          </Button>
        </div>
      </div>
      <div class="product-context-card__kpis">
        <div class="context-kpi">
          <span class="context-kpi__icon context-kpi__icon--success" aria-hidden="true">
            <PackageCheck :size="17" />
          </span>
          <div>
            <span>Stock actual</span>
            <strong>{{ unidadesProducto(selectedProduct, selectedProduct.stock) }}</strong>
          </div>
        </div>
        <div class="context-kpi">
          <span class="context-kpi__icon context-kpi__icon--warning" aria-hidden="true">
            <Clock3 :size="17" />
          </span>
          <div>
            <span>Demanda pendiente</span>
            <strong>{{
              unidadesProducto(selectedProduct, selectedProduct.demanda_pendiente)
            }}</strong>
          </div>
        </div>
        <div class="context-kpi">
          <span class="context-kpi__icon context-kpi__icon--info" aria-hidden="true">
            <Boxes :size="17" />
          </span>
          <div>
            <span>Disponibilidad referencial</span>
            <Badge v-if="selectedProduct.modalidad_abastecimiento === 'BAJO_PEDIDO'" tone="info">
              Disponible bajo pedido
            </Badge>
            <Badge
              v-else
              :tone="disponibilidadMeta(selectedProduct.disponibilidad_referencial).tone"
            >
              {{ unidadesProducto(selectedProduct, selectedProduct.disponibilidad_referencial) }}
            </Badge>
          </div>
        </div>
      </div>
    </section>

    <section class="stock-filters" aria-label="Buscar y filtrar movimientos de stock">
      <div class="stock-filters__main">
        <div class="stock-search">
          <SearchField v-model="search" label="Buscar por SKU, producto, responsable o pedido" />
        </div>
        <div class="stock-filter-select">
          <Select
            v-model="type"
            name="tipo-movimiento"
            label="Tipo"
            :active="Boolean(type)"
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
            :active="Boolean(direccion)"
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
            :active="Boolean(fechaDesde)"
            :max="fechaHasta && fechaHasta < today ? fechaHasta : today"
          />
        </div>
        <div class="stock-filter-date">
          <TextField
            v-model="fechaHasta"
            name="fecha-hasta"
            label="Hasta"
            type="date"
            :active="Boolean(fechaHasta)"
            :min="fechaDesde || undefined"
            :max="today"
          />
        </div>
        <Button
          v-if="hasFilters"
          variant="danger"
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
            >+{{ cantidadProducto(reporteResumen.total_entradas) }}
            {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div>
          <span>Salidas del período</span>
          <strong class="variation-qty--out"
            >-{{ cantidadProducto(reporteResumen.total_salidas) }}
            {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div>
          <span>Variación neta</span>
          <strong
            >{{ formatSignedQuantity(reporteResumen.variacion_neta) }}
            {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div v-if="reporteResumen.saldo_inicial_periodo != null">
          <span>Saldo inicial del período</span>
          <strong
            >{{ cantidadProducto(reporteResumen.saldo_inicial_periodo) }}
            {{ reporteResumen.unidad_nombre }}</strong
          >
        </div>
        <div v-if="reporteResumen.saldo_final_periodo != null">
          <span>Saldo final del período</span>
          <strong
            >{{ cantidadProducto(reporteResumen.saldo_final_periodo) }}
            {{ reporteResumen.unidad_nombre }}</strong
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
                        {{ formatSignedQuantity(row.cantidad) }}
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
                      >{{ cantidadProducto(row.saldo_posterior) }}
                      {{ row.producto_resumen.unidad_stock_info.nombre }}</strong
                    >
                    <small>Ant.: {{ cantidadProducto(row.saldo_anterior) }}</small>
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
                    <CreatorTag
                      v-if="row.responsable?.display_name"
                      :name="row.responsable.display_name"
                    />
                    <span v-else class="actor-name">
                      <Cpu :size="14" aria-hidden="true" />
                      <strong>Sistema</strong>
                    </span>
                    <span class="actor-obs" :title="row.observaciones || 'Sin observaciones'">
                      {{ formatMovementObservation(row) }}
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

    <ProductoStockAjusteModal
      :open="ajusteOpen"
      :initial-product="selectedProduct"
      :initial-type="ajusteTipo"
      @close="ajusteOpen = false"
      @saved="onAjusteSaved"
    />
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
    minmax(13rem, 2.2fr)
    minmax(10rem, 1.15fr)
    minmax(8.5rem, 0.9fr)
    minmax(8.5rem, 0.85fr)
    minmax(8.5rem, 0.85fr)
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
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  flex: none;
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
  line-height: 1.3;
  white-space: normal;
  overflow-wrap: anywhere;
}
.product-sku {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: normal;
  overflow-wrap: anywhere;
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
  line-height: 1.3;
  white-space: normal;
  overflow-wrap: anywhere;
}
.actor-obs {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
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
.product-context-card__identity {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}
.product-context-card__thumb {
  width: 3.5rem;
  height: 3.5rem;
  flex: none;
  border-radius: 0.6rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-background);
}
.product-context-card__thumb :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.product-context-card__thumb :deep(.fallback-label) {
  display: none;
}
.product-context-card__thumb :deep(.fallback-icon-box) {
  width: 2.2rem;
  height: 2.2rem;
}
.product-context-card__title {
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
}
.product-context-card__title:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.product-context-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
.product-context-card__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}
.context-kpi {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.context-kpi > div:last-child {
  display: grid;
  gap: 0.2rem;
  justify-items: start;
}
.context-kpi__icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
}
.context-kpi__icon--success {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
}
.context-kpi__icon--warning {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
}
.context-kpi__icon--info {
  color: var(--color-info);
  background: var(--color-info-soft);
  border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
}
.product-context-card__kpis span {
  font-size: 0.76rem;
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
.ajuste-modal-icon {
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
.ajuste-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin-bottom: 1.1rem;
}
.ajuste-metric {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  min-width: 0;
}
.ajuste-metric--highlight {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
}
.ajuste-metric > div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}
.ajuste-metric span {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}
.ajuste-metric strong {
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
}
.ajuste-metric__icon {
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
.ajuste-metric__icon--primary {
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
  border-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
}
.ajuste-metric__icon--success {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
}
.ajuste-metric__icon--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.ajuste-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4, 1rem);
}
.ajuste-form__full {
  grid-column: 1 / -1;
}
.ajuste-section {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.ajuste-section__header {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 700;
}
.ajuste-section__header svg {
  color: var(--color-primary-accent);
}
.ajuste-section__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3, 0.75rem);
}
.ajuste-field-wrap {
  display: grid;
  gap: 0.25rem;
  align-content: start;
}
.ajuste-field-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
}
@media (max-width: 47.99rem) {
  .ajuste-board,
  .ajuste-form,
  .ajuste-section__grid {
    grid-template-columns: 1fr;
  }
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
  gap: 0.55rem;
}
.ajuste-product-results {
  display: grid;
  gap: 0.35rem;
  max-height: 13.5rem;
  overflow-y: auto;
  padding: 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.ajuste-product-results__state {
  margin: 0;
  padding: 0.65rem 0.75rem;
  font-size: 0.84rem;
  color: var(--color-text-secondary);
}
.ajuste-product-option {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}
.ajuste-product-option:hover {
  border-color: var(--color-border);
  background: var(--color-surface-hover);
}
.ajuste-product-option__icon {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}
.ajuste-product-option__body {
  display: grid;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}
.ajuste-product-option__body strong {
  font-size: 0.88rem;
  white-space: normal;
  overflow-wrap: anywhere;
}
.ajuste-product-option__body small {
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}
.ajuste-product-option__stock {
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.ajuste-selected-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-primary-accent, #b91c1c);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--color-primary-accent, #b91c1c) 6%, var(--color-surface));
}
.ajuste-selected-card__info {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}
.ajuste-selected-card__icon {
  flex-shrink: 0;
  color: var(--color-primary-accent, #b91c1c);
}
.ajuste-selected-card__info > div {
  display: grid;
  gap: 0.12rem;
}
.ajuste-selected-card__info strong {
  font-size: 0.92rem;
  white-space: normal;
  overflow-wrap: anywhere;
}
.ajuste-selected-card__info small {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
</style>
