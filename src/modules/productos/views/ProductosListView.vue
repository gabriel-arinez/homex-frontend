<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  Armchair,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutGrid,
  Layers,
  List,
  MoreVertical,
  Package,
  Pencil,
  Power,
  RotateCcw,
  Tag,
} from '@lucide/vue'
import type { FamiliaProducto, Producto, ValorCatalogoPublico } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { productosService } from '../services/productosService'
import {
  catalogoId,
  categoriaProducto,
  dineroProducto,
  estadoStockMeta,
  pageNumberProducto,
  resumenFichaProducto,
  unidadesProducto,
} from '../utils/presentacionCatalogo'
import ProductImage from '../components/ProductImage.vue'
import ProductoStockAjusteModal from '../components/ProductoStockAjusteModal.vue'
import {
  readCatalogImagesVisible,
  writeCatalogImagesVisible,
} from '@/shared/media/catalogImageVisibility'
import type { CatalogViewMode } from '@/shared/media/catalogViewPreference'
import { ApiError } from '@/shared/api'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import Toast from '@/shared/ui/Toast.vue'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const canCreate = computed(() => session.can('catalogo.crear_producto'))
const canAdmin = computed(() => session.can('comercial.administrar'))
const canOperate = computed(() => session.can('comercial.operar'))

function canEditProduct(product: Producto): boolean {
  return canAdmin.value || (canCreate.value && product.created_by === session.identity?.id)
}

const showImages = ref(readCatalogImagesVisible())
watch(showImages, writeCatalogImagesVisible)

