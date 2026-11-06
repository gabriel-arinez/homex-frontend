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
import { leerDatosTecnicos } from '@/modules/proformas/services/muebleTecnico'
import Modal from '@/shared/ui/Modal.vue'
import Button from '@/shared/ui/Button.vue'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'

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
const technical = computed(() => leerDatosTecnicos(props.line?.especificacion?.datos_tecnicos))
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
const generalFields = computed(() => flatten(technical.value.caracteristicas_generales))
const additionalFields = computed(() => {
  const known = new Set([
    'caracteristicas_generales',
    'conjuntos',
    'componentes',
    'accesorios',
    'advertencias',
    'descripcion_original',
  ])
  return Object.entries(technical.value)
    .filter(([key]) => !known.has(key))
    .flatMap(([key, value]) => flatten(value, key))
})
const components = computed(() => technical.value.componentes ?? [])
const sets = computed(() => technical.value.conjuntos ?? [])
const accessories = computed(() => technical.value.accesorios ?? [])
const warnings = computed(() => technical.value.advertencias ?? [])
function componentFields(component: (typeof components.value)[number]) {
  return flatten(component).filter((field) => field.label !== 'Elemento 1')
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
          v-if="productLoading || productError || error"
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
          <section v-if="product" class="info-card">
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

          <section v-if="product" class="info-card">
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

          <section v-if="line" class="info-card quote-card">
            <h3>Valores guardados en la proforma</h3>
            <p class="section-note">
              Importes históricos o negociados de esta línea; se conservan tal como fueron
              cotizados.
            </p>
            <dl>
              <div>
                <dt>Tipo de línea</dt>
                <dd>{{ line.tipo_item_info?.nombre || 'No especificado' }}</dd>
              </div>
              <div v-if="line.producto && product?.sku">
                <dt>SKU</dt>
                <dd>{{ product.sku }}</dd>
              </div>
              <div>
                <dt>Descripción</dt>
                <dd>{{ line.descripcion || 'Sin descripción adicional' }}</dd>
              </div>
              <div>
                <dt>Cantidad</dt>
                <dd>{{ line.cantidad }} {{ line.unidad_info?.nombre }}</dd>
              </div>
              <div v-if="line.modo_calculo !== 'TOTAL_NEGOCIADO'">
                <dt>Precio unitario cotizado:</dt>
                <dd>{{ line.precio_unitario ?? 'No especificado' }}</dd>
              </div>
              <div v-if="line.descuento && Number(line.descuento) !== 0">
                <dt>Descuento</dt>
                <dd>{{ line.descuento }}</dd>
              </div>
              <div v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
                <dt>Importe negociado histórico</dt>
                <dd>{{ line.importe_negociado ?? line.total }}</dd>
              </div>
              <div>
                <dt>
                  Importe {{ line.modo_calculo === 'TOTAL_NEGOCIADO' ? 'histórico' : 'estimado' }}
                </dt>
                <dd>{{ lineAmount() }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="product && productFields(product).length" class="info-card">
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

          <section v-if="line?.especificacion" class="info-card technical-card">
            <h3>
              Ficha técnica
              {{
                line.especificacion.tipo_mueble_info?.nombre
                  ? `· ${line.especificacion.tipo_mueble_info.nombre}`
                  : '· histórica'
              }}
            </h3>
            <p v-if="line.especificacion.observaciones">
              <strong>Observaciones</strong><span>{{ line.especificacion.observaciones }}</span>
            </p>
            <div v-if="generalFields.length" class="technical-section">
              <h4>Características y dimensiones</h4>
              <dl>
                <div v-for="(field, index) in generalFields" :key="`${field.label}-${index}`">
                  <dt>{{ field.label }}</dt>
                  <dd>{{ field.value }}</dd>
                </div>
              </dl>
            </div>
            <div v-if="sets.length" class="technical-section">
              <h4>Conjuntos</h4>
              <ul>
                <li v-for="set in sets" :key="set.uid">{{ set.nombre }}</li>
              </ul>
            </div>
            <div v-if="components.length" class="technical-section">
              <h4>Componentes</h4>
              <article
                v-for="(component, index) in components"
                :key="component.uid ?? index"
                class="component-card"
              >
                <h5>{{ component.nombre || `Componente ${index + 1}` }}</h5>
                <dl>
                  <div
                    v-for="(field, fieldIndex) in componentFields(component)"
                    :key="`${field.label}-${fieldIndex}`"
                  >
                    <dt>{{ field.label }}</dt>
                    <dd>{{ field.value }}</dd>
                  </div>
                </dl>
              </article>
            </div>
            <div v-if="accessories.length" class="technical-section">
              <h4>Accesorios</h4>
              <ul>
                <li v-for="(item, index) in accessories" :key="index">{{ item }}</li>
              </ul>
            </div>
            <div v-if="warnings.length" class="technical-section">
              <h4>Información histórica pendiente</h4>
              <ul>
                <li v-for="(item, index) in warnings" :key="index">{{ item }}</li>
              </ul>
            </div>
            <div v-if="technical.descripcion_original" class="technical-section">
              <h4>Descripción original</h4>
              <p>{{ technical.descripcion_original }}</p>
            </div>
            <div v-if="additionalFields.length" class="technical-section">
              <h4>Otros datos conservados</h4>
              <dl>
                <div v-for="(field, index) in additionalFields" :key="`${field.label}-${index}`">
                  <dt>{{ field.label }}</dt>
                  <dd>{{ field.value }}</dd>
                </div>
              </dl>
            </div>
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
  grid-template-columns: minmax(16rem, 0.88fr) minmax(0, 1.12fr);
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
  min-height: 20rem;
  max-height: 54vh;
  overflow: hidden;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-background);
}
.media-frame :deep(img.gallery-image) {
  width: 100%;
  max-height: 54vh;
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
.technical-card > p {
  display: grid;
  gap: var(--space-1);
  margin: 0 0 var(--space-3);
}
.technical-section {
  margin-top: var(--space-4);
}
.technical-section ul {
  margin: 0;
  padding-left: 1.25rem;
}
.technical-section li + li {
  margin-top: var(--space-1);
}
.component-card {
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.component-card h5 {
  margin: 0 0 var(--space-2);
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
    max-height: 36vh;
  }
  dl > div {
    grid-template-columns: minmax(6rem, 0.7fr) minmax(0, 1.3fr);
  }
  .viewer-footer {
    flex-wrap: wrap;
  }
}
@media (max-width: 420px) {
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
