<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowUpRight,
  ImageOff,
  Layers,
  Package,
  RotateCw,
  Sofa,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import type { DetalleProforma, Producto } from '@/generated/api'
import type { GalleryImage } from '@/shared/media/gallery'
import { galleryService } from '@/shared/media/gallery'
import Modal from '@/shared/ui/Modal.vue'
import Button from '@/shared/ui/Button.vue'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'
import { leerDatosTecnicos } from '@/modules/proformas/services/muebleTecnico'

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
  },
)
const emit = defineEmits<{
  close: []
  retry: []
  action: []
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
  if (code === 'SILLA') return Sofa
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
  if (product.silla?.modelo) fields.push({ label: 'Modelo de silla', value: product.silla.modelo })
  if (product.silla?.marca != null)
    fields.push({ label: 'Marca (ID de catálogo)', value: String(product.silla.marca) })
  if (product.silla?.color_primario != null)
    fields.push({
      label: 'Color principal (ID de catálogo)',
      value: String(product.silla.color_primario),
    })
  if (product.silla?.color_secundario != null)
    fields.push({
      label: 'Color secundario (ID de catálogo)',
      value: String(product.silla.color_secundario),
    })
  if (product.silla?.especificaciones)
    fields.push(...flatten(product.silla.especificaciones, 'Especificaciones'))
  if (product.piso?.modelo) fields.push({ label: 'Modelo de piso', value: product.piso.modelo })
  if (product.piso?.marca != null)
    fields.push({ label: 'Marca (ID de catálogo)', value: String(product.piso.marca) })
  if (product.piso?.tipo != null)
    fields.push({ label: 'Tipo (ID de catálogo)', value: String(product.piso.tipo) })
  if (product.piso?.material != null)
    fields.push({ label: 'Material (ID de catálogo)', value: String(product.piso.material) })
  if (product.piso?.diseno != null)
    fields.push({ label: 'Diseño (ID de catálogo)', value: String(product.piso.diseno) })
  if (product.piso?.acabado != null)
    fields.push({ label: 'Acabado (ID de catálogo)', value: String(product.piso.acabado) })
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
    <div class="quick-view" :class="{ 'quick-view--line': line }">
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
        <section class="media-panel" aria-label="Imágenes del producto">
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
              <ImageOff :size="36" aria-hidden="true" />
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
            <button
              v-if="(gallerySource && !galleryFailed) || product?.imagen_principal"
              class="zoom-control"
              type="button"
              :aria-label="zoomed ? 'Reducir imagen' : 'Ampliar imagen'"
              @click="zoomed = !zoomed"
            >
              <ZoomOut v-if="zoomed" :size="18" aria-hidden="true" /><ZoomIn
                v-else
                :size="18"
                aria-hidden="true"
              />
            </button>
          </div>
          <div v-if="galleryLoading" class="gallery-status" role="status">Cargando imágenes…</div>
          <div v-if="galleryError" class="gallery-status gallery-status--error" role="status">
            <span>{{ galleryError }}</span>
            <button type="button" class="retry-link" @click="loadGallery">
              Reintentar imágenes
            </button>
          </div>
          <div
            v-if="galleryImages.length > 1"
            class="thumbnails"
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
        </section>

        <div class="detail-panels">
          <section v-if="product && !line" class="info-card">
            <h3><Package :size="18" aria-hidden="true" />Identificación de catálogo</h3>
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

          <section v-if="product && !line" class="info-card">
            <h3>Información comercial actual</h3>
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
              <div>
                <dt>Existencias</dt>
                <dd>{{ product.stock }} {{ product.unidad_stock_info?.nombre }}</dd>
              </div>
              <div>
                <dt>Demanda pendiente</dt>
                <dd>{{ product.demanda_pendiente }} {{ product.unidad_stock_info?.nombre }}</dd>
              </div>
              <div>
                <dt>Disponibilidad referencial</dt>
                <dd>
                  {{ product.disponibilidad_referencial }} {{ product.unidad_stock_info?.nombre }}
                </dd>
              </div>
            </dl>
          </section>

          <section v-if="line" class="info-card quote-card quote-card--summary">
            <h3>Resumen de la línea</h3>
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
            <h3>Características del producto</h3>
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
        </div>
      </template>
    </div>

    <template #footer>
      <div class="viewer-footer">
        <Button variant="secondary" @click="emit('close')">Cerrar</Button>
        <Button v-if="actionLabel" class="context-action" @click="emit('action')">{{
          actionLabel
        }}</Button>
        <RouterLink v-if="detailTo" class="full-detail" :to="detailTo"
          ><ArrowUpRight :size="16" aria-hidden="true" />Ver ficha completa</RouterLink
        >
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
.quick-view-icon {
  flex: 0 0 auto;
  margin-top: 0.2rem;
  color: var(--color-primary);
}
.media-panel {
  position: relative;
  min-width: 0;
}
.media-frame {
  position: relative;
  display: grid;
  min-height: 22rem;
  max-height: 60vh;
  overflow: hidden;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}
.media-frame :deep(img.gallery-image) {
  width: 100%;
  max-height: 60vh;
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
}
.zoom-control {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text);
  background: var(--color-surface-raised);
  cursor: pointer;
}
.thumbnails {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  overflow-x: auto;
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
