<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import {
  Armchair,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Images,
  Info,
  Layers,
  Package,
  PackageCheck,
  Pencil,
  Ruler,
  StickyNote,
  Tag,
} from '@lucide/vue'
import type {
  DemandaPendienteDesglose,
  Producto,
  ProductoWritable,
  ValorCatalogoPublico,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { ApiError } from '@/shared/api'
import ImageGallery from '@/shared/media/ImageGallery.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import TextField from '@/shared/ui/TextField.vue'
import Toast from '@/shared/ui/Toast.vue'
import ProductoForm from '../components/ProductoForm.vue'
import { productosService } from '../services/productosService'
import {
  categoriaProducto,
  dineroProducto,
  disponibilidadMeta,
  estadoStockMeta,
  unidadesProducto,
} from '../utils/presentacionCatalogo'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const product = ref<Producto | null>(null)
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const success = ref('')
const toastMessage = ref('')
const confirmCancel = ref(false)
const dirty = ref(false)
const conflicted = ref(false)
const catalogOptions = reactive<Record<string, ValorCatalogoPublico[]>>({})
let requestId = 0

const canEdit = computed(
  () =>
    session.can('comercial.administrar') ||
    (session.can('catalogo.crear_producto') && product.value?.created_by === session.identity?.id),
)

const contextualDestination = computed(() => {
  const path = route.query.returnTo
  const draft = route.query.draft
  if (typeof path !== 'string' || !/^\/proformas(?:\/|$)/.test(path) || typeof draft !== 'string')
    return null
  return { path, query: { draft } }
})

const editStatus = computed(() => {
  if (saving.value) return 'Guardando en HOMEX…'
  if (conflicted.value) return 'Conflicto: cambios locales conservados'
  if (editing.value && dirty.value) return 'Cambios locales sin guardar'
  if (editing.value) return 'Editando ficha'
  return product.value?.activo === false ? 'Producto inactivo' : 'Ficha registrada'
})

function returnToProforma() {
  if (!contextualDestination.value) return
  void router.push(contextualDestination.value)
}

function resolveCatalogOption(conceptCode: string, id: number | null | undefined): string {
  if (id == null) return 'No informado'
  const found = catalogOptions[conceptCode]?.find((item) => item.id === id)
  return found?.nombre ?? `#${id}`
}

type SpecField = { label: string; value: string }

function formatSpecLabel(key: string): string {
  const known: Record<string, string> = {
    tapizado: 'Tapizado',
    resistencia: 'Resistencia',
    configuracion: 'Configuración',
    brazos: 'Brazos',
    altura: 'Altura',
    base: 'Base',
    ruedas: 'Ruedas',
    mecanismo: 'Mecanismo',
    material: 'Material',
    color: 'Color',
    acabado: 'Acabado',
  }
  return (
    known[key] ??
    key.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'))
  )
}

function flattenSpecs(value: unknown, prefix = ''): SpecField[] {
  if (value === null || value === undefined || value === '') return []
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ label: prefix ? formatSpecLabel(prefix) : 'Detalle', value: String(value) }]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenSpecs(item, `${prefix || 'Ítem'} ${index + 1}`))
  }
  if (typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenSpecs(child, key),
  )
}

const chairSpecs = computed<SpecField[]>(() => flattenSpecs(product.value?.silla?.especificaciones))

const floorDimensions = computed(() => {
  const piso = product.value?.piso
  if (!piso) return ''
  const parts: string[] = []
  if (piso.espesor_mm) parts.push(`${piso.espesor_mm} mm espesor`)
  if (piso.ancho_mm) parts.push(`${piso.ancho_mm} mm ancho`)
  if (piso.largo_mm) parts.push(`${piso.largo_mm} mm largo`)
  return parts.join(' · ')
})

