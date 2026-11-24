<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Armchair,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Package,
  Pencil,
  Plus,
  RotateCw,
  Tag,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import type { DetalleProforma, Producto } from '@/generated/api'
import type { GalleryImage } from '@/shared/media/gallery'
import { galleryService } from '@/shared/media/gallery'
import Modal from '@/shared/ui/Modal.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'
import { leerDatosTecnicos } from '@/modules/proformas/services/muebleTecnico'
import {
  disponibilidadMeta,
  estadoStockMeta,
  unidadesProducto,
} from '../utils/presentacionCatalogo'

export type QuickQuotePayload = {
  cantidad: string
  precio_unitario: string
  descuento: string
  descripcion: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    product?: Producto | null
    line?: DetalleProforma | null
    loading?: boolean
    error?: string
    productLoading?: boolean
    productError?: string
    actionLabel?: string
    detailTo?: string
    gallery?: GalleryImage[]
    galleryEndpoint?: string
    galleryFallbackEndpoint?: string
    moneda?: string
    quoteMode?: boolean
    initialQuantity?: string | number
    canEdit?: boolean
  }>(),
  {
    product: null,
    line: null,
    loading: false,
    error: '',
    productLoading: false,
    productError: '',
    actionLabel: '',
    detailTo: '',
    gallery: () => [],
    galleryEndpoint: '',
    galleryFallbackEndpoint: '',
    moneda: '',
    quoteMode: false,
    initialQuantity: '1',
    canEdit: false,
  },
)
const emit = defineEmits<{
  close: []
  retry: []
  action: []
  edit: [productId: number]
  selectQuote: [payload: QuickQuotePayload]
}>()

const activeImage = ref(0)
const zoomed = ref(false)
const galleryFailed = ref(false)
const gallerySourceIndex = ref(0)
const loadedGallery = ref<GalleryImage[]>([])
const galleryLoading = ref(false)
const galleryError = ref('')
let galleryRequestId = 0
watch(
  () => [props.open, props.line?.id, props.product?.id],
  () => {
    activeImage.value = 0
    zoomed.value = false
    galleryFailed.value = false
  },
)
const title = computed(() => props.line?.nombre ?? props.product?.nombre ?? 'Vista rápida')
const category = computed(
  () => props.line?.tipo_item_info?.nombre ?? props.product?.categoria_info?.nombre ?? '',
)
const headerIcon = computed(() => {
  const code = props.line?.tipo_item_info?.codigo ?? props.product?.categoria_info?.codigo
  if (code === 'SILLA') return Armchair
  if (code === 'PISO_FLOTANTE') return Layers
  return Package
})
const galleryImages = computed(() =>
  loadedGallery.value.length ? loadedGallery.value : props.gallery,
)
const primaryGalleryImage = computed(() => {
  if (galleryImages.value.length)
    return galleryImages.value[activeImage.value] ?? galleryImages.value[0]
  return null
})
const gallerySources = computed(() => {
  const selected = primaryGalleryImage.value
  const variants = Object.entries(selected?.variantes ?? {})
    .map(([width, url]) => ({ width: Number.parseInt(width, 10), url }))
    .filter(
      (item) => Number.isFinite(item.width) && item.width > 0 && /^https?:\/\//.test(item.url),
    )
    .sort((a, b) => b.width - a.width)
  const sources = variants.map((item) => item.url)
  if (selected?.url) sources.push(selected.url)
  return [...new Set(sources)]
})
const gallerySource = computed(() => gallerySources.value[gallerySourceIndex.value] ?? '')
watch(primaryGalleryImage, () => {
  gallerySourceIndex.value = 0
  galleryFailed.value = false
})
function onGalleryImageError() {
  if (gallerySourceIndex.value + 1 < gallerySources.value.length) gallerySourceIndex.value++
  else galleryFailed.value = true
}
function retryGalleryImage() {
  gallerySourceIndex.value = 0
  galleryFailed.value = false
}
function selectGalleryImage(index: number) {
  activeImage.value = index
  gallerySourceIndex.value = 0
  galleryFailed.value = false
}
function stepGalleryImage(delta: number) {
  const len = galleryImages.value.length
  if (len <= 1) return
  selectGalleryImage((activeImage.value + delta + len) % len)
}
async function loadGallery() {
  const requestId = ++galleryRequestId
  loadedGallery.value = []
  galleryError.value = ''
  if (!props.open || !props.galleryEndpoint) return
  galleryLoading.value = true
  try {
    let result = await galleryService.list(props.galleryEndpoint)
    if (requestId !== galleryRequestId) return
    if (!result.imagenes.length && props.galleryFallbackEndpoint)
      result = await galleryService.list(props.galleryFallbackEndpoint)
    if (requestId !== galleryRequestId) return
    loadedGallery.value = result.imagenes
    activeImage.value = 0
  } catch (cause) {
    if (requestId !== galleryRequestId) return
    if (props.galleryFallbackEndpoint) {
      try {
        const result = await galleryService.list(props.galleryFallbackEndpoint)
        if (requestId !== galleryRequestId) return
        loadedGallery.value = result.imagenes
      } catch {
        if (requestId !== galleryRequestId) return
        galleryError.value =
          cause instanceof Error ? cause.message : 'No se pudieron cargar las imágenes.'
      }
    } else {
      galleryError.value =
        cause instanceof Error ? cause.message : 'No se pudieron cargar las imágenes.'
    }
  } finally {
    if (requestId === galleryRequestId) galleryLoading.value = false
  }
}
watch(
  () => [props.open, props.galleryEndpoint, props.galleryFallbackEndpoint] as const,
  ([open, endpoint]) => {
    if (open && endpoint) void loadGallery()
    else {
      galleryRequestId++
      galleryLoading.value = false
      loadedGallery.value = []
      galleryError.value = ''
    }
  },
  { immediate: true },
)