const products = ref<Producto[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const toastMessage = ref('')
const toastTone = ref<'success' | 'danger'>('success')
const categoryError = ref('')
const categoryLoading = ref(true)
const categories = ref<ValorCatalogoPublico[]>([])
const families = ref<FamiliaProducto[]>([])
const familiesLoading = ref(false)
const showAdvanced = ref(false)

const openMenuId = ref<number | null>(null)
const ajusteStockOpen = ref(false)
const ajusteStockProduct = ref<Producto | null>(null)
const ajusteStockType = ref<'ENTRADA' | 'SALIDA'>('ENTRADA')
const toggleTarget = ref<Producto | null>(null)
const togglingStatus = ref(false)

const routeString = (key: string): string =>
  typeof route.query[key] === 'string' ? String(route.query[key]) : ''
const routeStatus = (): string =>
  ['todos', 'activos', 'inactivos'].includes(routeString('estado'))
    ? routeString('estado')
    : 'activos'
type StockFilter = '' | 'SIN_EXISTENCIAS' | 'STOCK_BAJO' | 'NORMAL' | 'SIN_MINIMO' | 'BAJO_PEDIDO'
const routeStockStatus = (): StockFilter => {
  const val = routeString('estado_stock')
  return ['SIN_EXISTENCIAS', 'STOCK_BAJO', 'NORMAL', 'SIN_MINIMO', 'BAJO_PEDIDO'].includes(val)
    ? (val as StockFilter)
    : ''
}
const routeInitialView = (): CatalogViewMode => {
  const qView = routeString('vista')
  return qView === 'lista' ? 'lista' : 'grid'
}
const hasExplicitEntryFilters = (): boolean =>
  Boolean(
    routeString('q') ||
    routeString('categoria') ||
    routeString('estado') ||
    routeString('estado_stock') ||
    extraKeys.some((key) => Boolean(routeString(key))),
  )

const search = ref(routeString('q'))
const status = ref(routeStatus())
const stockStatus = ref<StockFilter>(routeStockStatus())
const category = ref(catalogoId(routeString('categoria')))
const view = ref<CatalogViewMode>(routeInitialView())
const page = ref(pageNumberProducto(routeString('pagina')))
const size = 12

const extraKeys = [
  'familia',
  'marca',
  'modelo',
  'color_primario',
  'tipo',
  'material',
  'diseno',
  'acabado',
  'espesor_mm',
  'unidad_stock',
] as const
type ExtraKey = (typeof extraKeys)[number]
const extras = reactive<Record<ExtraKey, string>>({
  familia: catalogoId(routeString('familia')),
  marca: catalogoId(routeString('marca')),
  modelo: routeString('modelo'),
  color_primario: catalogoId(routeString('color_primario')),
  tipo: catalogoId(routeString('tipo')),
  material: catalogoId(routeString('material')),
  diseno: catalogoId(routeString('diseno')),
  acabado: catalogoId(routeString('acabado')),
  espesor_mm: routeString('espesor_mm'),
  unidad_stock: catalogoId(routeString('unidad_stock')),
})
showAdvanced.value = extraKeys.some((key) => Boolean(extras[key]))
const categoryCode = computed(
  () => categories.value.find((x) => String(x.id) === category.value)?.codigo,
)
const availableExtra = computed<ExtraKey[]>(() => {
  if (categoryCode.value === 'SILLA') return ['familia', 'marca', 'modelo', 'color_primario']
  if (categoryCode.value === 'PISO_FLOTANTE')
    return ['familia', 'marca', 'tipo', 'material', 'diseno', 'acabado', 'espesor_mm']
  if (categoryCode.value === 'OTRO') return ['familia', 'unidad_stock']
  return ['familia']
})
const pages = computed(() => Math.max(1, Math.ceil(total.value / size)))
const pageStart = computed(() => (total.value ? (page.value - 1) * size + 1 : 0))
const pageEnd = computed(() => Math.min(total.value, page.value * size))
const hasFilters = computed(
  () =>
    Boolean(search.value.trim()) ||
    status.value !== 'activos' ||
    Boolean(stockStatus.value) ||
    Boolean(category.value) ||
    extraKeys.some((key) => Boolean(extras[key])),
)
const hasSpecificFilters = computed(() =>
  Boolean(
    search.value.trim() ||
    category.value ||
    stockStatus.value ||
    extraKeys.some((key) => Boolean(extras[key])),
  ),
)
const emptyTitle = computed(() => {
  if (hasSpecificFilters.value) return 'Sin resultados'
  if (status.value === 'activos') return 'No hay productos activos'
  if (status.value === 'inactivos') return 'No hay productos inactivos'
  return 'Aún no hay productos registrados'
})
const emptyDescription = computed(() =>
  hasSpecificFilters.value
    ? 'No encontramos productos que coincidan con los criterios seleccionados.'
    : status.value === 'activos'
      ? 'No hay productos activos para mostrar. Puedes consultar también los inactivos.'
      : status.value === 'inactivos'
        ? 'No existen productos inactivos con los filtros actuales.'
        : 'El catálogo todavía no contiene productos registrados.',
)
const filterError = computed(() => {
  if (availableExtra.value.includes('modelo') && extras.modelo.trim().length > 150)
    return 'El modelo no puede superar 150 caracteres.'
  const thickness = extras.espesor_mm.trim()
  if (
    availableExtra.value.includes('espesor_mm') &&
    thickness &&
    (!/^\d{1,6}(?:\.\d{1,2})?$/.test(thickness) || Number(thickness) <= 0)
  )
    return 'Introduce un espesor válido, mayor que cero y con hasta dos decimales.'
  return ''
})
let requestId = 0
let debounce: ReturnType<typeof setTimeout> | undefined
let restoring = false
let mounted = false

const numberId = (value: string): number | undefined =>
  catalogoId(value) ? Number(value) : undefined
const familyOptions = computed(() => [
  { value: '', label: 'Todas las familias' },
  ...families.value
    .filter((x) => x.activo !== false)
    .map((x) => ({ value: String(x.id), label: x.nombre })),
])
const categoryOptions = computed(() => [
  { value: '', label: 'Todas las categorías' },
  ...categories.value.map((x) => ({ value: String(x.id), label: x.nombre })),
])

function queryFromFilters() {
  const query: Record<string, string | undefined> = {
    q: search.value.trim() || undefined,
    estado: status.value === 'activos' ? undefined : status.value,
    estado_stock: stockStatus.value || undefined,
    categoria: category.value || undefined,
    vista: view.value === 'grid' ? undefined : 'lista',
    pagina: page.value > 1 ? String(page.value) : undefined,
  }
  for (const key of availableExtra.value) query[key] = extras[key] || undefined
  return query
}
function routeMatches(query: Record<string, string | undefined>) {
  const keys = ['q', 'estado', 'estado_stock', 'categoria', 'vista', 'pagina', ...extraKeys]
  return keys.every((key) => (routeString(key) || undefined) === query[key])
}
function syncRoute() {
  const query = queryFromFilters()
  if (!routeMatches(query)) void router.replace({ query })
}
async function load() {
  const current = ++requestId
  loading.value = true
  error.value = ''
  if (filterError.value) {
    products.value = []
    total.value = 0
    error.value = filterError.value
    loading.value = false
    return
  }
  try {
    const query: NonNullable<Parameters<typeof productosService.list>[0]> = {
      search: search.value.trim() || undefined,
      activo: status.value === 'todos' ? undefined : status.value === 'activos',
      estado_stock: stockStatus.value || undefined,
      categoria: numberId(category.value),
      page: page.value,
      page_size: size,
    }
    for (const key of availableExtra.value) {
      const value = extras[key]
      if (!value) continue
      if (key === 'modelo' || key === 'espesor_mm') query[key] = value
      else query[key] = Number(value) as never
    }
    const response = await productosService.list(query)
    if (current !== requestId) return
    const lastPage = Math.max(1, Math.ceil(response.count / size))
    if (page.value > lastPage) {
      page.value = lastPage
      return
    }
    products.value = response.results
    total.value = response.count
  } catch (cause) {
    if (current !== requestId) return
    products.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'
  } finally {
    if (current === requestId) loading.value = false
  }
}
function scheduleLoad(delay = 0) {
  ++requestId
  if (debounce) clearTimeout(debounce)
  loading.value = true
  if (delay) debounce = setTimeout(() => void load(), delay)
  else void load()
}
function filtersChanged(delay = 0) {
  if (restoring) return
  if (page.value > 1) {
    page.value = 1
    return
  }
  syncRoute()
  scheduleLoad(delay)
}
function changeCategory(value: string) {
  category.value = catalogoId(value)
  for (const key of extraKeys) extras[key] = ''
  notice.value = ''
}
function clearFilters() {
  search.value = ''
  status.value = 'activos'
  stockStatus.value = ''
  changeCategory('')
}
function setViewMode(next: CatalogViewMode) {
  view.value = next
}
async function loadCategories(applyDefaultChair = false) {
  categoryLoading.value = true
  categoryError.value = ''
  try {
    const items = await proformasService.options('CATEGORIA_PRODUCTO')
    categories.value = items.filter(
      (item) =>
        ['SILLA', 'PISO_FLOTANTE', 'OTRO'].includes(item.codigo) &&
        item.concepto_codigo === 'CATEGORIA_PRODUCTO',
    )
    if (category.value && !categories.value.some((x) => String(x.id) === category.value)) {
      changeCategory('')
      notice.value =
        'La categoría seleccionada ya no está disponible. Se mostrará el catálogo general.'
    } else if (applyDefaultChair && !category.value) {
      const silla = categories.value.find((x) => x.codigo === 'SILLA')
      if (silla) {
        restoring = true
        category.value = String(silla.id)
        await nextTick()
        restoring = false
      }
    }
    if (category.value || applyDefaultChair) scheduleLoad()
  } catch {
    categoryError.value =
      'No se pudieron cargar las categorías. Reintenta para filtrar o crear productos.'
    if (applyDefaultChair) scheduleLoad()
  } finally {
    categoryLoading.value = false
  }
}
async function loadFamilies() {
  familiesLoading.value = true
  try {
    const response = await proformasService.families()
    families.value = response.results
  } catch {
    // Mantiene la barra operativa aun si falla la carga de familias.
  } finally {
    familiesLoading.value = false
  }
}
function createProduct(code: 'SILLA' | 'PISO_FLOTANTE' | 'OTRO') {
  if (!canCreate.value) return
  void router.push({ path: '/productos/nuevo', query: { categoria: code } })
}
function categoryIcon(product: Producto) {
  const code = product.categoria_info?.codigo
  if (code === 'SILLA') return Armchair
  if (code === 'PISO_FLOTANTE') return Layers
  return Package
}
function toggleMenu(productId: number) {
  openMenuId.value = openMenuId.value === productId ? null : productId
}
function closeMenus() {
  openMenuId.value = null
}
function openProductDetail(product: Producto) {
  closeMenus()
  void router.push(`/productos/${product.id}`)
}
function openProductEdit(product: Producto) {
  closeMenus()
  void router.push({ path: `/productos/${product.id}`, query: { editar: '1' } })
}
function openProductMovements(product: Producto) {
  closeMenus()
  void router.push({ path: '/movimientos-stock', query: { producto: String(product.id) } })
}
function openProductStockAjuste(product: Producto, type: 'ENTRADA' | 'SALIDA') {
  closeMenus()
  ajusteStockProduct.value = product
  ajusteStockType.value = type
  ajusteStockOpen.value = true
}
async function onAjusteSaved(_movimiento: unknown, tipo: 'ENTRADA' | 'SALIDA') {
  toastTone.value = 'success'
  toastMessage.value =
    tipo === 'ENTRADA'
      ? 'Entrada de stock registrada correctamente.'
      : 'Salida de stock registrada correctamente.'
  await load()
}
function askToggleProductStatus(product: Producto) {
  closeMenus()
  toggleTarget.value = product
}
async function confirmToggleProductStatus() {
  const target = toggleTarget.value
  if (!target || togglingStatus.value) return
  togglingStatus.value = true
  try {
    const nextActive = target.activo === false
    await productosService.update(target.id, { activo: nextActive }, target.revision)
    toggleTarget.value = null
    toastTone.value = 'success'
    toastMessage.value = nextActive ? 'Producto activado.' : 'Producto desactivado.'
    await load()
  } catch (err) {
    toastTone.value = 'danger'
    toastMessage.value =
      err instanceof ApiError ? err.message : 'No pudimos actualizar el estado del producto.'
    toggleTarget.value = null
  } finally {
    togglingStatus.value = false
  }
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.action-menu')) {
    closeMenus()
  }
}
function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenus()
}