async function loadCatalogLabels(prod: Producto, token: number) {
  type ConceptCode = Parameters<typeof proformasService.options>[0]
  const codes: ConceptCode[] = []
  if (prod.silla) codes.push('MARCA', 'COLOR')
  if (prod.piso) codes.push('MARCA', 'TIPO_PISO', 'MATERIAL_PISO', 'DISENO_PISO', 'ACABADO_PISO')
  const uniqueMissing = [...new Set(codes)].filter((code) => !catalogOptions[code])
  if (!uniqueMissing.length) return
  await Promise.allSettled(
    uniqueMissing.map(async (code) => {
      try {
        const items = await proformasService.options(code)
        if (token === requestId) catalogOptions[code] = items
      } catch {
        // Degrada limpiamente mostrando el ID si no hay opciones cargadas.
      }
    }),
  )
}

async function load() {
  const token = ++requestId
  const id = Number(route.params.id)
  loading.value = true
  error.value = ''
  success.value = ''
  conflicted.value = false
  product.value = null
  editing.value = false
  dirty.value = false
  confirmCancel.value = false
  try {
    const result = await productosService.get(id)
    if (token !== requestId) return
    product.value = result
    void loadCatalogLabels(result, token)
    if (route.query.editar === '1' && canEdit.value) editing.value = true
  } catch (cause) {
    if (token !== requestId) return
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el producto.'
  } finally {
    if (token === requestId) loading.value = false
  }
}

async function save(body: ProductoWritable) {
  if (!product.value) return
  saving.value = true
  error.value = ''
  try {
    product.value = await productosService.update(product.value.id, body, product.value.revision)
    conflicted.value = false
    dirty.value = false
    editing.value = false
    success.value = 'Producto actualizado.'
    toastMessage.value = 'Producto actualizado.'
    void loadCatalogLabels(product.value, requestId)
    if (contextualDestination.value) await router.push(contextualDestination.value)
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) conflicted.value = true
    error.value = cause instanceof ApiError ? cause.message : 'No se pudo guardar.'
    if (conflicted.value) error.value += ' Cambios conservados. Recarga solo para descartarlos.'
  } finally {
    saving.value = false
  }
}

function discardEdit() {
  confirmCancel.value = false
  editing.value = false
  dirty.value = false
  error.value = ''
}

const confirmLeave = ref(false)
let resolveLeave: ((answer: boolean) => void) | null = null
function answerLeave(answer: boolean) {
  confirmLeave.value = false
  const resolver = resolveLeave
  resolveLeave = null
  resolver?.(answer)
}
function confirmNavigation(): boolean | Promise<boolean> {
  if (saving.value) return false
  if (!editing.value || !dirty.value) return true
  return new Promise<boolean>((resolve) => {
    if (resolveLeave) resolveLeave(false)
    resolveLeave = resolve
    confirmLeave.value = true
  })
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (editing.value && dirty.value) event.preventDefault()
}
onBeforeRouteLeave(() => confirmNavigation())
onBeforeRouteUpdate((to, from) => to.params.id === from.params.id || confirmNavigation())
watch(
  () => route.params.id,
  () => void load(),
)
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void load()
})
const canAdmin = computed(() => session.can('comercial.administrar'))

const demandaOpen = ref(false)
const demandaLoading = ref(false)
const demandaError = ref('')
const demandaData = ref<DemandaPendienteDesglose | null>(null)

async function openDemandaModal() {
  if (!product.value) return
  demandaOpen.value = true
  demandaLoading.value = true
  demandaError.value = ''
  try {
    demandaData.value = await productosService.getDemandaPendiente(product.value.id)
  } catch (err) {
    demandaError.value =
      err instanceof ApiError ? err.message : 'No pudimos cargar el origen de la demanda pendiente.'
  } finally {
    demandaLoading.value = false
  }
}

const stockMinimoOpen = ref(false)
const stockMinimoInput = ref('')
const stockMinimoSaving = ref(false)
const stockMinimoError = ref('')