type DisplayField = { label: string; value: string }
function labelFor(key: string) {
  const known: Record<string, string> = {
    dimensiones: 'Dimensiones',
    alto: 'Alto',
    ancho: 'Ancho',
    largo: 'Largo',
    profundidad: 'Profundidad',
    caracteristicas_generales: 'Características generales',
    atributos: 'Atributos',
    observaciones: 'Observaciones',
    descripcion_original: 'Descripción original',
    cantidad_interna: 'Cantidad por mueble',
    material: 'Material',
    espesor: 'Espesor',
    color: 'Color',
    acabado: 'Acabado',
    marca: 'Marca',
    modelo: 'Modelo',
  }
  return (
    known[key] ??
    key.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'))
  )
}
function flatten(value: unknown, prefix = ''): DisplayField[] {
  if (value === null || value === undefined || value === '') return []
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return [{ label: prefix ? labelFor(prefix) : 'Valor', value: String(value) }]
  if (Array.isArray(value))
    return value.flatMap((item, index) => flatten(item, `${prefix || 'Elemento'} ${index + 1}`))
  if (typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if ('valor' in record) {
    const amount = String(record.valor ?? '')
    const unit = typeof record.unidad === 'string' ? record.unidad : ''
    return amount ? [{ label: labelFor(prefix), value: `${amount}${unit ? ` ${unit}` : ''}` }] : []
  }
  return Object.entries(record).flatMap(([key, child]) => {
    if (key === 'uid') return []
    return flatten(child, key)
  })
}
function productFields(product: Producto) {
  const fields: DisplayField[] = []
  if (product.silla?.marca_nombre || product.silla?.marca != null)
    fields.push({
      label: 'Marca',
      value: product.silla.marca_nombre || `#${product.silla.marca}`,
    })
  if (product.silla?.modelo) fields.push({ label: 'Modelo de silla', value: product.silla.modelo })
  if (product.silla?.color_primario_nombre || product.silla?.color_primario != null)
    fields.push({
      label: 'Color principal',
      value: product.silla.color_primario_nombre || `#${product.silla.color_primario}`,
    })
  if (product.silla?.color_secundario_nombre || product.silla?.color_secundario != null)
    fields.push({
      label: 'Color secundario',
      value: product.silla.color_secundario_nombre || `#${product.silla.color_secundario}`,
    })
  if (product.silla?.especificaciones)
    fields.push(...flatten(product.silla.especificaciones, 'Especificaciones'))
  if (product.piso?.marca_nombre || product.piso?.marca != null)
    fields.push({
      label: 'Marca',
      value: product.piso.marca_nombre || `#${product.piso.marca}`,
    })
  if (product.piso?.modelo) fields.push({ label: 'Modelo de piso', value: product.piso.modelo })
  if (product.piso?.tipo_nombre || product.piso?.tipo != null)
    fields.push({
      label: 'Tipo',
      value: product.piso.tipo_nombre || `#${product.piso.tipo}`,
    })
  if (product.piso?.material_nombre || product.piso?.material != null)
    fields.push({
      label: 'Material',
      value: product.piso.material_nombre || `#${product.piso.material}`,
    })
  if (product.piso?.diseno_nombre || product.piso?.diseno != null)
    fields.push({
      label: 'Diseño',
      value: product.piso.diseno_nombre || `#${product.piso.diseno}`,
    })
  if (product.piso?.acabado_nombre || product.piso?.acabado != null)
    fields.push({
      label: 'Acabado',
      value: product.piso.acabado_nombre || `#${product.piso.acabado}`,
    })
  if (product.piso?.espesor_mm)
    fields.push({ label: 'Espesor', value: `${product.piso.espesor_mm} mm` })
  if (product.piso?.ancho_mm) fields.push({ label: 'Ancho', value: `${product.piso.ancho_mm} mm` })
  if (product.piso?.largo_mm) fields.push({ label: 'Largo', value: `${product.piso.largo_mm} mm` })
  if (product.piso?.m2_por_caja)
    fields.push({ label: 'Metros cuadrados por caja', value: product.piso.m2_por_caja })
  if (product.observaciones) fields.push({ label: 'Observaciones', value: product.observaciones })
  return fields
}
function lineAmount() {
  return props.line?.total ?? ''
}
function formatQuantity(val: string | number | null | undefined): string {
  if (val == null || val === '') return ''
  const str = String(val).trim()
  const num = Number.parseFloat(str)
  if (!Number.isFinite(num)) return str
  if (num === Math.trunc(num)) return String(Math.trunc(num))
  return String(Number(num.toFixed(4)))
}
function formatUnitPrice(val: string | number | null | undefined): string {
  if (val == null || val === '') return 'No especificado'
  const str = String(val).trim()
  if (/^[A-Za-z$]/.test(str)) return str
  const num = typeof val === 'number' ? val : Number.parseFloat(str)
  if (!Number.isFinite(num)) return str
  if (props.moneda) {
    try {
      return new Intl.NumberFormat('es-BO', {
        style: 'currency',
        currency: props.moneda,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num)
    } catch {
      return `${props.moneda} ${num.toFixed(2)}`
    }
  }
  return str
}
function formatDiscount(discount: string | number | null | undefined): string | null {
  if (discount == null || discount === '') return null
  const num = Number.parseFloat(String(discount))
  if (!Number.isFinite(num) || num === 0) return null
  if (props.moneda) {
    try {
      return new Intl.NumberFormat('es-BO', {
        style: 'currency',
        currency: props.moneda,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num)
    } catch {
      return `${props.moneda} ${num.toFixed(2)}`
    }
  }
  return String(discount)
}
const summaryDimensions = computed(() => {
  const technical = leerDatosTecnicos(props.line?.especificacion?.datos_tecnicos)
  return flatten(technical.caracteristicas_generales)
    .filter((field) => ['Alto', 'Ancho', 'Largo', 'Profundidad'].includes(field.label))
    .slice(0, 4)
})
const summaryNotes = computed(() => props.line?.especificacion?.observaciones?.trim() ?? '')

const hasMedia = computed(() =>
  Boolean(
    galleryImages.value.length > 0 ||
    props.product?.imagen_principal ||
    galleryLoading.value ||
    galleryError.value,
  ),
)

const quoteQty = ref('1')
const quotePrice = ref('')
const quoteDiscount = ref('0')
const quoteDesc = ref('')
const quoteError = ref('')

watch(
  () => [props.open, props.product?.id, props.initialQuantity] as const,
  ([open]) => {
    if (!open) return
    quoteQty.value = String(props.initialQuantity ?? '1')
    quotePrice.value = props.product?.precio_vigente ?? ''
    quoteDiscount.value = '0'
    quoteDesc.value = ''
    quoteError.value = ''
  },
  { immediate: true },
)

const quoteUnitCode = computed(() => props.product?.unidad_stock_info?.codigo ?? 'PIEZA')
const quoteQtyStep = computed(() => (quoteUnitCode.value === 'M2' ? '0.0001' : '1'))
const quoteQtyMin = computed(() => (quoteUnitCode.value === 'M2' ? '0.0001' : '1'))

const quotePreviewTotal = computed(() => {
  const q = Number(quoteQty.value)
  const p = Number(quotePrice.value)
  const d = Number(quoteDiscount.value || 0)
  if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return null
  const gross = q * p
  const disc = Number.isFinite(d) && d > 0 ? d : 0
  return { gross, disc, net: Math.max(0, gross - disc) }
})

function submitQuickQuote() {
  if (!props.product) return
  if (props.actionLabel === 'Ir a línea') {
    emit('action')
    return
  }
  quoteError.value = ''
  const qty = Number(quoteQty.value)
  const bajoPedido = props.product.modalidad_abastecimiento === 'BAJO_PEDIDO'
  const stock = Number(props.product.stock ?? 0)
  const price = Number(quotePrice.value)
  const disc = quoteDiscount.value === '' ? 0 : Number(quoteDiscount.value)

  if (!Number.isFinite(qty) || qty <= 0) {
    quoteError.value = 'La cantidad debe ser mayor que cero.'
    return
  }
  if (quoteUnitCode.value !== 'M2' && !Number.isInteger(qty)) {
    quoteError.value = 'Esta unidad comercial requiere una cantidad entera.'
    return
  }
  if (!bajoPedido && stock <= 0) {
    quoteError.value = 'Este producto no tiene stock disponible actualmente.'
    return
  }
  if (!bajoPedido && qty > stock) {
    quoteError.value = `La cantidad solicitada (${qty}) supera el stock actual (${unidadesProducto(props.product, props.product.stock)}).`
    return
  }
  if (!Number.isFinite(price) || price <= 0) {
    quoteError.value = 'El precio unitario debe ser mayor que cero.'
    return
  }
  if (!Number.isFinite(disc) || disc < 0) {
    quoteError.value = 'El descuento no puede ser negativo.'
    return
  }
  if (disc > qty * price) {
    quoteError.value = 'El descuento no puede superar el importe de la línea.'
    return
  }
  emit('selectQuote', {
    cantidad: String(quoteQty.value).trim(),
    precio_unitario: String(quotePrice.value).trim(),
    descuento: disc > 0 ? disc.toFixed(2) : '0.00',
    descripcion: quoteDesc.value.trim(),
  })
}
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    :description="
      category
        ? `${category}${line ? ' · Datos de proforma' : ' · Datos actuales del catálogo'}`
        : 'Consulta de producto'
    "
    extra-wide
    sticky-frame
    @close="emit('close')"
  >
    <template #title-icon>
      <component :is="headerIcon" class="quick-view-icon" :size="22" aria-hidden="true" />
    </template>
    <div
      class="quick-view"
      :class="{ 'quick-view--line': line, 'quick-view--no-media': product && !line && !hasMedia }"
    >
      <div
        v-if="loading && !line && !product"
        class="viewer-state"
        role="status"
        aria-live="polite"
      >
        <span class="spinner" aria-hidden="true"></span><span>Cargando ficha del producto…</span>
      </div>
      <div v-else-if="error && !line" class="viewer-state viewer-state--error" role="alert">
        <p>{{ error }}</p>
        <Button variant="secondary" class="retry" @click="emit('retry')"
          ><RotateCw :size="16" aria-hidden="true" />Reintentar</Button
        >
      </div>
      <template v-else>
        <div
          v-if="!line && (productLoading || productError || error)"
          class="catalog-message"
          :class="{ 'catalog-message--error': productError || error }"
          :role="productError || error ? 'status' : 'status'"
        >
          <span v-if="productLoading" class="spinner spinner--small" aria-hidden="true"></span>
          <span>{{ productError || error || 'Cargando información actual del catálogo…' }}</span>
          <button
            v-if="productError || error"
            class="retry-link retry"
            type="button"
            @click="emit('retry')"
          >
            Reintentar
          </button>
        </div>
        <section v-if="line || hasMedia" class="media-panel" aria-label="Imágenes del producto">
          <div class="media-panel__header">
            <span class="media-panel__title">
              {{
                galleryImages.length > 1
                  ? `Galería (${activeImage + 1}/${galleryImages.length})`
                  : 'Imagen del producto'
              }}
            </span>
            <div class="media-panel__controls">
              <button
                v-if="galleryImages.length > 1"
                type="button"
                class="media-ctl-btn"
                aria-label="Imagen anterior"
                @click="stepGalleryImage(-1)"
              >
                <ChevronLeft :size="16" aria-hidden="true" />
              </button>
              <button
                v-if="galleryImages.length > 1"
                type="button"
                class="media-ctl-btn"
                aria-label="Imagen siguiente"
                @click="stepGalleryImage(1)"
              >
                <ChevronRight :size="16" aria-hidden="true" />
              </button>
              <button
                v-if="(gallerySource && !galleryFailed) || product?.imagen_principal"
                class="media-ctl-btn"
                type="button"
                :aria-label="zoomed ? 'Reducir imagen' : 'Ampliar imagen'"
                @click="zoomed = !zoomed"
              >
                <ZoomOut v-if="zoomed" :size="16" aria-hidden="true" /><ZoomIn
                  v-else
                  :size="16"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            class="media-viewer-layout"
            :class="{ 'media-viewer-layout--with-thumbs': galleryImages.length > 1 }"
          >
            <div
              v-if="galleryImages.length > 1"
              class="thumbnails thumbnails--vertical"
              aria-label="Miniaturas de imágenes"
            >
              <button
                v-for="(image, index) in galleryImages"
                :key="image.id"
                type="button"
                :aria-label="`Mostrar imagen ${index + 1}`"
                :aria-pressed="activeImage === index"
                @click="selectGalleryImage(index)"
              >
                <GalleryPhoto :src="image.url" :alt="image.nombre" />
              </button>
            </div>
            <div class="media-frame" :class="{ 'media-frame--zoomed': zoomed }">
              <GalleryPhoto
                v-if="gallerySource && !galleryFailed"
                class="gallery-image"
                :src="gallerySource"
                :alt="primaryGalleryImage?.nombre || title"
                @error="onGalleryImageError"
              />
              <GalleryPhoto
                v-else-if="product?.imagen_principal"
                :src="product.imagen_principal.original"
                :alt="title"
              />
              <div
                v-else
                class="image-empty"
                role="img"
                :aria-label="
                  galleryFailed
                    ? `No se pudo cargar la imagen para ${title}`
                    : `Sin imagen para ${title}`
                "
              >
                <span class="image-empty__icon" aria-hidden="true">
                  <component :is="headerIcon" :size="32" />
                </span>
                <span>{{
                  galleryFailed ? 'No se pudo cargar la imagen' : 'Sin imágenes disponibles'
                }}</span>
                <button
                  v-if="galleryFailed"
                  type="button"
                  class="retry-link"
                  @click="retryGalleryImage"
                >
                  Reintentar imagen
                </button>
              </div>
            </div>
          </div>
          <div v-if="galleryLoading" class="gallery-status" role="status">Cargando imágenes…</div>
          <div v-if="galleryError" class="gallery-status gallery-status--error" role="status">
            <span>{{ galleryError }}</span>
            <button type="button" class="retry-link" @click="loadGallery">
              Reintentar imágenes
            </button>
          </div>
        </section>

        <div class="detail-panels">
          <div v-if="product && !line && !hasMedia" class="no-media-hero">
            <span class="no-media-hero__icon" aria-hidden="true">
              <component :is="headerIcon" :size="26" />
            </span>
            <div class="no-media-hero__copy">
              <div class="no-media-hero__badges">
                <Badge tone="info">{{ product.categoria_info?.nombre || 'Catálogo' }}</Badge>
                <Badge v-if="product.familia_info" tone="neutral">{{
                  product.familia_info.nombre
                }}</Badge>
                <Badge :tone="product.activo === false ? 'neutral' : 'success'">
                  {{ product.activo === false ? 'Inactivo' : 'Activo' }}
                </Badge>
                <Badge v-if="product.promocion?.vigente" tone="warning">Promoción vigente</Badge>
              </div>
              <strong>{{ product.nombre }}</strong>
              <small
                >SKU: {{ product.sku || 'No aplica' }} ·
                {{ product.unidad_stock_info?.nombre }}</small
              >
            </div>
          </div>
          <section v-if="product && !line" class="info-card info-card--identity">
            <h3>
              <span class="card-heading-icon card-heading-icon--info" aria-hidden="true">
                <Package :size="16" />
              </span>
              Identificación de catálogo
            </h3>
            <dl>
              <div>
                <dt>SKU</dt>
                <dd>{{ product.sku || 'No aplica' }}</dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{{ product.categoria_info?.nombre || 'Sin categoría' }}</dd>
              </div>
              <div v-if="product.familia_info">
                <dt>Familia</dt>
                <dd>{{ product.familia_info.nombre }}</dd>
              </div>
              <div>
                <dt>Unidad comercial</dt>
                <dd>{{ product.unidad_stock_info?.nombre || 'No especificada' }}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span
                    class="status"
                    :class="product.activo === false ? 'status--inactive' : 'status--active'"
                    >{{ product.activo === false ? 'Inactivo' : 'Activo' }}</span
                  >
                </dd>
              </div>
            </dl>
          </section>

          <section v-if="product && !line" class="info-card info-card--commercial">
            <h3>
              <span class="card-heading-icon card-heading-icon--success" aria-hidden="true">
                <Tag :size="16" />
              </span>
              Información comercial actual
            </h3>
            <p class="section-note">
              Valores vigentes del catálogo; no reemplazan importes negociados de la proforma.
            </p>
            <dl>
              <div v-if="product.precio_lista">
                <dt>Precio de lista</dt>
                <dd>{{ product.precio_lista }}</dd>
              </div>
              <div>
                <dt>Precio vigente del catálogo</dt>
                <dd>{{ product.precio_vigente }}</dd>
              </div>
              <div v-if="product.promocion?.vigente">
                <dt>Promoción vigente</dt>
                <dd>
                  {{ product.promocion.precio_ahora }} (antes {{ product.promocion.precio_antes }})
                </dd>
              </div>
              <template v-if="product.modalidad_abastecimiento === 'BAJO_PEDIDO'">
                <div>
                  <dt>Abastecimiento</dt>
                  <dd>
                    <Badge tone="info">Disponible bajo pedido</Badge>
                  </dd>
                </div>
                <div>
                  <dt>Demanda pendiente</dt>
                  <dd>{{ unidadesProducto(product, product.demanda_pendiente) }}</dd>
                </div>
              </template>
              <template v-else>
                <div>
                  <dt>Stock actual</dt>
                  <dd>
                    {{ unidadesProducto(product, product.stock) }}
                    <Badge
                      v-if="estadoStockMeta(product.estado_stock).showBadge"
                      :tone="estadoStockMeta(product.estado_stock).tone"
                    >
                      {{ estadoStockMeta(product.estado_stock).label }}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>Demanda pendiente</dt>
                  <dd>{{ unidadesProducto(product, product.demanda_pendiente) }}</dd>
                </div>
                <div>
                  <dt>Disponibilidad referencial</dt>
                  <dd>
                    <Badge
                      :tone="disponibilidadMeta(product.disponibilidad_referencial).tone"
                      :title="disponibilidadMeta(product.disponibilidad_referencial).hint"
                    >
                      {{ unidadesProducto(product, product.disponibilidad_referencial) }}
                    </Badge>
                  </dd>
                </div>
              </template>
            </dl>
          </section>

          <section v-if="line" class="info-card quote-card quote-card--summary">
            <h3><Boxes :size="18" aria-hidden="true" />Resumen de la línea</h3>
            <p class="section-note">Valores guardados en esta proforma.</p>
            <div class="line-summary-meta">
              <span>{{ line.tipo_item_info?.nombre || 'Línea de proforma' }}</span>
              <span v-if="line.producto && product?.sku">SKU {{ product.sku }}</span>
            </div>
            <dl class="line-summary-metrics">
              <div>
                <dt>Cantidad</dt>
                <dd>{{ formatQuantity(line.cantidad) }} {{ line.unidad_info?.nombre }}</dd>
              </div>
              <div v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
                <dt>Importe negociado histórico</dt>
                <dd>{{ line.importe_negociado ?? line.total }}</dd>
              </div>
              <div v-else>
                <dt>Precio por unidad cotizado</dt>
                <dd>{{ formatUnitPrice(line.precio_unitario) }}</dd>
              </div>
              <div>
                <dt>Descuento</dt>
                <dd
                  :class="{
                    'line-summary-discount--active': line.descuento && Number(line.descuento) !== 0,
                  }"
                >
                  {{
                    line.descuento && Number(line.descuento) !== 0
                      ? formatDiscount(line.descuento) || line.descuento
                      : 'Sin descuento'
                  }}
                </dd>
              </div>
              <div class="line-summary-total">
                <dt>Total de línea</dt>
                <dd>{{ lineAmount() }}</dd>
              </div>
            </dl>
            <p v-if="line.descripcion" class="line-summary-description">
              <strong>Descripción</strong>{{ line.descripcion }}
            </p>
          </section>

          <section
            v-if="line && (summaryDimensions.length || summaryNotes)"
            class="info-card data-summary"
          >
            <h3><Layers :size="18" aria-hidden="true" />Resumen de datos</h3>
            <dl v-if="summaryDimensions.length" class="data-summary-dimensions">
              <div v-for="field in summaryDimensions" :key="field.label">
                <dt>{{ field.label }}</dt>
                <dd>{{ field.value }}</dd>
              </div>
            </dl>
            <p v-if="summaryNotes" class="line-summary-description">
              <strong>Observaciones</strong>{{ summaryNotes }}
            </p>
            <p class="data-summary-hint">
              El detalle completo está disponible con el botón «{{
                actionLabel || 'Editar línea'
              }}».
            </p>
          </section>

          <section v-if="product && !line && productFields(product).length" class="info-card">
            <h3>
              <span class="card-heading-icon card-heading-icon--warning" aria-hidden="true">
                <Boxes :size="16" />
              </span>
              Características del producto
            </h3>
            <dl>
              <div
                v-for="(field, index) in productFields(product)"
                :key="`${field.label}-${index}`"
              >
                <dt>{{ field.label }}</dt>
                <dd>{{ field.value }}</dd>
              </div>
            </dl>
          </section>

          <section
            v-if="quoteMode && product && !line && actionLabel !== 'Ir a línea'"
            class="info-card info-card--quote"
            aria-label="Opciones para agregar a la proforma"
          >
            <h3>
              <span class="card-heading-icon card-heading-icon--primary" aria-hidden="true">
                <Plus :size="16" />
              </span>
              Agregar a la proforma
            </h3>
            <div class="quote-inputs-grid">
              <label class="quote-field">
                <span>Cantidad ({{ product.unidad_stock_info?.nombre || 'u.' }})</span>
                <input
                  v-model="quoteQty"
                  type="number"
                  :min="quoteQtyMin"
                  :step="quoteQtyStep"
                  :max="
                    product.modalidad_abastecimiento !== 'BAJO_PEDIDO' && Number(product.stock) > 0
                      ? product.stock
                      : undefined
                  "
                />
              </label>
              <label class="quote-field">
                <span>Precio unitario ({{ moneda || 'BOB' }})</span>
                <input v-model="quotePrice" type="number" min="0.01" step="0.01" />
              </label>
              <label class="quote-field">
                <span>Descuento de línea ({{ moneda || 'BOB' }})</span>
                <input v-model="quoteDiscount" type="number" min="0" step="0.01" />
              </label>
              <label class="quote-field quote-field--full">
                <span>Descripción / nota de línea (opcional)</span>
                <input
                  v-model="quoteDesc"
                  type="text"
                  maxlength="240"
                  placeholder="Ej. Color o detalle comercial para la proforma…"
                />
              </label>
            </div>
            <div v-if="quotePreviewTotal" class="quote-preview-summary">
              <span>Subtotal: {{ formatUnitPrice(quotePreviewTotal.gross) }}</span>
              <span v-if="quotePreviewTotal.disc > 0" class="quote-preview-discount">
                Descuento: −{{ formatUnitPrice(quotePreviewTotal.disc) }}
              </span>
              <strong>Total línea: {{ formatUnitPrice(quotePreviewTotal.net) }}</strong>
            </div>
            <p v-if="quoteError" class="quote-error" role="alert">{{ quoteError }}</p>
          </section>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="viewer-footer">
        <Button variant="secondary" @click="emit('close')">Cerrar</Button>
        <template v-if="quoteMode && product && !line">
          <Button v-if="canEdit" variant="warning" @click="emit('edit', product.id)">
            <Pencil :size="16" aria-hidden="true" />
            Editar producto
          </Button>
          <Button variant="success" class="context-action" @click="submitQuickQuote">
            <Check v-if="actionLabel === 'Ir a línea'" :size="16" aria-hidden="true" />
            <Plus v-else :size="16" aria-hidden="true" />
            {{ actionLabel === 'Ir a línea' ? 'Ir a línea' : 'Seleccionar' }}
          </Button>
        </template>
        <template v-else>
          <Button v-if="actionLabel" class="context-action" @click="emit('action')">{{
            actionLabel
          }}</Button>
          <RouterLink v-if="detailTo" class="full-detail" :to="detailTo"
            ><ArrowUpRight :size="16" aria-hidden="true" />Ver ficha completa</RouterLink
          >
        </template>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.quick-view {
  display: grid;
  grid-template-columns: minmax(20rem, 1.05fr) minmax(0, 1.15fr);
  gap: var(--space-5);
  align-items: start;
}
.quick-view--no-media {
  grid-template-columns: minmax(0, 1fr);
}
.no-media-hero {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: var(--radius-card);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-primary-soft) 75%, var(--color-surface)),
    var(--color-surface)
  );
}
.no-media-hero__icon {
  display: grid;
  width: 3.2rem;
  height: 3.2rem;
  flex: none;
  place-items: center;
  border-radius: 0.9rem;
  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.no-media-hero__copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.no-media-hero__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.no-media-hero__copy strong {
  font-size: 1.05rem;
}
.no-media-hero__copy small {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.card-heading-icon {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  flex: none;
  place-items: center;
  border-radius: 0.55rem;
  border: 1px solid var(--color-border);
}
.card-heading-icon--info {
  color: var(--color-info);
  background: var(--color-info-soft);
  border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
}
.card-heading-icon--success {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
}
.card-heading-icon--warning {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
}
.card-heading-icon--primary {
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.info-card--quote {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}
.quote-inputs-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}
.quote-field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}
.quote-field--full {
  grid-column: 1 / -1;
}
.quote-field span {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.quote-field input {
  width: 100%;
  min-width: 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}
.quote-preview-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft, var(--color-surface-muted));
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}
.quote-preview-discount {
  color: var(--color-success);
}
.quote-error {
  margin: var(--space-2) 0 0;
  color: var(--color-danger);
  font-size: 0.83rem;
  font-weight: 600;
}
.quick-view-icon {
  flex: 0 0 auto;
  margin-top: 0.2rem;
  color: var(--color-primary);
}
.media-panel {
  position: relative;
  min-width: 0;
  display: grid;
  gap: var(--space-3);
}
.media-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.media-panel__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.media-panel__controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.media-ctl-btn {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface-raised);
  cursor: pointer;
}
.media-ctl-btn:hover {
  color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}