function restoreFilters() {
  restoring = true
  search.value = routeString('q')
  status.value = routeStatus()
  stockStatus.value = routeStockStatus()
  category.value = catalogoId(routeString('categoria'))
  view.value = routeInitialView()
  page.value = pageNumberProducto(routeString('pagina'))
  for (const key of extraKeys)
    extras[key] =
      key === 'modelo' || key === 'espesor_mm' ? routeString(key) : catalogoId(routeString(key))
  showAdvanced.value = false
  void nextTick(() => {
    restoring = false
    if (mounted) scheduleLoad()
  })
}
watch([search, status, stockStatus, category], (next, previous) =>
  filtersChanged(next[0] !== previous[0] ? 300 : 0),
)
watch(extras, () => filtersChanged())
watch(page, () => {
  if (restoring) return
  syncRoute()
  scheduleLoad()
})
watch(view, () => {
  if (!restoring) syncRoute()
})
watch(
  () => route.fullPath,
  () => {
    if (!routeMatches(queryFromFilters())) restoreFilters()
  },
)
onMounted(() => {
  mounted = true
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
  const shouldDefaultChair = !hasExplicitEntryFilters()
  if (!shouldDefaultChair) void load()
  void loadCategories(shouldDefaultChair)
  void loadFamilies()
})
onBeforeUnmount(() => {
  mounted = false
  ++requestId
  if (debounce) clearTimeout(debounce)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div class="productos-bandeja">
    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      :tone="toastTone"
      @close="toastMessage = ''"
    />

    <PageHeader
      title="Productos"
      description="Consulta existencias, precios y fichas técnicas del catálogo comercial."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <div
          v-if="canCreate"
          class="create-shortcuts"
          role="group"
          aria-label="Crear producto por categoría"
        >
          <Button variant="secondary" @click="createProduct('SILLA')">
            <Armchair :size="18" aria-hidden="true" /> Silla
          </Button>
          <Button variant="secondary" @click="createProduct('PISO_FLOTANTE')">
            <Layers :size="18" aria-hidden="true" /> Piso
          </Button>
          <Button variant="secondary" @click="createProduct('OTRO')">
            <Package :size="18" aria-hidden="true" /> Otro
          </Button>
        </div>
      </template>
    </PageHeader>

    <div class="product-toolbar">
      <strong>Catálogo de productos</strong>
      <button
        v-if="view === 'lista'"
        type="button"
        class="table-image-toggle"
        :aria-pressed="showImages"
        @click="showImages = !showImages"
      >
        <EyeOff v-if="showImages" :size="17" aria-hidden="true" />
        <Eye v-else :size="17" aria-hidden="true" />
        {{ showImages ? 'Ocultar imágenes' : 'Mostrar imágenes' }}
      </button>
      <div class="view-switch" role="group" aria-label="Vista del catálogo">
        <button
          type="button"
          :aria-pressed="view === 'grid'"
          :class="{ selected: view === 'grid' }"
          @click="setViewMode('grid')"
        >
          <LayoutGrid :size="17" aria-hidden="true" />Cuadrícula
        </button>
        <button
          type="button"
          :aria-pressed="view === 'lista'"
          :class="{ selected: view === 'lista' }"
          @click="setViewMode('lista')"
        >
          <List :size="17" aria-hidden="true" />Lista
        </button>
      </div>
    </div>

    <section class="filters" aria-label="Filtros de productos">
      <div class="filters-primary">
        <div class="search-wrap">
          <SearchField v-model="search" label="Buscar por SKU o nombre" />
        </div>
        <Select
          :model-value="category"
          name="categoria-producto-filtro"
          label="Categoría"
          :active="Boolean(category)"
          :options="categoryOptions"
          :disabled="categoryLoading || Boolean(categoryError)"
          @update:model-value="changeCategory"
        />
        <Select
          v-model="extras.familia"
          name="familia-producto-filtro"
          label="Familia"
          :active="Boolean(extras.familia)"
          :options="familyOptions"
          :disabled="familiesLoading"
        />
        <Select
          v-model="status"
          name="estado-producto"
          label="Estado"
          :active="status !== 'activos'"
          :options="[
            { label: 'Activos', value: 'activos' },
            { label: 'Todos', value: 'todos' },
            { label: 'Inactivos', value: 'inactivos' },
          ]"
        />
        <Select
          v-model="stockStatus"
          name="existencias-producto-filtro"
          label="Existencias"
          :active="Boolean(stockStatus)"
          :options="[
            { label: 'Todas', value: '' },
            { label: 'Con stock normal', value: 'NORMAL' },
            { label: 'Stock bajo', value: 'STOCK_BAJO' },
            { label: 'Sin existencias', value: 'SIN_EXISTENCIAS' },
            { label: 'Disponible bajo pedido', value: 'BAJO_PEDIDO' },
            { label: 'Sin mínimo configurado', value: 'SIN_MINIMO' },
          ]"
        />
        <div v-if="hasFilters" class="filters-primary__actions">
          <Button
            variant="danger"
            class="clear-filters-btn"
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
            @click="clearFilters"
          >
            <RotateCcw :size="16" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>

    <p v-if="categoryError" class="options-warning" role="status">
      {{ categoryError }} <button type="button" @click="loadCategories()">Reintentar</button>
    </p>
    <p v-if="notice" role="status" class="options-warning">{{ notice }}</p>

    <div class="results-header">
      <strong v-if="!loading && !error"
        >{{ total }} producto{{ total === 1 ? '' : 's' }} encontrado{{
          total === 1 ? '' : 's'
        }}</strong
      >
      <span v-else>Catálogo de productos</span>
      <span class="results-order">Ordenados alfabéticamente</span>
    </div>
    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <Button v-if="!filterError" variant="secondary" @click="load">Reintentar</Button>
    </ErrorState>
    <EmptyState v-else-if="!products.length" :title="emptyTitle" :description="emptyDescription">
      <Button v-if="hasFilters" variant="secondary" @click="clearFilters">Limpiar filtros</Button>
      <Button v-else-if="status === 'activos'" variant="secondary" @click="status = 'todos'"
        >Ver todos los productos</Button
      >
      <p v-else-if="canCreate">Utiliza Silla, Piso u Otro para registrar el primer producto.</p>
    </EmptyState>
    <template v-else>
      <div v-if="view === 'grid'" class="product-grid">
        <article
          v-for="product in products"
          :key="product.id"
          class="product-card"
          :class="{ 'product-card--menu-open': openMenuId === product.id }"
        >
          <div class="product-visual">
            <ProductImage
              :image="product.imagen_principal"
              :alt="product.nombre"
              :category-code="product.categoria_info?.codigo"
            />
            <div class="card-corner-actions action-menu">
              <button
                type="button"
                class="menu-trigger"
                :aria-label="'Acciones de ' + product.nombre"
                :aria-expanded="openMenuId === product.id"
                aria-haspopup="menu"
                @click.stop="toggleMenu(product.id)"
              >
                <MoreVertical :size="18" aria-hidden="true" />
              </button>
              <div
                v-if="openMenuId === product.id"
                class="menu-dropdown"
                role="menu"
                :aria-label="'Acciones disponibles para ' + product.nombre"
              >
                <button
                  type="button"
                  role="menuitem"
                  class="menu-item--info"
                  @click="openProductDetail(product)"
                >
                  <Eye :size="15" aria-hidden="true" /> Ver ficha del producto
                </button>
                <button
                  v-if="canEditProduct(product)"
                  type="button"
                  role="menuitem"
                  class="menu-item--warning"
                  @click="openProductEdit(product)"
                >
                  <Pencil :size="15" aria-hidden="true" /> Editar producto
                </button>
                <button
                  v-if="canAdmin && product.modalidad_abastecimiento !== 'BAJO_PEDIDO'"
                  type="button"
                  role="menuitem"
                  class="menu-item--success"
                  @click="openProductStockAjuste(product, 'ENTRADA')"
                >
                  <ArrowUpRight :size="15" aria-hidden="true" /> Registrar entrada
                </button>
                <button
                  v-if="canAdmin && product.modalidad_abastecimiento !== 'BAJO_PEDIDO'"
                  type="button"
                  role="menuitem"
                  class="menu-item--warning"
                  @click="openProductStockAjuste(product, 'SALIDA')"
                >
                  <ArrowDownRight :size="15" aria-hidden="true" /> Registrar salida
                </button>
                <button
                  v-if="canOperate"
                  type="button"
                  role="menuitem"
                  class="menu-item--info"
                  @click="openProductMovements(product)"
                >
                  <Boxes :size="15" aria-hidden="true" /> Historial de stock
                </button>
                <button
                  v-if="canEditProduct(product)"
                  type="button"
                  role="menuitem"
                  :class="product.activo === false ? 'menu-item--success' : 'menu-item--danger'"
                  @click="askToggleProductStatus(product)"
                >
                  <Power :size="15" aria-hidden="true" />
                  {{ product.activo === false ? 'Activar producto' : 'Desactivar producto' }}
                </button>
              </div>
            </div>
          </div>

          <div class="card-body">
            <div class="card-flags">
              <span class="category-label">
                <component :is="categoryIcon(product)" :size="13" aria-hidden="true" />
                {{ categoriaProducto(product) }}
              </span>
              <Badge :tone="product.activo === false ? 'neutral' : 'success'">{{
                product.activo === false ? 'Inactivo' : 'Activo'
              }}</Badge>
            </div>
            <h2 class="product-name" :title="product.nombre">
              <RouterLink :to="'/productos/' + product.id">{{ product.nombre }}</RouterLink>
            </h2>
            <small class="sku" :title="product.sku || undefined">
              <Tag :size="11" aria-hidden="true" /> {{ product.sku || 'Sin SKU' }}
            </small>
            <p v-if="resumenFichaProducto(product) || product.familia_info" class="family">
              {{
                [product.familia_info?.nombre, resumenFichaProducto(product)]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </p>
            <div class="card-metrics-footer">
              <div class="card-price">
                <strong>{{ dineroProducto(product.precio_vigente) }}</strong>
                <Badge v-if="product.promocion?.vigente" tone="info">Promoción</Badge>
              </div>
              <div class="card-stock">
                <template v-if="product.modalidad_abastecimiento === 'BAJO_PEDIDO'">
                  <span class="card-stock__label">Abastecimiento</span>
                  <Badge tone="info">Disponible bajo pedido</Badge>
                </template>
                <template v-else>
                  <span class="card-stock__label">Stock actual</span>
                  <strong class="card-stock__value">{{
                    unidadesProducto(product, product.stock)
                  }}</strong>
                  <Badge
                    v-if="
                      estadoStockMeta(product.estado_stock).showBadge &&
                      product.estado_stock !== 'NORMAL'
                    "
                    :tone="estadoStockMeta(product.estado_stock).tone"
                  >
                    {{ estadoStockMeta(product.estado_stock).label }}
                  </Badge>
                </template>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="table-wrap">
        <table class="product-table">
          <caption class="sr-only">
            Listado de productos de catálogo
          </caption>
          <thead>
            <tr>
              <th scope="col">Producto y estado</th>
              <th scope="col">Categoría y especificaciones</th>
              <th scope="col" class="numeric">Precio vigente</th>
              <th scope="col" class="numeric">Stock actual</th>
              <th scope="col" class="actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(product, rowIndex) in products"
              :key="product.id"
              :class="{ 'row--menu-open': openMenuId === product.id }"
            >
              <td class="identity" data-label="Producto y estado">
                <div class="identity-content">
                  <div v-if="showImages" class="thumbnail">
                    <ProductImage
                      :image="product.imagen_principal"
                      :alt="product.nombre"
                      :category-code="product.categoria_info?.codigo"
                      sizes="52px"
                    />
                  </div>
                  <span v-else class="category-badge-icon" aria-hidden="true">
                    <component :is="categoryIcon(product)" :size="17" />
                  </span>
                  <div class="identity-copy">
                    <RouterLink
                      :to="'/productos/' + product.id"
                      class="table-name"
                      :title="product.nombre"
                      >{{ product.nombre }}</RouterLink
                    >
                    <small class="sku-line" :title="product.sku || undefined">
                      <Tag :size="11" aria-hidden="true" /> {{ product.sku || 'Sin SKU' }}
                    </small>
                    <div class="identity-badges">
                      <Badge :tone="product.activo === false ? 'neutral' : 'success'">{{
                        product.activo === false ? 'Inactivo' : 'Activo'
                      }}</Badge>
                      <Badge v-if="product.promocion?.vigente" tone="info">Promoción</Badge>
                    </div>
                  </div>
                </div>
              </td>
              <td class="category-cell" data-label="Categoría y especificaciones">
                <span class="category-cell__title">
                  <component :is="categoryIcon(product)" :size="14" aria-hidden="true" />
                  {{ categoriaProducto(product) }}
                </span>
                <small v-if="product.familia_info" class="category-cell__family">
                  Familia: {{ product.familia_info.nombre }}
                </small>
                <small v-if="resumenFichaProducto(product)" class="category-cell__specs">
                  {{ resumenFichaProducto(product) }}
                </small>
              </td>
              <td class="numeric price-cell" data-label="Precio vigente">
                <strong>{{ dineroProducto(product.precio_vigente) }}</strong>
                <small v-if="product.promocion?.vigente && product.precio_lista" class="price-old">
                  Lista: {{ dineroProducto(product.precio_lista) }}
                </small>
              </td>
              <td class="numeric stock-cell" data-label="Stock actual">
                <template v-if="product.modalidad_abastecimiento === 'BAJO_PEDIDO'">
                  <div class="stock-badge-row">
                    <Badge tone="info">Disponible bajo pedido</Badge>
                  </div>
                </template>
                <template v-else>
                  <strong>{{ unidadesProducto(product, product.stock) }}</strong>
                  <div
                    v-if="
                      estadoStockMeta(product.estado_stock).showBadge &&
                      product.estado_stock !== 'NORMAL'
                    "
                    class="stock-badge-row"
                  >
                    <Badge :tone="estadoStockMeta(product.estado_stock).tone">
                      {{ estadoStockMeta(product.estado_stock).label }}
                    </Badge>
                  </div>
                </template>
              </td>
              <td class="actions" data-label="Acciones">
                <div class="action-menu table-action-menu">
                  <button
                    type="button"
                    class="menu-trigger"
                    :aria-label="'Acciones de ' + product.nombre"
                    :aria-expanded="openMenuId === product.id"
                    aria-haspopup="menu"
                    @click.stop="toggleMenu(product.id)"
                  >
                    <MoreVertical :size="18" aria-hidden="true" />
                  </button>
                  <div
                    v-if="openMenuId === product.id"
                    class="menu-dropdown"
                    :class="{
                      'menu-dropdown--up': rowIndex >= products.length - 2 && products.length > 2,
                    }"
                    role="menu"
                    :aria-label="'Acciones disponibles para ' + product.nombre"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      class="menu-item--info"
                      @click="openProductDetail(product)"
                    >
                      <Eye :size="15" aria-hidden="true" /> Ver ficha del producto
                    </button>
                    <button
                      v-if="canEditProduct(product)"
                      type="button"
                      role="menuitem"
                      class="menu-item--warning"
                      @click="openProductEdit(product)"
                    >
                      <Pencil :size="15" aria-hidden="true" /> Editar producto
                    </button>
                    <button
                      v-if="canAdmin"
                      type="button"
                      role="menuitem"
                      class="menu-item--success"
                      @click="openProductStockAjuste(product, 'ENTRADA')"
                    >
                      <ArrowUpRight :size="15" aria-hidden="true" /> Registrar entrada
                    </button>
                    <button
                      v-if="canAdmin"
                      type="button"
                      role="menuitem"
                      class="menu-item--warning"
                      @click="openProductStockAjuste(product, 'SALIDA')"
                    >
                      <ArrowDownRight :size="15" aria-hidden="true" /> Registrar salida
                    </button>
                    <button
                      v-if="canOperate"
                      type="button"
                      role="menuitem"
                      class="menu-item--info"
                      @click="openProductMovements(product)"
                    >
                      <Boxes :size="15" aria-hidden="true" /> Historial de stock
                    </button>
                    <button
                      v-if="canEditProduct(product)"
                      type="button"
                      role="menuitem"
                      :class="product.activo === false ? 'menu-item--success' : 'menu-item--danger'"
                      @click="askToggleProductStatus(product)"
                    >
                      <Power :size="15" aria-hidden="true" />
                      {{ product.activo === false ? 'Activar producto' : 'Desactivar producto' }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="pagination" aria-label="Paginación de productos">
        <span>Mostrando {{ pageStart }}–{{ pageEnd }} de {{ total }} productos</span>
        <div class="pagination-actions">
          <Button variant="secondary" :disabled="page <= 1" @click="page--">
            <ChevronLeft :size="16" aria-hidden="true" /> Anterior
          </Button>
          <span>Página {{ page }} de {{ pages }}</span>
          <Button variant="secondary" :disabled="page >= pages" @click="page++">
            Siguiente <ChevronRight :size="16" aria-hidden="true" />
          </Button>
        </div>
      </nav>
    </template>

    <ProductoStockAjusteModal
      :open="ajusteStockOpen"
      :initial-product="ajusteStockProduct"
      :initial-type="ajusteStockType"
      lock-product
      @close="ajusteStockOpen = false"
      @saved="onAjusteSaved"
    />

    <ConfirmDialog
      :open="Boolean(toggleTarget)"
      :title="toggleTarget?.activo === false ? 'Activar producto' : 'Desactivar producto'"
      :description="
        toggleTarget
          ? toggleTarget.activo === false
            ? `«${toggleTarget.nombre}» volverá a mostrarse como disponible para cotizar.`
            : `«${toggleTarget.nombre}» dejará de aparecer al crear nuevas proformas.`
          : ''
      "
      :confirm-label="toggleTarget?.activo === false ? 'Activar' : 'Desactivar'"
      @close="toggleTarget = null"
      @confirm="confirmToggleProductStatus"
    />
  </div>
</template>

<style scoped>
.productos-bandeja {
  min-width: 0;
}
.create-shortcuts {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
}
.create-shortcuts :deep(.button) {
  min-width: 6.5rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
}
.create-shortcuts :deep(.button svg) {
  color: var(--color-primary-accent);
}
@media (max-width: 38rem) {
  .create-shortcuts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }
  .create-shortcuts :deep(.button) {
    min-width: 0;
  }
}
.product-toolbar,
.results-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.product-toolbar {
  margin-bottom: var(--space-4);
}
.table-image-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  min-height: 2.5rem;
  padding: 0.4rem 0.7rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  cursor: pointer;
}
.table-image-toggle:hover {
  background: var(--color-surface-hover);
}
.view-switch {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.view-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.35rem;
  padding: 0.45rem 0.7rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--color-text-secondary);
  font-weight: 600;
  cursor: pointer;
}
.view-switch .selected {
  background: var(--color-surface-hover);
  color: var(--color-text);
  box-shadow: inset 0 0 0 1px var(--color-border);
}
.filters {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.filters-primary {
  display: grid;
  grid-template-columns:
    minmax(12rem, 1.5fr) repeat(4, minmax(8.5rem, 1fr))
    auto;
  gap: var(--space-3);
  align-items: end;
}
.filters-primary > * {
  min-width: 0;
}
.filters-primary :deep(.search) {
  min-height: 2.75rem;
}
.filters-primary__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.clear-filters-btn {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  flex: none;
}
.more-filters {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  min-height: 2.75rem;
  white-space: nowrap;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
}
.more-filters:hover {
  background: var(--color-surface-hover);
}
.advanced-filters {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.advanced-hint {
  margin: 0 0 var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.84rem;
}
.advanced-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.advanced-input--active span {
  color: var(--color-primary-accent);
  text-decoration: underline;
  text-underline-offset: 0.22rem;
  text-decoration-thickness: 2px;
}
.advanced-input--active input {
  border-bottom: 2.5px solid var(--color-primary-accent);
}
.advanced-input {
  display: grid;
  gap: var(--space-2);
  font-weight: 600;
}
.advanced-input input {
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.filter-message,
.options-warning {
  padding: 0.6rem 0;
  color: var(--color-warning);
  font-size: 0.85rem;
}
.filter-message button,
.options-warning button {
  margin-left: 0.5rem;
  color: var(--color-text);
  border: 0;
  background: transparent;
  cursor: pointer;
  text-decoration: underline;
}
.results-header {
  margin-bottom: var(--space-3);
  font-size: 0.85rem;
}
.results-order {
  color: var(--color-text-secondary);
}

/* Action dropdown menu */
.action-menu {
  position: relative;
  display: inline-flex;
}
.menu-trigger {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
  cursor: pointer;
}
.menu-trigger:hover {
  color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}
.menu-dropdown {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 60;
  display: grid;
  min-width: 13.5rem;
  padding: 0.35rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised, var(--color-surface));
  box-shadow: 0 10px 28px rgb(0 0 0 / 28%);
}
.menu-dropdown--up {
  top: auto;
  bottom: calc(100% + 0.35rem);
}
.menu-dropdown button {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.menu-dropdown button:hover {
  background: var(--color-surface-hover);
}
.menu-dropdown .menu-item--info {
  color: var(--color-info);
}
.menu-dropdown .menu-item--info:hover {
  background: var(--color-info-soft);
}
.menu-dropdown .menu-item--warning {
  color: var(--color-warning);
}
.menu-dropdown .menu-item--warning:hover {
  background: var(--color-warning-soft);
}
.menu-dropdown .menu-item--success {
  color: var(--color-success);
}
.menu-dropdown .menu-item--success:hover {
  background: var(--color-success-soft);
}
.menu-dropdown .menu-item--danger {
  color: var(--color-danger);
}
.menu-dropdown .menu-item--danger:hover {
  background: var(--color-danger-soft);
}

/* Grid view */
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}
.product-card {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  transition: border-color var(--transition-fast);
}
.product-card:hover {
  border-color: var(--color-border-strong);
}
.product-card--menu-open {
  z-index: 30;
}
.product-visual {
  position: relative;
  display: grid;
  aspect-ratio: 4 / 3;
  border-top-left-radius: calc(var(--radius-card) - 1px);
  border-top-right-radius: calc(var(--radius-card) - 1px);
  background: var(--color-background);
}
.product-visual :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  border-top-left-radius: calc(var(--radius-card) - 1px);
  border-top-right-radius: calc(var(--radius-card) - 1px);
  aspect-ratio: 4 / 3 !important;
}
.product-visual :deep(img) {
  object-fit: contain;
}
.card-corner-actions {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 5;
}
.card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  padding: var(--space-4);
}
.card-flags {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.4rem;
  align-items: center;
}
.category-label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
.product-name {
  margin: 0.25rem 0 0;
  min-width: 0;
  font-size: 1rem;
  line-height: 1.4;
}
.product-name a {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: var(--color-text);
  text-decoration: none;
}
.product-name a:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.sku {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.family {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.77rem;
  line-height: 1.4;
}
.card-metrics-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}
.card-price {
  display: grid;
  gap: 0.25rem;
  justify-items: start;
}
.card-price strong {
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}
.card-stock {
  display: grid;
  gap: 0.15rem;
  justify-items: end;
  text-align: right;
}
.card-stock__label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}
.card-stock__value {
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
}

