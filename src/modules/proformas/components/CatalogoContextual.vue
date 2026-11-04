<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Modal from '@/shared/ui/Modal.vue'
import type { CatalogoContextState } from '../services/catalogoContext'
import type { FamiliaProducto, Producto, ValorCatalogoPublico } from '@/generated/api'
import { productosService } from '@/modules/productos/services/productosService'
import { proformasService } from '../services/proformasService'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import Button from '@/shared/ui/Button.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import Pagination from '@/shared/ui/Pagination.vue'
import Toast from '@/shared/ui/Toast.vue'
import {
  readCatalogImagesVisible,
  writeCatalogImagesVisible,
} from '@/shared/media/catalogImageVisibility'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  LayoutGrid,
  Layers,
  List,
  Package,
  PackageOpen,
  Plus,
  SearchX,
  SlidersHorizontal,
  Sofa,
} from '@lucide/vue'

const props = defineProps<{
  categorias: ValorCatalogoPublico[]
  familias: FamiliaProducto[]
  existingProductIds: number[]
  canCreate?: boolean
  canEditProduct?: (producto: Producto) => boolean
  initialState?: CatalogoContextState
}>()
const emit = defineEmits<{
  select: [producto: Producto]
  duplicate: [productoId: number]
  create: [categoryCode: string]
  edit: [productId: number]
  stateChange: [state: CatalogoContextState]
  pending: [familiaId: number, categoriaId: number]
  cancel: []
}>()
type Field =
  | 'marca'
  | 'modelo'
  | 'color_primario'
  | 'tipo'
  | 'material'
  | 'diseno'
  | 'acabado'
  | 'espesor_mm'
  | 'unidad_stock'