.media-viewer-layout {
  display: grid;
  gap: var(--space-3);
  align-items: start;
}
.media-viewer-layout--with-thumbs {
  grid-template-columns: 4.5rem minmax(0, 1fr);
}
.media-frame {
  position: relative;
  display: grid;
  min-height: 24rem;
  max-height: 65vh;
  overflow: hidden;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}
.media-frame :deep(img.gallery-image) {
  width: 100%;
  max-height: 65vh;
  object-fit: contain;
  transition: transform 0.2s ease;
}
.media-frame--zoomed .gallery-image,
.media-frame--zoomed :deep(img) {
  transform: scale(1.35);
  cursor: zoom-out;
}
.image-empty {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--space-4);
}
.image-empty__icon {
  display: grid;
  width: 3.75rem;
  height: 3.75rem;
  place-items: center;
  border-radius: 1rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-primary-accent);
}
.thumbnails {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
}
.thumbnails--vertical {
  flex-direction: column;
  max-height: 24rem;
  overflow-y: auto;
  overflow-x: hidden;
}
.gallery-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.gallery-status--error {
  color: var(--color-danger);
}
.thumbnails button {
  width: 4.5rem;
  height: 4.5rem;
  flex: 0 0 auto;
  padding: 0.2rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  cursor: pointer;
}
.thumbnails button[aria-pressed='true'] {
  outline: 2px solid var(--color-primary);
}
.thumbnails :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.detail-panels {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.info-card {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.info-card h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  font-size: 1rem;
}
.info-card h4 {
  margin: 0 0 var(--space-2);
  font-size: 0.94rem;
}
.section-note {
  margin: calc(var(--space-2) * -1) 0 var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}
.quote-card--summary {
  border-color: var(--color-border);
}
.line-summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.line-summary-meta span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text);
  background: var(--color-surface-muted);
  font-size: 0.8rem;
  font-weight: 600;
}
.line-summary-metrics {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.line-summary-metrics > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.line-summary-metrics dt {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}
.line-summary-metrics dd {
  margin: 0;
  color: var(--color-text);
  font-size: 0.96rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.line-summary-discount--active {
  color: var(--color-success, #22c55e) !important;
}
.line-summary-total {
  grid-column: 1 / -1;
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) !important;
  border: 1px solid var(--color-border-strong) !important;
  border-radius: var(--radius-control);
  background: var(--color-surface-raised) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.line-summary-total dt {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.line-summary-total dd {
  margin: 0;
  font-size: 1.55rem !important;
  font-weight: 800;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.data-summary-dimensions {
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: var(--space-3);
}
.data-summary-dimensions > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.data-summary-dimensions dt {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.data-summary-dimensions dd {
  margin: 0;
  color: var(--color-text);
  font-size: 0.95rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.data-summary .line-summary-description {
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.data-summary .line-summary-description strong {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.data-summary-hint {
  margin: var(--space-3) 0 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  line-height: 1.5;
}
.line-summary-description {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-3) 0 0;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.line-summary-description strong {
  color: var(--color-text);
  font-size: 0.85rem;
}
dl {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}
dl > div {
  display: grid;
  grid-template-columns: minmax(8.5rem, 0.8fr) minmax(0, 1.2fr);
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
dt {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}
dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  font-size: 0.85rem;
}
.status--active {
  color: var(--color-success);
  background: var(--color-success-soft);
}
.status--inactive {
  color: var(--color-text-secondary);
  background: var(--color-background);
}
.viewer-state {
  grid-column: 1 / -1;
  display: grid;
  min-height: 12rem;
  place-content: center;
  justify-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  text-align: center;
}
.viewer-state p {
  margin: 0;
}
.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.catalog-message {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-control);
  color: var(--color-text-secondary);
  background: var(--color-background);
}
.catalog-message--error {
  color: var(--color-danger);
}
.spinner--small {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  border-width: 2px;
}
.retry-link {
  margin-left: auto;
  border: 0;
  color: var(--color-primary);
  background: transparent;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.viewer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  width: 100%;
}
.full-detail {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-info);
  font-weight: 600;
  text-decoration: none;
}
.full-detail:hover {
  text-decoration: underline;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .quick-view {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
  }
  .media-panel {
    position: static;
  }
  .media-frame {
    min-height: 15rem;
    max-height: 36vh;
  }
  .media-frame :deep(img.gallery-image) {
    max-height: 40vh;
  }
  dl > div {
    grid-template-columns: minmax(6rem, 0.7fr) minmax(0, 1.3fr);
  }
  .viewer-footer {
    flex-wrap: wrap;
  }
}
@media (max-width: 420px) {
  .line-summary-metrics {
    grid-template-columns: 1fr;
  }
  dl > div {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }
  .viewer-footer {
    justify-content: stretch;
  }
  .viewer-footer > * {
    flex: 1 1 auto;
    justify-content: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