function openStockMinimoModal() {
  if (!product.value) return
  stockMinimoInput.value = product.value.stock_minimo ?? ''
  stockMinimoError.value = ''
  stockMinimoOpen.value = true
}

async function saveStockMinimo(value: string | null) {
  if (!product.value) return
  stockMinimoSaving.value = true
  stockMinimoError.value = ''
  try {
    product.value = await productosService.updateStockMinimo(product.value.id, value)
    stockMinimoOpen.value = false
    toastMessage.value = value === null ? 'Stock mínimo eliminado.' : 'Stock mínimo actualizado.'
  } catch (err) {
    stockMinimoError.value =
      err instanceof ApiError ? err.message : 'No pudimos guardar el stock mínimo.'
  } finally {
    stockMinimoSaving.value = false
  }
}

function submitStockMinimo() {
  const trimmed = stockMinimoInput.value.trim()
  if (!trimmed) {
    void saveStockMinimo(null)
    return
  }
  void saveStockMinimo(trimmed)
}

onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="product-detail">
    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      tone="success"
      @close="toastMessage = ''"
    />

    <div class="product-topline" aria-label="Ubicación en el proceso">
      <span>
        CATÁLOGO <span class="product-divider">/</span> PRODUCTOS
        <template v-if="product">
          <span class="product-divider">/</span> {{ product.sku || `#${product.id}` }}
        </template>
      </span>
      <div
        v-if="product"
        class="product-save-status"
        :class="{
          'product-save-status--saved': !editing && !conflicted && product.activo !== false,
          'product-save-status--warning': conflicted,
        }"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2
          v-if="!editing && !conflicted && product.activo !== false"
          :size="14"
          aria-hidden="true"
        />
        <CircleAlert v-else-if="conflicted" :size="14" aria-hidden="true" />
        <Info v-else :size="14" aria-hidden="true" />
        <span>{{ editStatus }}</span>
      </div>
    </div>

    <PageHeader
      :title="product?.nombre || 'Producto'"
      description="Ficha comercial, galería multimedia y disponibilidad operativa en inventario."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button
          v-if="contextualDestination && !editing"
          variant="secondary"
          @click="returnToProforma"
        >
          Volver a proforma
        </Button>
        <Button v-if="!editing" variant="secondary" @click="router.push('/productos')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver a productos
        </Button>
        <Button
          v-if="product && !editing && session.can('comercial.operar')"
          variant="secondary"
          @click="
            router.push({ path: '/movimientos-stock', query: { producto: String(product.id) } })
          "
        >
          <Boxes :size="17" aria-hidden="true" /> Ver movimientos
        </Button>
        <Button v-if="product && canEdit && !editing" variant="warning" @click="editing = true">
          <Pencil :size="16" aria-hidden="true" /> Editar datos comerciales
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="8" />
    <ErrorState v-else-if="error && !product" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>

    <template v-else-if="product">
      <div v-if="success" class="notice notice--success" role="status">{{ success }}</div>
      <div v-if="error && !editing" class="notice notice--error" role="alert">{{ error }}</div>

      <section v-if="editing" class="edit-panel" aria-labelledby="edit-product-title">
        <div class="edit-panel__head">
          <div class="edit-panel__identity">
            <span class="section-icon"><Pencil :size="20" aria-hidden="true" /></span>
            <div>
              <p class="section-kicker">EDICIÓN DE CATÁLOGO</p>
              <h2 id="edit-product-title">Editar datos comerciales</h2>
              <p>Actualiza nombre, precios, atributos técnicos o estado comercial.</p>
            </div>
          </div>
        </div>
        <ProductoForm
          :key="product.id"
          :initial="product"
          :processing="saving"
          @save="save"
          @change="dirty = true"
          @cancel="confirmCancel = true"
        />
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div v-if="conflicted" class="conflict-actions">
          <Button variant="secondary" @click="load">Descartar cambios y recargar producto</Button>
        </div>
      </section>

      <template v-else>
        <section class="summary" aria-label="Resumen comercial y existencias">
          <div class="stat">
            <span class="stat__icon">
              <Tag :size="18" aria-hidden="true" />
            </span>
            <div class="stat__body">
              <span>Precio vigente</span>
              <strong class="stat__value">{{ dineroProducto(product.precio_vigente) }}</strong>
              <small v-if="product.promocion?.vigente" class="stat__promo">
                Promoción vigente · Lista: {{ dineroProducto(product.precio_lista ?? '0') }}
              </small>
            </div>
          </div>

          <div class="stat">
            <span class="stat__icon stat__icon--success">
              <PackageCheck :size="18" aria-hidden="true" />
            </span>
            <div class="stat__body">
              <span>Stock actual</span>
              <strong class="stat__value">{{ unidadesProducto(product, product.stock) }}</strong>
              <small>Contabilizado en inventario</small>
              <div class="stat__badges">
                <Badge
                  v-if="estadoStockMeta(product.estado_stock).showBadge"
                  :tone="estadoStockMeta(product.estado_stock).tone"
                >
                  {{ estadoStockMeta(product.estado_stock).label }}
                </Badge>
                <small v-if="product.stock_minimo != null">
                  Mínimo: {{ unidadesProducto(product, product.stock_minimo) }}
                </small>
                <small v-else>Sin mínimo configurado</small>
                <button
                  v-if="canAdmin"
                  type="button"
                  class="inline-action-link"
                  @click="openStockMinimoModal"
                >
                  {{ product.stock_minimo != null ? 'Editar mínimo' : 'Configurar mínimo' }}
                </button>
              </div>
            </div>
          </div>

          <div class="stat">
            <span class="stat__icon stat__icon--warning">
              <Clock3 :size="18" aria-hidden="true" />
            </span>
            <div class="stat__body">
              <span>Demanda pendiente</span>
              <strong class="stat__value">
                {{ unidadesProducto(product, product.demanda_pendiente) }}
              </strong>
              <small>Proformas en revisión o enviadas (no reserva stock)</small>
              <div class="stat__badges">
                <button type="button" class="inline-action-link" @click="openDemandaModal">
                  Ver origen de demanda
                </button>
              </div>
            </div>
          </div>

          <div class="stat">
            <span class="stat__icon">
              <Boxes :size="18" aria-hidden="true" />
            </span>
            <div class="stat__body">
              <span>Disponibilidad referencial</span>
              <strong class="stat__value">
                {{ unidadesProducto(product, product.disponibilidad_referencial) }}
              </strong>
              <small>{{ disponibilidadMeta(product.disponibilidad_referencial).hint }}</small>
              <div class="stat__badges">
                <Badge :tone="disponibilidadMeta(product.disponibilidad_referencial).tone">
                  {{ disponibilidadMeta(product.disponibilidad_referencial).label }}
                </Badge>
                <Badge :tone="product.activo === false ? 'neutral' : 'success'">
                  {{ product.activo === false ? 'Inactivo' : 'Activo' }}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        <div class="product-detail-grid">
          <section class="panel" aria-labelledby="product-gallery-title">
            <div class="section-heading">
              <div class="section-heading__identity">
                <span class="section-icon">
                  <Images :size="18" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="product-gallery-title">Galería del producto</h2>
                  <p>Imágenes comerciales mostradas en catálogo y proformas.</p>
                </div>
              </div>
            </div>

            <ImageGallery
              :endpoint="`/api/v1/catalogo/productos/${product.id}/imagenes/`"
              :editable="canEdit"
            />
            <p v-if="canEdit" class="gallery-note">
              Las imágenes se guardan al instante. Para modificar los datos comerciales utiliza
              «Editar datos comerciales».
            </p>
          </section>

          <div class="detail-column">
            <section class="panel" aria-labelledby="product-info-title">
              <div class="section-heading">
                <div class="section-heading__identity">
                  <span class="section-icon">
                    <Package :size="18" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="product-info-title">Identificación de catálogo</h2>
                    <p>Datos maestros del producto registrados en HOMEX.</p>
                  </div>
                </div>
              </div>

              <div class="product-fields-grid">
                <div class="product-field-card">
                  <span class="product-field-card__label">SKU</span>
                  <strong class="product-field-card__value">
                    {{ product.sku || 'Sin SKU' }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Categoría</span>
                  <strong class="product-field-card__value">
                    {{ categoriaProducto(product) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Familia</span>
                  <strong
                    class="product-field-card__value"
                    :class="{ 'product-field-card__value--muted': !product.familia_info }"
                  >
                    {{ product.familia_info?.nombre || 'Sin familia' }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Unidad comercial</span>
                  <strong class="product-field-card__value">
                    {{ product.unidad_stock_info?.nombre || `Unidad #${product.unidad_stock}` }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Precio de lista</span>
                  <strong class="product-field-card__value">
                    {{ dineroProducto(product.precio_lista ?? '0') }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Estado comercial</span>
                  <div>
                    <Badge :tone="product.activo === false ? 'neutral' : 'success'">
                      {{ product.activo === false ? 'Inactivo' : 'Activo' }}
                    </Badge>
                  </div>
                </div>

                <div
                  v-if="product.observaciones"
                  class="product-field-card product-field-card--full"
                >
                  <span class="product-field-card__label">
                    <StickyNote :size="13" aria-hidden="true" /> Observaciones
                  </span>
                  <p class="product-field-card__text">{{ product.observaciones }}</p>
                </div>
              </div>
            </section>

            <section v-if="product.silla" class="panel" aria-labelledby="chair-spec-title">
              <div class="section-heading">
                <div class="section-heading__identity">
                  <span class="section-icon">
                    <Armchair :size="18" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="chair-spec-title">Ficha de silla</h2>
                    <p>Especificaciones técnicas y acabados del modelo.</p>
                  </div>
                </div>
              </div>

              <div class="product-fields-grid">
                <div class="product-field-card">
                  <span class="product-field-card__label">Modelo</span>
                  <strong
                    class="product-field-card__value"
                    :class="{ 'product-field-card__value--muted': !product.silla.modelo }"
                  >
                    {{ product.silla.modelo || 'No informado' }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Marca</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('MARCA', product.silla.marca) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Color principal</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('COLOR', product.silla.color_primario) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Color secundario</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('COLOR', product.silla.color_secundario) }}
                  </strong>
                </div>

                <div
                  v-for="(spec, idx) in chairSpecs"
                  :key="`${spec.label}-${idx}`"
                  class="product-field-card"
                >
                  <span class="product-field-card__label">{{ spec.label }}</span>
                  <strong class="product-field-card__value">{{ spec.value }}</strong>
                </div>
              </div>
            </section>

            <section v-if="product.piso" class="panel" aria-labelledby="floor-spec-title">
              <div class="section-heading">
                <div class="section-heading__identity">
                  <span class="section-icon">
                    <Layers :size="18" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="floor-spec-title">Ficha de piso</h2>
                    <p>Características físicas y cobertura por empaque.</p>
                  </div>
                </div>
              </div>

              <div class="product-fields-grid">
                <div class="product-field-card">
                  <span class="product-field-card__label">Modelo</span>
                  <strong
                    class="product-field-card__value"
                    :class="{ 'product-field-card__value--muted': !product.piso.modelo }"
                  >
                    {{ product.piso.modelo || 'No informado' }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Marca</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('MARCA', product.piso.marca) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Tipo</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('TIPO_PISO', product.piso.tipo) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Material</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('MATERIAL_PISO', product.piso.material) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Diseño</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('DISENO_PISO', product.piso.diseno) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">Acabado</span>
                  <strong class="product-field-card__value">
                    {{ resolveCatalogOption('ACABADO_PISO', product.piso.acabado) }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">
                    <Ruler :size="13" aria-hidden="true" /> Dimensiones
                  </span>
                  <strong
                    class="product-field-card__value"
                    :class="{ 'product-field-card__value--muted': !floorDimensions }"
                  >
                    {{ floorDimensions || 'No informadas' }}
                  </strong>
                </div>

                <div class="product-field-card">
                  <span class="product-field-card__label">m² por caja</span>
                  <strong
                    class="product-field-card__value"
                    :class="{ 'product-field-card__value--muted': !product.piso.m2_por_caja }"
                  >
                    {{ product.piso.m2_por_caja || 'No informado (dato descriptivo)' }}
                  </strong>
                </div>
              </div>
            </section>

            <p class="stock-note">
              El stock, la demanda, la disponibilidad y el precio vigente provienen del backend.
            </p>
          </div>
        </div>
      </template>
    </template>

    <ConfirmDialog
      :open="confirmCancel"
      title="Descartar cambios"
      description="Los cambios del producto no se guardarán."
      confirm-label="Descartar"
      @close="confirmCancel = false"
      @confirm="discardEdit"
    />

    <Modal
      :open="demandaOpen"
      title="Origen de la demanda pendiente"
      description="Proformas en estado En revisión o Enviada que incluyen este producto. Consultar la demanda es informativo y no reserva stock."
      @close="demandaOpen = false"
    >
      <div v-if="demandaLoading" class="modal-state">
        <LoadingSkeleton :lines="4" />
      </div>
      <ErrorState
        v-else-if="demandaError"
        :message="demandaError"
        retry-label="Reintentar"
        @retry="openDemandaModal"
      />
      <template v-else-if="demandaData && product">
        <div class="demanda-summary">
          <span>Total demanda pendiente:</span>
          <strong>{{ unidadesProducto(product, demandaData.demanda_pendiente_total) }}</strong>
        </div>
        <p v-if="Number(demandaData.cantidad_restringida) > 0" class="demanda-restricted-note">
          {{ unidadesProducto(product, demandaData.cantidad_restringida) }} corresponden a proformas
          de otros vendedores que no están disponibles para tu perfil.
        </p>
        <EmptyState
          v-if="demandaData.proformas.length === 0"
          title="Sin proformas pendientes visibles"
          description="No existen proformas pendientes visibles para este producto."
        />
        <ul v-else class="demanda-list">
          <li v-for="item in demandaData.proformas" :key="item.proforma_id" class="demanda-item">
            <div>
              <strong>Proforma #{{ item.numero }}</strong>
              <div class="demanda-item__meta">
                <Badge tone="warning">{{ item.estado.nombre }}</Badge>
                <span>{{ item.fecha }}</span>
              </div>
            </div>
            <div class="demanda-item__actions">
              <strong>{{ unidadesProducto(product, item.cantidad) }}</strong>
              <RouterLink
                class="inline-action-link"
                :to="'/proformas/' + item.proforma_id"
                @click="demandaOpen = false"
              >
                Abrir proforma
              </RouterLink>
            </div>
          </li>
        </ul>
      </template>
      <template #footer>
        <Button variant="secondary" @click="demandaOpen = false">Cerrar</Button>
      </template>
    </Modal>

    <Modal
      :open="stockMinimoOpen"
      title="Configurar stock mínimo"
      :description="
        product
          ? `Define el umbral de aviso de stock bajo para ${product.nombre} (${product.unidad_stock_info?.nombre || ''}). Deja vacío para quitar el mínimo.`
          : ''
      "
      @close="stockMinimoOpen = false"
    >
      <form id="stock-minimo-form" class="stock-minimo-form" @submit.prevent="submitStockMinimo">
        <TextField
          v-model="stockMinimoInput"
          name="stock-minimo"
          label="Stock mínimo"
          type="number"
          :step="product?.unidad_stock_info?.codigo === 'M2' ? '0.0001' : '1'"
          min="0"
          placeholder="Sin mínimo configurado"
          :error="stockMinimoError"
        />
      </form>
      <template #footer>
        <Button
          v-if="product?.stock_minimo != null"
          variant="warning"
          :disabled="stockMinimoSaving"
          @click="saveStockMinimo(null)"
        >
          Quitar mínimo
        </Button>
        <Button variant="secondary" :disabled="stockMinimoSaving" @click="stockMinimoOpen = false">
          Cancelar
        </Button>
        <Button type="submit" form="stock-minimo-form" :disabled="stockMinimoSaving">
          {{ stockMinimoSaving ? 'Guardando...' : 'Guardar mínimo' }}
        </Button>
      </template>
    </Modal>
    <ConfirmDialog
      :open="confirmLeave"
      title="Salir sin guardar"
      description="Hay cambios sin guardar en este producto. Si sales, se descartarán."
      confirm-label="Salir sin guardar"
      @close="answerLeave(false)"
      @confirm="answerLeave(true)"
    />
  </div>
</template>

<style scoped>
.product-detail {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  padding-bottom: var(--space-8);
}
.product-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.product-divider {
  margin: 0 0.45rem;
  opacity: 0.5;
}
.product-save-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: normal;
}
.product-save-status--saved svg {
  color: var(--color-success);
}
.product-save-status--warning,
.product-save-status--warning svg {
  color: var(--color-danger);
}
.notice {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  font-size: 0.9rem;
}
.notice--success {
  color: var(--color-success);
}
.notice--error,
.form-error {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.edit-panel {
  display: grid;
  gap: var(--space-5);
  padding: clamp(1rem, 2.5vw, 2rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.edit-panel__head {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
}
.edit-panel__identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}
.section-kicker {
  margin: 0;
  color: var(--color-primary-accent);
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.edit-panel__identity h2 {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
}
.edit-panel__identity p {
  margin: 0.25rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.stat,
.panel {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.stat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.stat__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.stat__icon--success {
  border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
  color: var(--color-success);
  background: var(--color-success-soft);
}
.stat__icon--warning {
  border-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.stat__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.stat__body > span {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.stat__body > small {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
}
.stat__promo {
  color: var(--color-success) !important;
  font-weight: 600;
}
.stat__value {
  font-size: 0.96rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.product-detail-grid {
  display: grid;
  grid-template-columns: minmax(18rem, 0.85fr) minmax(0, 1.15fr);
  gap: var(--space-5);
  align-items: start;
}
.detail-column {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.section-heading__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.section-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.section-heading h2 {
  margin: 0;
  font-size: 1.08rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
}
.gallery-note,
.stock-note {
  margin: var(--space-3) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.stock-note {
  margin-top: 0;
}
.product-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.product-field-card {
  display: grid;
  gap: 0.25rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  min-width: 0;
  align-content: start;
}
.product-field-card--full {
  grid-column: 1 / -1;
}
.product-field-card__label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.product-field-card__value {
  font-size: 0.9rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.product-field-card__value--muted {
  color: var(--color-text-secondary);
  font-weight: 500;
}
.product-field-card__text {
  margin: 0;
  font-size: 0.88rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@media (max-width: 64rem) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .product-detail-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 38rem) {
  .summary,
  .product-fields-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.stat__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.25rem;
}
.inline-action-link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--color-primary-accent);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
.demanda-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-subtle, var(--color-surface-hover));
  margin-bottom: 0.75rem;
}
.demanda-restricted-note {
  margin: 0 0 0.75rem;
  font-size: 0.84rem;
  color: var(--color-text-secondary);
}
.demanda-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}
.demanda-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.demanda-item__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
.demanda-item__actions {
  display: grid;
  justify-items: end;
  gap: 0.25rem;
}
.stock-minimo-form {
  display: grid;
  gap: 0.75rem;
}
</style>
