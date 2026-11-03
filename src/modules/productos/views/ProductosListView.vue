<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ChevronDown, Eye, LayoutGrid, List, Plus, SlidersHorizontal } from '@lucide/vue'
import type { FamiliaProducto, Producto, ValorCatalogoPublico } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { productosService } from '../services/productosService'
import {
  cantidadProducto,
  catalogoId,
  categoriaProducto,
  dineroProducto,
  pageNumberProducto,
  unidadesProducto,
} from '../utils/presentacionCatalogo'
import ProductImage from '../components/ProductImage.vue'
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
const session = useSessionStore()
const canCreate = computed(() => session.can('catalogo.crear_producto'))
const products = ref<Producto[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const categoryError = ref('')
const categoryLoading = ref(true)
const categories = ref<ValorCatalogoPublico[]>([])
const families = ref<FamiliaProducto[]>([])
const options = reactive<Record<string, ValorCatalogoPublico[]>>({})
const advancedLoading = ref(false)
const advancedLoaded = ref(false)
const advancedError = ref('')
const showAdvanced = ref(false)
const showCreate = ref(false)
const createRoot = ref<HTMLElement | null>(null)
const createFirst = ref<HTMLButtonElement | null>(null)

const routeString = (key: string): string =>
  typeof route.query[key] === 'string' ? String(route.query[key]) : ''
const routeStatus = (): string =>
  ['todos', 'activos', 'inactivos'].includes(routeString('estado'))
    ? routeString('estado')
    : 'activos'
type Vista = 'grid' | 'lista'
const search = ref(routeString('q'))
const status = ref(routeStatus())
const category = ref(catalogoId(routeString('categoria')))
const view = ref<Vista>(routeString('vista') === 'grid' ? 'grid' : 'lista')
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
    Boolean(category.value) ||
    extraKeys.some((key) => Boolean(extras[key])),
)
const hasSpecificFilters = computed(() =>
  Boolean(search.value.trim() || category.value || extraKeys.some((key) => Boolean(extras[key]))),
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
const filterLabel = (key: ExtraKey, value: string) => {
  if (key === 'familia')
    return families.value.find((x) => String(x.id) === value)?.nombre || '#' + value
  if (key === 'modelo' || key === 'espesor_mm') return value
  const code: Record<string, string> = {
    marca: 'MARCA',
    color_primario: 'COLOR',
    tipo: 'TIPO_PISO',
    material: 'MATERIAL_PISO',
    diseno: 'DISENO_PISO',
    acabado: 'ACABADO_PISO',
    unidad_stock: 'UNIDAD_MEDIDA',
  }
  return options[code[key] || '']?.find((x) => String(x.id) === value)?.nombre || '#' + value
}
const extraNames: Record<ExtraKey, string> = {
  familia: 'Familia',
  marca: 'Marca',
  modelo: 'Modelo',
  color_primario: 'Color',
  tipo: 'Tipo de piso',
  material: 'Material',
  diseno: 'Diseño',
  acabado: 'Acabado',
  espesor_mm: 'Espesor (mm)',
  unidad_stock: 'Unidad',
}
const activeFilters = computed(() => [
  ...(search.value.trim() ? [{ key: 'q', label: 'Búsqueda: ' + search.value.trim() }] : []),
  ...(category.value
    ? [
        {
          key: 'categoria',
          label:
            'Categoría: ' +
            (categories.value.find((x) => String(x.id) === category.value)?.nombre ||
              '#' + category.value),
        },
      ]
    : []),
  ...(status.value !== 'activos'
    ? [
        {
          key: 'estado',
          label: 'Estado: ' + (status.value === 'todos' ? 'Todos' : 'Inactivos'),
        },
      ]
    : []),
  ...availableExtra.value
    .filter((key) => Boolean(extras[key]))
    .map((key) => ({
      key,
      label: extraNames[key] + ': ' + filterLabel(key, extras[key]),
    })),
])
let requestId = 0
let debounce: ReturnType<typeof setTimeout> | undefined
let restoring = false
let mounted = false

const numberId = (value: string): number | undefined =>
  catalogoId(value) ? Number(value) : undefined
const optionList = (code: string, placeholder: string) => [
  { value: '', label: placeholder },
  ...(options[code] || []).map((value) => ({ value: String(value.id), label: value.nombre })),
]
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
    categoria: category.value || undefined,
    vista: view.value === 'lista' ? undefined : 'grid',
    pagina: page.value > 1 ? String(page.value) : undefined,
  }
  for (const key of availableExtra.value) query[key] = extras[key] || undefined
  return query
}
function routeMatches(query: Record<string, string | undefined>) {
  const keys = ['q', 'estado', 'categoria', 'vista', 'pagina', ...extraKeys]
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
function removeFilter(key: string) {
  if (key === 'q') search.value = ''
  else if (key === 'estado') status.value = 'activos'
  else if (key === 'categoria') changeCategory('')
  else if (extraKeys.includes(key as ExtraKey)) extras[key as ExtraKey] = ''
}
function clearFilters() {
  search.value = ''
  status.value = 'activos'
  changeCategory('')
}
async function loadCategories() {
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
    }
    if (category.value) scheduleLoad()
  } catch {
    categoryError.value =
      'No se pudieron cargar las categorías. Reintenta para filtrar o crear productos.'
  } finally {
    categoryLoading.value = false
  }
}
async function loadAdvanced() {
  if (advancedLoaded.value || advancedLoading.value) return
  advancedLoading.value = true
  advancedError.value = ''
  try {
    const keys = [
      'MARCA',
      'COLOR',
      'TIPO_PISO',
      'MATERIAL_PISO',
      'DISENO_PISO',
      'ACABADO_PISO',
      'UNIDAD_MEDIDA',
    ] as const
    const [response, ...values] = await Promise.all([
      proformasService.families(),
      ...keys.map((code) => proformasService.options(code)),
    ])
    families.value = response.results
    keys.forEach((key, index) => {
      options[key] = values[index] as ValorCatalogoPublico[]
    })
    advancedLoaded.value = true
    if (response.count > response.results.length)
      advancedError.value =
        'Hay más familias disponibles. La búsqueda avanzada muestra las primeras 100.'
  } catch {
    advancedError.value = 'No se pudieron cargar los filtros avanzados. Puedes reintentarlo.'
  } finally {
    advancedLoading.value = false
  }
}
function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value
  if (showAdvanced.value) void loadAdvanced()
}
function closeCreate() {
  showCreate.value = false
}
async function toggleCreate() {
  showCreate.value = !showCreate.value
  if (showCreate.value) {
    if (categoryError.value) void loadCategories()
    await nextTick()
    createFirst.value?.focus({ preventScroll: true })
  }
}
function createProduct(code: string) {
  closeCreate()
  void router.push({ path: '/productos/nuevo', query: { categoria: code } })
}
function onDocumentPointer(event: PointerEvent) {
  if (showCreate.value && !createRoot.value?.contains(event.target as Node)) closeCreate()
}
function onDocumentKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && showCreate.value) {
    closeCreate()
    createRoot.value?.querySelector<HTMLButtonElement>('.create-trigger')?.focus()
  }
}
function restoreFilters() {
  restoring = true
  search.value = routeString('q')
  status.value = routeStatus()
  category.value = catalogoId(routeString('categoria'))
  view.value = routeString('vista') === 'grid' ? 'grid' : 'lista'
  page.value = pageNumberProducto(routeString('pagina'))
  for (const key of extraKeys)
    extras[key] =
      key === 'modelo' || key === 'espesor_mm' ? routeString(key) : catalogoId(routeString(key))
  showAdvanced.value = extraKeys.some((key) => Boolean(extras[key]))
  if (showAdvanced.value) void loadAdvanced()
  void nextTick(() => {
    restoring = false
    if (mounted) scheduleLoad()
  })
}
watch([search, status, category], (next, previous) =>
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
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onDocumentKey)
  void load()
  void loadCategories()
  if (showAdvanced.value) void loadAdvanced()
})
onBeforeUnmount(() => {
  mounted = false
  ++requestId
  if (debounce) clearTimeout(debounce)
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onDocumentKey)
})
</script>