const fieldOptions: Record<string, { field: Field; label: string; concepto?: string }[]> = {
  SILLA: [
    { field: 'marca', label: 'Marca', concepto: 'MARCA' },
    { field: 'modelo', label: 'Modelo' },
    { field: 'color_primario', label: 'Color principal', concepto: 'COLOR' },
  ],
  PISO_FLOTANTE: [
    { field: 'marca', label: 'Marca', concepto: 'MARCA' },
    { field: 'tipo', label: 'Tipo', concepto: 'TIPO_PISO' },
    { field: 'material', label: 'Material', concepto: 'MATERIAL_PISO' },
    { field: 'diseno', label: 'Diseño', concepto: 'DISENO_PISO' },
    { field: 'acabado', label: 'Acabado', concepto: 'ACABADO_PISO' },
    { field: 'espesor_mm', label: 'Espesor (mm)' },
  ],
  OTRO: [{ field: 'unidad_stock', label: 'Unidad', concepto: 'UNIDAD_MEDIDA' }],
}
const category = ref(props.initialState?.category ?? '')
const search = ref(props.initialState?.search ?? '')
const family = ref(props.initialState?.family ?? '')
const filters = reactive<Record<Field, string>>({
  marca: '',
  modelo: '',
  color_primario: '',
  tipo: '',
  material: '',
  diseno: '',
  acabado: '',
  espesor_mm: '',
  unidad_stock: '',
  ...props.initialState?.filters,
})
const options = ref<Record<string, ValorCatalogoPublico[]>>({})
const view = ref<'grid' | 'lista'>(props.initialState?.view ?? 'grid')
const filtersExpanded = ref(Object.values(props.initialState?.filters ?? {}).some(Boolean))
const showImages = ref(readCatalogImagesVisible())
const notification = ref('')
watch(showImages, writeCatalogImagesVisible)
function categoryIcon(code: string) {
  if (code === 'SILLA') return Sofa
  if (code === 'PISO_FLOTANTE') return Layers
  return Package
}
function selectProduct(product: Producto) {
  if (props.existingProductIds.includes(product.id)) emit('duplicate', product.id)
  else emit('select', product)
}
const page = ref(props.initialState?.page ?? 1)
const products = ref<Producto[]>([])
const preview = ref<Producto | null>(null)
function selectPreviewProduct() {
  const selected = preview.value
  if (!selected) return
  selectProduct(selected)
  preview.value = null
}
const total = ref(0)
const loading = ref(false)
const error = ref('')
const errorToast = ref('')
watch(error, (message) => {
  if (message) {
    notification.value = ''
    errorToast.value = message
  }
})
const pageSize = 12
let requestId = 0
let optionsId = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const categoryCode = computed(
  () => props.categorias.find((value) => String(value.id) === category.value)?.codigo ?? '',
)
const activeFields = computed(() => fieldOptions[categoryCode.value] ?? [])
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const activeChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (search.value.trim()) chips.push({ key: 'search', label: `Búsqueda: ${search.value.trim()}` })
  if (category.value) {
    const nombre = props.categorias.find((item) => String(item.id) === category.value)?.nombre
    chips.push({ key: 'category', label: `Categoría: ${nombre ?? category.value}` })
  }
  if (family.value) {
    const nombre = props.familias.find((item) => String(item.id) === family.value)?.nombre
    chips.push({ key: 'family', label: `Familia: ${nombre ?? family.value}` })
  }
  for (const item of activeFields.value) {
    const raw = filters[item.field]
    if (!raw) continue
    const nombre = item.concepto
      ? (options.value[item.concepto]?.find((option) => String(option.id) === raw)?.nombre ?? raw)
      : raw
    chips.push({ key: item.field, label: `${item.label}: ${nombre}` })
  }
  return chips
})
function clearFilter(key: string) {
  if (key === 'search') search.value = ''
  else if (key === 'category') category.value = ''
  else if (key === 'family') family.value = ''
  else if (key in filters) filters[key as Field] = ''
}
function clearAllFilters() {
  notification.value = 'Filtros eliminados. Se muestra el catálogo disponible.'
  search.value = ''
  category.value = ''
  family.value = ''
  resetSpecificFilters()
}
function setFiltersOpen(event: Event) {
  filtersExpanded.value = (event.currentTarget as HTMLDetailsElement).open
}
const money = (value: string) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value))
function resetSpecificFilters() {
  for (const field of Object.keys(filters) as Field[]) filters[field] = ''
}
async function loadOptions() {
  const token = ++optionsId
  const codes = [...new Set(activeFields.value.map((item) => item.concepto).filter(Boolean))]
  const result = await Promise.allSettled(
    codes.map((code) =>
      proformasService.options(code as Parameters<typeof proformasService.options>[0]),
    ),
  )
  if (token !== optionsId) return
  for (let index = 0; index < codes.length; index++) {
    const item = result[index]
    if (item?.status === 'fulfilled') options.value[codes[index]!] = item.value
  }
}
async function load() {
  const token = ++requestId
  loading.value = true
  error.value = ''
  try {
    const extra = Object.fromEntries(
      activeFields.value
        .filter(({ field }) => filters[field])
        .map(({ field }) => [field, filters[field]]),
    )
    const response = await productosService.list({
      activo: true,
      search: search.value.trim() || undefined,
      categoria: category.value ? Number(category.value) : undefined,
      familia: family.value ? Number(family.value) : undefined,
      page: page.value,
      page_size: pageSize,
      ...extra,
    })
    if (token !== requestId) return
    products.value = response.results
    total.value = response.count
  } catch (cause) {
    if (token !== requestId) return
    products.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : 'No se pudo consultar el catálogo.'
  } finally {
    if (token === requestId) loading.value = false
  }
}
watch(category, () => {
  resetSpecificFilters()
  family.value = ''
  page.value = 1
  void loadOptions()
  void load()
})
watch(family, () => {
  page.value = 1
  void load()
})
watch(filters, () => {
  page.value = 1
  void load()
})
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    void load()
  }, 250)
})
watch(page, () => void load())
watch(
  [category, search, family, filters, view, page],
  () =>
    emit('stateChange', {
      category: category.value,
      search: search.value,
      family: family.value,
      filters: { ...filters },
      view: view.value,
      page: page.value,
    }),
  { deep: true },
)
onMounted(() => {
  if (category.value) void loadOptions()
  void load()
})
onBeforeUnmount(() => {
  requestId++
  optionsId++
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="catalogo-contextual">
    <Toast
      :visible="Boolean(notification)"
      :message="notification"
      tone="info"
      @close="notification = ''"
    />
    <Toast
      :visible="Boolean(errorToast)"
      :message="errorToast"
      tone="danger"
      @close="errorToast = ''"
    />
    <div class="head">
      <div>
        <h3><PackageOpen :size="20" aria-hidden="true" /> Seleccionar producto del catálogo</h3>
        <p>
          Busca un SKU existente y configura su cantidad y precio para cotizar. Consultar el
          catálogo no reserva stock.
        </p>
      </div>
      <Button variant="secondary" @click="emit('cancel')"
        ><ArrowLeft :size="16" aria-hidden="true" /> Cerrar catálogo</Button
      >
    </div>
    <nav class="categorias" aria-label="Categorías de catálogo">
      <button type="button" :aria-pressed="!category" @click="category = ''">
        <LayoutGrid :size="17" aria-hidden="true" /> Todos
      </button>
      <button
        v-for="item in categorias"
        :key="item.id"
        type="button"
        :aria-pressed="category === String(item.id)"
        @click="category = String(item.id)"
      >
        <component :is="categoryIcon(item.codigo)" :size="17" aria-hidden="true" />
        {{ item.nombre }}
      </button>
    </nav>
    <div class="filters-primary">
      <SearchField v-model="search" label="Buscar SKU o nombre" />
      <Select
        v-model="family"
        name="familia-catalogo"
        label="Familia"
        :options="[
          { label: 'Todas las familias', value: '' },
          ...familias
            .filter((x) => x.activo)
            .map((x) => ({ label: x.nombre, value: String(x.id) })),
        ]"
      />
    </div>
    <details
      v-if="activeFields.length"
      class="filtros-panel"
      :open="filtersExpanded"
      @toggle="setFiltersOpen"
    >
      <summary>
        <SlidersHorizontal :size="17" aria-hidden="true" /> Más filtros
        <ChevronDown :size="16" aria-hidden="true" />
      </summary>
      <div class="filtros">
        <template v-for="item in activeFields" :key="item.field">
          <Select
            v-if="item.concepto"
            v-model="filters[item.field]"
            :name="'filtro-' + item.field"
            :label="item.label"
            :options="[
              { label: 'Todos', value: '' },
              ...(options[item.concepto] ?? []).map((x) => ({
                label: x.nombre,
                value: String(x.id),
              })),
            ]"
          />
          <label v-else class="filtro-texto">
            <span>{{ item.label }}</span>
            <input
              v-model="filters[item.field]"
              :type="item.field === 'espesor_mm' ? 'number' : 'text'"
              :min="item.field === 'espesor_mm' ? '0.01' : undefined"
              :step="item.field === 'espesor_mm' ? '0.01' : undefined"
            />
          </label>
        </template>
      </div>
    </details>
    <div v-if="activeChips.length" class="chips-filtros" aria-label="Filtros activos">
      <span>Filtros activos:</span>
      <button
        v-for="chip in activeChips"
        :key="chip.key"
        type="button"
        :aria-label="'Quitar ' + chip.label"
        @click="clearFilter(chip.key)"
      >
        {{ chip.label }} <span aria-hidden="true">×</span>
      </button>
      <Button variant="secondary" @click="clearAllFilters">Limpiar filtros</Button>
    </div>
    <div class="toolbar results-toolbar">
      <p role="status">
        {{ total }} {{ total === 1 ? 'producto encontrado' : 'productos encontrados' }}
      </p>
      <div class="results-tools">
        <Button
          v-if="canCreate && category"
          variant="secondary"
          @click="emit('create', categoryCode)"
        >
          <Plus :size="16" aria-hidden="true" /> Crear nuevo producto
        </Button>
        <button
          v-if="view === 'lista'"
          type="button"
          class="image-toggle"
          :aria-pressed="showImages"
          @click="showImages = !showImages"
        >
          <EyeOff v-if="showImages" :size="16" aria-hidden="true" />
          <Eye v-else :size="16" aria-hidden="true" />
          {{ showImages ? 'Ocultar imágenes' : 'Mostrar imágenes' }}
        </button>
        <Button
          :variant="view === 'grid' ? 'primary' : 'secondary'"
          :aria-pressed="view === 'grid'"
          @click="view = 'grid'"
          ><LayoutGrid :size="16" aria-hidden="true" /> Cuadrícula</Button
        >
        <Button
          :variant="view === 'lista' ? 'primary' : 'secondary'"
          :aria-pressed="view === 'lista'"
          @click="view = 'lista'"
          ><List :size="16" aria-hidden="true" /> Lista</Button
        >
      </div>
    </div>
    <p v-if="error" role="alert" class="catalog-error">
      <CircleAlert :size="18" aria-hidden="true" />
      {{ error }} <button type="button" @click="load">Reintentar</button>
    </p>
    <p v-else-if="loading" role="status">Consultando catálogo…</p>
    <div v-else-if="products.length === 0" class="empty-results" role="status">
      <SearchX :size="28" aria-hidden="true" />
      <strong>{{
        activeChips.length ? 'Sin coincidencias' : 'No hay productos activos disponibles'
      }}</strong>
      <p>
        {{
          activeChips.length
            ? 'No se encontraron productos con estos filtros.'
            : 'El catálogo no contiene productos activos para cotizar.'
        }}
      </p>
      <Button v-if="activeChips.length" variant="secondary" @click="clearAllFilters"
        >Limpiar filtros</Button
      >
      <Button v-if="canCreate && category" @click="emit('create', categoryCode)">
        <Plus :size="16" aria-hidden="true" /> Crear producto
      </Button>
    </div>
    <div v-else-if="view === 'grid'" class="resultados-grid">
      <article v-for="producto in products" :key="producto.id" class="producto">
        <div class="product-visual">
          <ProductImage :image="producto.imagen_principal" :alt="producto.nombre" />
        </div>
        <div class="detalle">
          <small>{{ producto.sku || 'Sin SKU' }} · {{ producto.categoria_info?.nombre }}</small>
          <h4>{{ producto.nombre }}</h4>
          <p v-if="producto.familia_info">{{ producto.familia_info.nombre }}</p>
          <p>{{ producto.unidad_stock_info?.nombre }} · {{ money(producto.precio_vigente) }}</p>
          <small v-if="producto.promocion?.vigente"
            >Promoción vigente incluida en precio de referencia</small
          >
          <small>Disponibilidad referencial: {{ producto.disponibilidad_referencial }}</small>
          <div class="card-actions">
            <Button variant="secondary" @click="preview = producto"
              ><Eye :size="16" aria-hidden="true" /> Ver ficha</Button
            >
            <Button
              v-if="canEditProduct?.(producto)"
              variant="secondary"
              @click="emit('edit', producto.id)"
              >Editar ficha</Button
            >
          </div>
          <Button variant="primary" @click="selectProduct(producto)">
            <Check v-if="existingProductIds.includes(producto.id)" :size="16" aria-hidden="true" />
            <Plus v-else :size="16" aria-hidden="true" />
            {{
              existingProductIds.includes(producto.id) ? 'Ir a línea' : 'Seleccionar para cotizar'
            }}
          </Button>
        </div>
      </article>
    </div>
    <div v-else class="table-wrap">
      <table class="catalog-table">
        <caption class="sr-only">
          Catálogo de productos disponibles para cotizar
        </caption>
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Categoría y familia</th>
            <th scope="col" class="numeric">Precio vigente</th>
            <th scope="col">Disponibilidad ref.</th>
            <th scope="col" class="actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="producto in products" :key="producto.id">
            <td data-label="Producto">
              <div class="product-identity">
                <div v-if="showImages" class="thumbnail">
                  <ProductImage
                    :image="producto.imagen_principal"
                    :alt="producto.nombre"
                    sizes="56px"
                  />
                </div>
                <div class="product-identity__copy">
                  <strong>{{ producto.nombre }}</strong>
                  <small>{{ producto.sku || 'Sin SKU' }}</small>
                </div>
              </div>
            </td>
            <td data-label="Categoría y familia">
              {{ producto.categoria_info?.nombre }}
              <small v-if="producto.familia_info" class="table-secondary">{{
                producto.familia_info.nombre
              }}</small>
            </td>
            <td data-label="Precio vigente" class="numeric">
              <strong>{{ money(producto.precio_vigente) }}</strong>
            </td>
            <td data-label="Disponibilidad ref.">
              {{ producto.disponibilidad_referencial }} {{ producto.unidad_stock_info?.nombre }}
            </td>
            <td data-label="Acciones">
              <div class="table-actions">
                <Button
                  variant="secondary"
                  :aria-label="'Ver ficha de ' + producto.nombre"
                  @click="preview = producto"
                >
                  <Eye :size="16" aria-hidden="true" />
                </Button>
                <Button
                  v-if="canEditProduct?.(producto)"
                  variant="secondary"
                  @click="emit('edit', producto.id)"
                >
                  Editar
                </Button>
                <Button @click="selectProduct(producto)">
                  <Check
                    v-if="existingProductIds.includes(producto.id)"
                    :size="16"
                    aria-hidden="true"
                  />
                  <Plus v-else :size="16" aria-hidden="true" />
                  {{ existingProductIds.includes(producto.id) ? 'Ir a línea' : 'Añadir' }}
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Pagination
      v-if="!error && totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      @change="page = $event"
    />
    <Modal
      :open="Boolean(preview)"
      :title="preview?.nombre ?? 'Ficha de catálogo'"
      @close="preview = null"
    >
      <div v-if="preview" class="preview">
        <ProductImage :image="preview.imagen_principal" :alt="preview.nombre" />
        <p>SKU: {{ preview.sku || 'Sin SKU' }} · {{ preview.categoria_info?.nombre }}</p>
        <p>Familia: {{ preview.familia_info?.nombre || 'Sin familia' }}</p>
        <p>Unidad: {{ preview.unidad_stock_info?.nombre }}</p>
        <p>
          Precio lista: {{ money(preview.precio_lista ?? '0') }} · Vigente:
          {{ money(preview.precio_vigente) }}
        </p>
        <p>
          Stock: {{ preview.stock }} · Disponibilidad referencial:
          {{ preview.disponibilidad_referencial }}
        </p>
        <p v-if="preview.silla">
          Modelo: {{ preview.silla.modelo }} · Especificaciones:
          {{ preview.silla.especificaciones }}
        </p>
        <p v-if="preview.piso">
          Modelo: {{ preview.piso.modelo }} · Espesor: {{ preview.piso.espesor_mm }} mm
        </p>
        <div class="preview-actions">
          <Button variant="secondary" @click="preview = null">Cerrar ficha</Button>
          <Button @click="selectPreviewProduct">
            <ArrowRight :size="16" aria-hidden="true" />
            {{
              existingProductIds.includes(preview.id) ? 'Ir a línea' : 'Seleccionar para cotizar'
            }}
          </Button>
        </div>
      </div>
    </Modal>
    <div v-if="category && family" class="pendiente">
      <p>¿Aún no está definida la variante de esta familia?</p>
      <Button variant="secondary" @click="emit('pending', Number(family), Number(category))">
        Cotizar familia con variante pendiente
      </Button>
    </div>
  </div>