/* List view */
.table-wrap {
  max-width: 100%;
  overflow: visible;
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  background: var(--color-table-row-odd);
}
.product-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.product-table thead {
  background: var(--color-table-header-bg);
}
.product-table th,
.product-table td {
  padding: 0.85rem 0.95rem;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
}
.product-table th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  font-size: 0.75rem;
  border-top: 0;
}
.product-table thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.product-table thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.product-table tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.product-table tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.product-table tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.product-table tbody tr.row--menu-open {
  position: relative;
  z-index: 25;
}
.product-table tr:last-child td {
  border-bottom: none;
}
.product-table tbody tr:last-child td:first-child {
  border-bottom-left-radius: calc(var(--radius-card) - 1px);
}
.product-table tbody tr:last-child td:last-child {
  border-bottom-right-radius: calc(var(--radius-card) - 1px);
}
.product-table th:nth-child(1) {
  width: 36%;
}
.product-table th:nth-child(2) {
  width: 26%;
}
.product-table th:nth-child(3) {
  width: 15%;
}
.product-table th:nth-child(4) {
  width: 15%;
}
.product-table th:nth-child(5) {
  width: 8%;
}
.product-table th.numeric,
.product-table td.numeric {
  text-align: right;
}
.product-table th.actions,
.product-table td.actions {
  text-align: center;
}
.identity-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.thumbnail {
  flex: none;
  width: 3.3rem;
  height: 3.3rem;
  overflow: hidden;
  border-radius: 0.45rem;
  background: var(--color-background);
}
.thumbnail :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.thumbnail :deep(.fallback-icon-box) {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.5rem;
}
.thumbnail :deep(.fallback-icon-box svg) {
  width: 1.05rem;
  height: 1.05rem;
}
.thumbnail :deep(.fallback-label) {
  display: none;
}
.category-badge-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  color: var(--color-primary-accent);
}
.identity-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.table-name {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--color-text);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.89rem;
}
.table-name:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.sku-line {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  overflow-wrap: anywhere;
}
.identity-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.1rem;
}
.category-cell,
.price-cell,
.stock-cell {
  font-size: 0.83rem;
}
.category-cell__title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}
.category-cell__title svg {
  color: var(--color-primary-accent);
  flex: none;
}
.category-cell small,
.price-cell small {
  display: block;
  margin-top: 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
}
.price-old {
  text-decoration: line-through;
}
.price-cell strong,
.stock-cell strong {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.stock-badge-row {
  margin-top: 0.3rem;
  display: flex;
  justify-content: flex-end;
}
.pagination,
.pagination-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.pagination {
  margin-top: var(--space-4);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.pagination-actions {
  margin-left: auto;
}
@media (max-width: 78rem) {
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 74rem) {
  .filters-primary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .search-wrap {
    grid-column: 1 / -1;
  }
}
@media (max-width: 62rem) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .advanced-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 47.99rem) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .product-table thead {
    display: none;
  }
  .product-table,
  .product-table tbody,
  .product-table tr {
    display: block;
  }
  .product-table tbody tr {
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-table-border);
  }
  .product-table tbody tr:nth-child(odd) {
    background-color: var(--color-table-row-odd);
  }
  .product-table tbody tr:nth-child(even) {
    background-color: var(--color-table-row-even);
  }
  .product-table tbody tr:last-child {
    border-bottom: 0;
  }
  .product-table td {
    display: grid;
    grid-template-columns: minmax(6rem, 34%) minmax(0, 1fr);
    gap: var(--space-3);
    padding: 0.4rem;
    border: 0;
    text-align: left !important;
  }
  .product-table td::before {
    content: attr(data-label);
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 0.8rem;
  }
  .product-table td.actions {
    text-align: left;
  }
  .stock-badge-row {
    justify-content: flex-start;
  }
  .product-table .identity-content {
    min-width: 0;
  }
  .product-table .numeric strong {
    white-space: normal;
  }
}
@media (max-width: 35rem) {
  .filters-primary,
  .advanced-grid {
    grid-template-columns: 1fr;
  }
  .product-grid {
    grid-template-columns: 1fr;
  }
  .product-toolbar {
    align-items: stretch;
  }
  .view-switch {
    width: 100%;
  }
  .view-switch button {
    flex: 1;
  }
  .product-table td {
    grid-template-columns: minmax(5.5rem, 35%) minmax(0, 1fr);
  }
  .pagination-actions {
    width: 100%;
  }
}
</style>