<template>
  <div class="productos-bandeja">
    <PageHeader
      title="Productos"
      description="Consulta y administra el catálogo comercial."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <div v-if="canCreate" ref="createRoot" class="create-root">
          <Button
            class="create-trigger"
            :aria-expanded="showCreate"
            aria-controls="productos-create-options"
            @click="toggleCreate"
            ><Plus :size="18" aria-hidden="true" />Nuevo producto</Button
          >
          <div
            v-if="showCreate"
            id="productos-create-options"
            class="create-options"
            role="group"
            aria-label="Elegir categoría del nuevo producto"
          >
            <p>¿Qué producto deseas registrar?</p>
            <template v-if="categories.length">
              <button
                v-for="(item, index) in categories"
                :key="item.id"
                :ref="
                  (element) => {
                    if (index === 0) createFirst = element as HTMLButtonElement | null
                  }
                "
                type="button"
                @click="createProduct(item.codigo)"
              >
                {{ item.nombre }}
              </button>
            </template>
            <p v-else class="muted">
              {{
                categoryLoading
                  ? 'Cargando categorías…'
                  : categoryError || 'No hay categorías disponibles.'
              }}
            </p>
            <button v-if="categoryError" type="button" @click="loadCategories">Reintentar</button>
          </div>
        </div>
      </template>
    </PageHeader>

    <div class="product-toolbar">
      <strong>Catálogo de productos</strong>
      <div class="view-switch" role="group" aria-label="Vista del catálogo">
        <button
          type="button"
          :aria-pressed="view === 'grid'"
          :class="{ selected: view === 'grid' }"
          @click="view = 'grid'"
        >
          <LayoutGrid :size="17" aria-hidden="true" />Cuadrícula
        </button>
        <button
          type="button"
          :aria-pressed="view === 'lista'"
          :class="{ selected: view === 'lista' }"
          @click="view = 'lista'"
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
          :options="categoryOptions"
          :disabled="categoryLoading || Boolean(categoryError)"
          @update:model-value="changeCategory"
        />
        <Select
          v-model="status"
          name="estado-producto"
          label="Estado"
          :options="[
            { label: 'Activos', value: 'activos' },
            { label: 'Todos', value: 'todos' },
            { label: 'Inactivos', value: 'inactivos' },
          ]"
        />
        <button
          type="button"
          class="more-filters"
          :aria-expanded="showAdvanced"
          :aria-controls="showAdvanced ? 'productos-filtros-avanzados' : undefined"
          @click="toggleAdvanced"
        >
          <SlidersHorizontal :size="18" aria-hidden="true" />Más filtros<ChevronDown
            :size="16"
            aria-hidden="true"
          />
        </button>
      </div>
      <div v-if="showAdvanced" id="productos-filtros-avanzados" class="advanced-filters">
        <p class="advanced-hint">
          Selecciona los atributos que quieras utilizar para encontrar el producto.
        </p>
        <p v-if="advancedLoading" role="status">Cargando filtros…</p>
        <p v-if="advancedError" role="status" class="filter-message">
          {{ advancedError }}
          <button v-if="!advancedLoaded" type="button" @click="loadAdvanced">Reintentar</button>
        </p>
        <div class="advanced-grid">
          <Select
            v-model="extras.familia"
            name="familia-producto-filtro"
            label="Familia"
            :options="familyOptions"
            :disabled="!advancedLoaded"
          />
          <template v-if="categoryCode === 'SILLA' || categoryCode === 'PISO_FLOTANTE'">
            <Select
              v-model="extras.marca"
              name="marca-producto-filtro"
              label="Marca"
              :options="optionList('MARCA', 'Todas las marcas')"
              :disabled="!advancedLoaded"
            />
          </template>
          <template v-if="categoryCode === 'SILLA'">
            <label class="advanced-input"
              >Modelo
              <input v-model.trim="extras.modelo" maxlength="150" placeholder="Buscar modelo…" />
            </label>
            <Select
              v-model="extras.color_primario"
              name="color-producto-filtro"
              label="Color"
              :options="optionList('COLOR', 'Todos los colores')"
              :disabled="!advancedLoaded"
            />
          </template>
          <template v-if="categoryCode === 'PISO_FLOTANTE'">
            <Select
              v-model="extras.tipo"
              name="tipo-producto-filtro"
              label="Tipo de piso"
              :options="optionList('TIPO_PISO', 'Todos los tipos')"
              :disabled="!advancedLoaded"
            />
            <Select
              v-model="extras.material"
              name="material-producto-filtro"
              label="Material"
              :options="optionList('MATERIAL_PISO', 'Todos los materiales')"
              :disabled="!advancedLoaded"
            />
            <Select
              v-model="extras.diseno"
              name="diseno-producto-filtro"
              label="Diseño"
              :options="optionList('DISENO_PISO', 'Todos los diseños')"
              :disabled="!advancedLoaded"
            />
            <Select
              v-model="extras.acabado"
              name="acabado-producto-filtro"
              label="Acabado"
              :options="optionList('ACABADO_PISO', 'Todos los acabados')"
              :disabled="!advancedLoaded"
            />
            <label class="advanced-input"
              >Espesor (mm)
              <input
                v-model="extras.espesor_mm"
                type="number"
                min="0.01"
                max="999999"
                step="0.01"
                placeholder="Ej. 8"
              />
            </label>
          </template>
          <Select
            v-if="categoryCode === 'OTRO'"
            v-model="extras.unidad_stock"
            name="unidad-producto-filtro"
            label="Unidad comercial"
            :options="optionList('UNIDAD_MEDIDA', 'Todas las unidades')"
            :disabled="!advancedLoaded"
          />
        </div>
      </div>
    </section>

    <p v-if="categoryError" class="options-warning" role="status">
      {{ categoryError }} <button type="button" @click="loadCategories">Reintentar</button>
    </p>
    <p v-if="notice" role="status" class="options-warning">{{ notice }}</p>
    <ActiveFilters :filters="activeFilters" @remove="removeFilter" @clear="clearFilters" />

    <div class="results-header">
      <strong v-if="!loading && !error"
        >{{ total }} producto{{ total === 1 ? '' : 's' }} encontrado{{
          total === 1 ? '' : 's'
        }}</strong
      >
      <span v-else>Catálogo de productos</span>
      <span class="results-order">Ordenados por nombre</span>
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
      <Button v-else-if="canCreate" variant="secondary" @click="toggleCreate"
        >Nuevo producto</Button
      >
    </EmptyState>
    <template v-else>
      <div v-if="view === 'grid'" class="product-grid">
        <article v-for="product in products" :key="product.id" class="product-card">
          <div class="product-visual">
            <ProductImage :image="product.imagen_principal" :alt="product.nombre" />
          </div>
          <div class="card-body">
            <div class="card-flags">
              <span class="category-label">{{ categoriaProducto(product) }}</span>
              <Badge :tone="product.activo === false ? 'neutral' : 'success'">{{
                product.activo === false ? 'Inactivo' : 'Activo'
              }}</Badge>
            </div>
            <h2 class="product-name" :title="product.nombre">
              <RouterLink :to="'/productos/' + product.id">{{ product.nombre }}</RouterLink>
            </h2>
            <small class="sku" :title="product.sku || undefined">{{
              product.sku || 'Sin SKU'
            }}</small>
            <p v-if="product.familia_info" class="family">{{ product.familia_info.nombre }}</p>
            <div class="price-row">
              <strong>{{ dineroProducto(product.precio_vigente) }}</strong>
              <Badge v-if="product.promocion?.vigente" tone="info">Promoción</Badge>
            </div>
            <div class="stock-summary">
              <div>
                <span>Existencias</span
                ><strong>{{ unidadesProducto(product, product.stock) }}</strong>
              </div>
              <div>
                <span>Cantidad pendiente</span
                ><span>{{ unidadesProducto(product, product.demanda_pendiente) }}</span>
              </div>
            </div>
            <RouterLink
              class="card-detail"
              :to="'/productos/' + product.id"
              :aria-label="'Ver producto ' + product.nombre"
            >
              Ver detalle <Eye :size="15" aria-hidden="true" />
            </RouterLink>
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
              <th scope="col">Producto</th>
              <th scope="col">Categoría</th>
              <th scope="col" class="numeric">Precio vigente</th>
              <th scope="col" class="numeric">Existencias</th>
              <th scope="col">Estado</th>
              <th scope="col" class="actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product.id">
              <td class="identity" data-label="Producto">
                <div class="identity-content">
                  <div class="thumbnail">
                    <ProductImage :image="product.imagen_principal" :alt="product.nombre" />
                  </div>
                  <div class="identity-copy">
                    <RouterLink
                      :to="'/productos/' + product.id"
                      class="table-name"
                      :title="product.nombre"
                      >{{ product.nombre }}</RouterLink
                    >
                    <small :title="product.sku || undefined">{{ product.sku || 'Sin SKU' }}</small>
                  </div>
                </div>
              </td>
              <td class="category-cell" data-label="Categoría">
                <span>{{ categoriaProducto(product) }}</span>
                <small v-if="product.familia_info">{{ product.familia_info.nombre }}</small>
              </td>
              <td class="numeric price-cell" data-label="Precio vigente">
                <strong>{{ dineroProducto(product.precio_vigente) }}</strong>
                <small v-if="product.promocion?.vigente">Promoción</small>
              </td>
              <td class="numeric stock-cell" data-label="Existencias">
                <strong>{{ unidadesProducto(product, product.stock) }}</strong>
                <small
                  :title="
                    'Cantidad pendiente: ' + unidadesProducto(product, product.demanda_pendiente)
                  "
                >
                  Pendiente: {{ cantidadProducto(product.demanda_pendiente) }}
                </small>
                <small
                  :title="
                    'Saldo referencial: ' +
                    unidadesProducto(product, product.disponibilidad_referencial)
                  "
                >
                  Saldo ref.: {{ cantidadProducto(product.disponibilidad_referencial) }}
                </small>
              </td>
              <td data-label="Estado">
                <Badge :tone="product.activo === false ? 'neutral' : 'success'">{{
                  product.activo === false ? 'Inactivo' : 'Activo'
                }}</Badge>
              </td>
              <td class="actions" data-label="Acciones">
                <RouterLink
                  class="view-detail"
                  :to="'/productos/' + product.id"
                  :aria-label="'Ver producto ' + product.nombre"
                  title="Ver detalle"
                >
                  <Eye :size="18" aria-hidden="true" />
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav class="pagination" aria-label="Paginación de productos">
        <span>Mostrando {{ pageStart }}–{{ pageEnd }} de {{ total }} productos</span>
        <div class="pagination-actions">
          <Button variant="secondary" :disabled="page <= 1" @click="page--">Anterior</Button>
          <span>Página {{ page }} de {{ pages }}</span>
          <Button variant="secondary" :disabled="page >= pages" @click="page++">Siguiente</Button>
        </div>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.productos-bandeja {
  min-width: 0;
}
.create-root {
  position: relative;
}
.create-options {
  position: absolute;
  z-index: 15;
  right: 0;
  top: calc(100% + 0.5rem);
  display: grid;
  gap: 0.3rem;
  width: min(20rem, calc(100vw - 2rem));
  padding: 0.6rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 12px 32px #0004;
}
.create-options p {
  margin: 0.3rem 0.5rem 0.5rem;
  font-size: 0.84rem;
}
.create-options button {
  min-height: 2.75rem;
  padding: 0.6rem 0.75rem;
  text-align: left;
  background: transparent;
  color: var(--color-text);
  border: 0;
  border-radius: var(--radius-control);
  cursor: pointer;
}
.create-options button:hover,
.create-options button:focus-visible {
  background: var(--color-surface-hover);
}
.create-options .muted {
  color: var(--color-text-secondary);
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
  grid-template-columns: minmax(12rem, 1fr) minmax(10rem, 13rem) minmax(8rem, 11rem) auto;
  gap: var(--space-3);
  align-items: end;
}
.filters-primary > * {
  min-width: 0;
}
.filters-primary :deep(.search) {
  min-height: 2.75rem;
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
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}
.product-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  transition: border-color var(--transition-fast);
}
.product-card:hover {
  border-color: var(--color-border-strong);
}
.product-visual {
  display: grid;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--color-background);
}
.product-visual :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  aspect-ratio: 4 / 3 !important;
}
.product-visual :deep(img) {
  object-fit: contain;
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
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
.product-name {
  margin: 0.3rem 0 0;
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
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.family {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.77rem;
}
.price-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.65rem;
}
.price-row strong {
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}
.stock-summary {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.8rem;
}
.stock-summary div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
}
.stock-summary div > span:first-child {
  color: var(--color-text-secondary);
}
.stock-summary strong,
.stock-summary div > span:last-child {
  font-variant-numeric: tabular-nums;
}
.card-detail {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: start;
  padding: 0.3rem 0;
  color: var(--color-primary-accent);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
}
.card-detail:hover {
  text-decoration: underline;
}
.table-wrap {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.product-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.product-table th,
.product-table td {
  padding: 0.8rem 0.9rem;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--color-border);
}
.product-table th {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.product-table tr:last-child td {
  border-bottom: none;
}
.product-table tbody tr:hover {
  background: var(--color-surface-hover);
}
.product-table th:nth-child(1) {
  width: 34%;
}
.product-table th:nth-child(2) {
  width: 18%;
}
.product-table th:nth-child(3) {
  width: 15%;
}
.product-table th:nth-child(4) {
  width: 17%;
}
.product-table th:nth-child(5) {
  width: 10%;
}
.product-table th:nth-child(6) {
  width: 6%;
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
  width: 3.2rem;
  height: 3.2rem;
  overflow: hidden;
  border-radius: 0.4rem;
  background: var(--color-background);
}
.thumbnail :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.thumbnail :deep(.fallback) {
  gap: 0;
  font-size: 0;
}
.thumbnail :deep(.fallback svg) {
  width: 1.1rem;
  height: 1.1rem;
}
.identity-copy {
  display: grid;
  gap: 0.3rem;
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
  font-size: 0.88rem;
}
.table-name:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.identity-copy small {
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.category-cell,
.price-cell,
.stock-cell {
  font-size: 0.83rem;
}
.category-cell small,
.price-cell small,
.stock-cell small {
  display: block;
  margin-top: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
}
.price-cell strong,
.stock-cell strong {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.stock-cell small {
  font-variant-numeric: tabular-nums;
}
.view-detail {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
}
.view-detail:hover {
  color: var(--color-primary-accent);
  background: var(--color-surface-hover);
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
@media (max-width: 62rem) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .filters-primary {
    grid-template-columns: minmax(12rem, 1fr) minmax(9rem, 12rem);
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
    border-bottom: 1px solid var(--color-border);
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
  .product-table .identity-content {
    min-width: 0;
  }
  .product-table .view-detail {
    justify-self: start;
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