</template>

<style scoped>
.catalog-error {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-danger);
}
.catalogo-contextual {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.head,
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.head h3,
.producto h4 {
  margin: 0;
}
.head p,
.detalle p {
  margin: 0;
  color: var(--color-text-secondary);
}
.categorias,
.toolbar > div {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.categorias button {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  background: var(--color-surface);
  cursor: pointer;
}
.categorias button[aria-pressed='true'] {
  border-color: var(--color-primary);
  font-weight: 700;
}
.filtros-panel {
  min-width: 0;
}
.filtros-panel > summary {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  cursor: pointer;
  color: var(--color-text);
  font-weight: 650;
  padding: 0.6rem 0.2rem;
}
.filtros-panel > summary::marker {
  content: '';
}
.filtros-panel[open] > summary > svg:last-child {
  transform: rotate(180deg);
}
.chips-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.chips-filtros button:not(.button) {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.filters-primary {
  display: grid;
  grid-template-columns: minmax(14rem, 2fr) minmax(12rem, 1fr);
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.filtros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.filtro-texto {
  display: grid;
  gap: var(--space-2);
}
.filtro-texto input {
  width: 100%;
  min-width: 0;
  padding: var(--space-3);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-control);
}
.resultados-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-3);
}
.results-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.results-toolbar > p {
  font-weight: 700;
}
.image-toggle {
  display: inline-flex;
  gap: 0.45rem;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface);
  cursor: pointer;
}
.image-toggle:hover {
  background: var(--color-surface-hover);
}
.empty-results {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  color: var(--color-text-secondary);
}
.empty-results strong {
  color: var(--color-text);
}
.empty-results p {
  margin: 0;
}
.head h3 {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.categorias button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.toolbar > div > .button {
  flex: none;
}
.table-wrap {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.catalog-table {
  width: 100%;
  border-collapse: collapse;
}
.catalog-table th,
.catalog-table td {
  padding: 0.75rem 0.85rem;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.84rem;
}
.catalog-table th {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.catalog-table tr:last-child td {
  border-bottom: 0;
}
.catalog-table tbody tr:hover {
  background: var(--color-surface-hover);
}
.catalog-table .numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.catalog-table th.actions {
  text-align: right;
}
.product-identity {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 11rem;
}
.product-identity__copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.product-identity__copy strong {
  overflow-wrap: anywhere;
}
.product-identity__copy small,
.table-secondary {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.table-secondary {
  display: block;
  margin-top: 0.25rem;
}
.thumbnail {
  flex: none;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.4rem;
  overflow: hidden;
}
.thumbnail :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.thumbnail :deep(.fallback span) {
  display: none;
}
.thumbnail :deep(.fallback svg) {
  width: 1.2rem;
  height: 1.2rem;
}
.table-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.product-visual {
  height: 12rem;
  display: grid;
  background: var(--color-background);
}
.product-visual :deep(.product-image) {
  width: 100%;
  height: 12rem;
  min-height: 0;
  aspect-ratio: auto !important;
}
.preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}
.producto {
  min-width: 0;
  overflow: hidden;
  display: grid;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.detalle {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  padding: var(--space-4);
}
.detalle > .button:last-child {
  justify-self: stretch;
}
.detalle h4 {
  font-size: 1rem;
}
.detalle small {
  font-size: 0.78rem;
}
.detalle p {
  font-size: 0.82rem;
}
.detalle button {
  justify-self: start;
}
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.preview {
  display: grid;
  gap: var(--space-2);
}
.pendiente {
  padding: var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-card);
}
@media (max-width: 70rem) {
  .filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 48rem) {
  .filters-primary {
    grid-template-columns: 1fr;
  }
  .catalog-table thead {
    display: none;
  }
  .catalog-table,
  .catalog-table tbody,
  .catalog-table tr {
    display: block;
  }
  .catalog-table tr {
    padding: 0.7rem;
    border-bottom: 1px solid var(--color-border);
  }
  .catalog-table td {
    display: grid;
    grid-template-columns: minmax(7rem, 35%) minmax(0, 1fr);
    gap: 0.6rem;
    border: none;
    padding: 0.5rem;
    text-align: left !important;
  }
  .catalog-table td::before {
    content: attr(data-label);
    font-weight: 650;
    color: var(--color-text-secondary);
  }
  .table-actions {
    justify-content: flex-start;
  }
  .head {
    align-items: stretch;
  }
}
@media (max-width: 35rem) {
  .filtros {
    grid-template-columns: 1fr;
  }
  .results-tools {
    width: 100%;
  }
  .catalog-table td {
    grid-template-columns: 1fr;
  }
  .catalog-table td::before {
    font-size: 0.75rem;
  }
}
</style>
