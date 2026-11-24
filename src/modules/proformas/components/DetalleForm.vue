<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type {
  DetalleProforma,
  DetalleProformaWritable,
  FamiliaProducto,
  Producto,
  ValorCatalogoPublico,
} from '@/generated/api'
import {
  Armchair,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Package,
  Plus,
  Save,
  StickyNote,
  Tag,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import ProductoSelector from './ProductoSelector.vue'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import {
  dineroProducto,
  disponibilidadMeta,
  especificacionesLegiblesProducto,
  estadoStockMeta,
  unidadesProducto,
} from '@/modules/productos/utils/presentacionCatalogo'
import { galleryService, type GalleryImage } from '@/shared/media/gallery'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import Toast from '@/shared/ui/Toast.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import { ApiError } from '@/shared/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { getActivePinia } from 'pinia'
import { productosService } from '@/modules/productos/services/productosService'
import { clonarTecnica, tecnicaIgual } from '../services/muebleTecnico'

const props = defineProps<{
  tipos: ValorCatalogoPublico[]
  categorias?: ValorCatalogoPublico[]
  unidades: ValorCatalogoPublico[]
  familias?: FamiliaProducto[]
  moneda: string
  detail?: DetalleProforma
  processing?: boolean
  externalError?: string
  existingProductIds?: number[]
  initialProductId?: number | null
  initialDraft?: Record<string, string>
}>()
const emit = defineEmits<{
  save: [body: DetalleProformaWritable]
  cancel: []
  duplicateProduct: [productId: number]
  createProduct: [draft: Record<string, string>]
  changed: []
}>()
const saving = ref(false),
  error = ref(''),
  fields = ref<Record<string, string[]>>({})
const session = getActivePinia() ? useSessionStore() : null
const errorToast = ref('')
watch(error, (message) => {
  if (message) errorToast.value = message
})
const form = reactive({
  tipo_item: String(props.detail?.tipo_item ?? props.tipos[0]?.id ?? ''),
  producto: String(props.detail?.producto ?? ''),
  familia_producto: String(props.detail?.familia_producto ?? ''),
  nombre: props.detail?.nombre ?? '',
  descripcion: props.detail?.descripcion ?? '',
  cantidad: String(props.detail?.cantidad ?? 1),
  unidad: String(props.detail?.unidad ?? props.unidades[0]?.id ?? ''),
  modo_calculo: props.detail?.modo_calculo ?? 'PRECIO_UNITARIO',
  precio_unitario: props.detail?.precio_unitario ?? '',
  descuento: props.detail?.descuento ?? '0.00',
})
const initialContent = clonarTecnica(form)
if (props.initialDraft) Object.assign(form, props.initialDraft)
const hasRealChanges = computed(() => !tecnicaIgual(form, initialContent))
defineExpose({ hasRealChanges })
const unidadCatalogo = ref<string | null>(null)
const master = ref<Producto | null>(null)

// Galería del producto seleccionado en el modal
const masterGallery = ref<GalleryImage[]>([])
const masterGalleryLoading = ref(false)
const activeGalleryIndex = ref(0)
const zoomed = ref(false)
let galleryReqId = 0

async function loadMasterGallery(productId: number | null | undefined) {
  const req = ++galleryReqId
  masterGallery.value = []
  activeGalleryIndex.value = 0
  zoomed.value = false
  if (!productId) return
  masterGalleryLoading.value = true
  try {
    const res = await galleryService.list(`/api/v1/catalogo/productos/${productId}/imagenes/`)
    if (req !== galleryReqId) return
    masterGallery.value = res.imagenes ?? []
  } catch {
    if (req === galleryReqId) masterGallery.value = []
  } finally {
    if (req === galleryReqId) masterGalleryLoading.value = false
  }
}

watch(
  () => master.value?.id,
  (id) => {
    void loadMasterGallery(id)
  },
)

const activeGalleryImage = computed(
  () => masterGallery.value[activeGalleryIndex.value] ?? masterGallery.value[0] ?? null,
)
function stepGallery(delta: number) {
  const len = masterGallery.value.length
  if (len <= 1) return
  activeGalleryIndex.value = (activeGalleryIndex.value + delta + len) % len
}

const masterIcon = computed(() => {
  const code = master.value?.categoria_info?.codigo
  if (code === 'SILLA') return Armchair
  if (code === 'PISO_FLOTANTE') return Layers
  return Package
})

const masterSpecs = computed(() =>
  master.value ? especificacionesLegiblesProducto(master.value) : [],
)

const liveLineTotal = computed(() => {
  const qty = Number(form.cantidad)
  const unit = Number(form.precio_unitario)
  const disc = Number(form.descuento || 0)
  if (!Number.isFinite(qty) || !Number.isFinite(unit) || qty <= 0 || unit <= 0) return null
  const gross = qty * unit
  const net = Math.max(0, gross - (Number.isFinite(disc) && disc > 0 ? disc : 0))
  return { gross, disc: Number.isFinite(disc) && disc > 0 ? disc : 0, net }
})

function formatCurrency(val: number): string {
  try {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: props.moneda === 'USD' ? 'USD' : 'BOB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)
  } catch {
    return `${props.moneda} ${val.toFixed(2)}`
  }
}

const categoriaId = computed(() => {
  const tipo = props.tipos.find((item) => String(item.id) === form.tipo_item)?.codigo
  return props.categorias?.find((item) => item.codigo === tipo)?.id
})
const catalogItem = computed(
  () => props.tipos.find((x) => String(x.id) === form.tipo_item)?.codigo !== 'MUEBLE_MEDIDA',
)
const selectedUnit = computed(
  () => props.unidades.find((x) => String(x.id) === form.unidad)?.codigo,
)
const quantityStep = computed(() => (selectedUnit.value === 'M2' ? '0.0001' : '1'))
const quantityMin = computed(() => (selectedUnit.value === 'M2' ? '0.0001' : '1'))
function selectProduct(product: Producto | null) {
  if (product) {
    const currentFamily = props.detail?.familia_producto
    const currentType = props.tipos.find((item) => String(item.id) === form.tipo_item)?.codigo
    if (
      props.detail &&
      !props.detail.producto &&
      currentFamily &&
      (product.familia !== currentFamily ||
        product.categoria_info?.codigo !== currentType ||
        String(product.unidad_stock) !== form.unidad)
    ) {
      error.value = 'La variante debe pertenecer a la misma familia, categoría y unidad.'
      form.producto = ''
      return
    }
    if (
      product.id !== props.detail?.producto &&
      (props.existingProductIds ?? []).includes(product.id)
    ) {
      form.producto = ''
      error.value = 'Esta variante ya está incluida. Se enfocará la línea existente.'
      emit('duplicateProduct', product.id)
      return
    }
    master.value = product
    // Al resolver una familia pendiente, no sustituir importes ya negociados.
    form.familia_producto = product.familia ? String(product.familia) : ''
    unidadCatalogo.value = String(product.unidad_stock)
    form.unidad = String(product.unidad_stock)
    if (!props.detail) {
      const tipo = props.tipos.find((item) => item.codigo === product.categoria_info?.codigo)
      if (tipo) form.tipo_item = String(tipo.id)
      form.nombre = product.nombre
      if (props.moneda === 'BOB') form.precio_unitario = product.precio_vigente
    }
  } else {
    master.value = null
    unidadCatalogo.value = null
  }
}
onMounted(async () => {
  const initialId = props.initialProductId ?? props.detail?.producto
  if (initialId) {
    try {
      const product = await productosService.get(initialId)
      if (props.initialProductId) form.producto = String(product.id)
      if (props.initialProductId) selectProduct(product)
      else {
        master.value = product
        unidadCatalogo.value = String(product.unidad_stock)
      }
      // Conservar lo redactado; el producto creado reemplaza solo la variante.
      if (props.initialDraft) {
        for (const campo of [
          'nombre',
          'descripcion',
          'cantidad',
          'precio_unitario',
          'descuento',
        ] as const) {
          const valor = props.initialDraft[campo]
          if (valor !== undefined) form[campo] = valor
        }
      }
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : 'No se pudo seleccionar el producto creado.'
    }
  }
})
async function submit() {
  if (props.processing) return
  saving.value = true
  error.value = ''
  fields.value = {}
  try {
    if (catalogItem.value && form.producto && unidadCatalogo.value) {
      form.unidad = unidadCatalogo.value
    }
    const cantidad = Number(form.cantidad)
    const precio = Number(form.precio_unitario)
    const descuento = form.descuento === '' ? 0 : Number(form.descuento)
    if (!form.nombre.trim()) fields.value.nombre = ['Escribe un nombre comercial.']
    if (!form.cantidad || !Number.isFinite(cantidad) || cantidad <= 0) {
      fields.value.cantidad = ['La cantidad debe ser mayor que cero.']
    } else if (selectedUnit.value !== 'M2' && !Number.isInteger(cantidad)) {
      fields.value.cantidad = ['Esta unidad requiere una cantidad entera.']
    }
    if (!form.precio_unitario || !Number.isFinite(precio) || precio <= 0) {
      fields.value.precio_unitario = ['El precio unitario debe ser mayor que cero.']
    }
    if (!Number.isFinite(descuento) || descuento < 0) {
      fields.value.descuento = ['El descuento no puede ser negativo.']
    } else if (
      Number.isFinite(cantidad) &&
      Number.isFinite(precio) &&
      descuento > cantidad * precio
    ) {
      fields.value.descuento = ['El descuento no puede superar el importe de la línea.']
    }
    if (Object.keys(fields.value).length) {
      error.value = 'Revisa los campos indicados antes de agregar la línea.'
      return
    }
    const body: DetalleProformaWritable = {
      tipo_item: Number(form.tipo_item),
      producto: catalogItem.value && form.producto ? Number(form.producto) : null,
      familia_producto:
        catalogItem.value && !form.producto && form.familia_producto
          ? Number(form.familia_producto)
          : null,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      cantidad: form.cantidad,
      unidad: Number(form.unidad),
      modo_calculo: 'PRECIO_UNITARIO',
      precio_unitario: form.precio_unitario,
      importe_negociado: null,
      descuento: form.descuento || '0.00',
    }
    emit('save', body)
  } catch (e) {
    if (e instanceof ApiError) fields.value = e.fields
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <form
    class="detail-form"
    :aria-busy="saving"
    novalidate
    @input="emit('changed')"
    @change="emit('changed')"
    @submit.prevent="submit"
  >
    <Toast
      :visible="Boolean(errorToast)"
      :message="errorToast"
      tone="danger"
      @close="errorToast = ''"
    />

    <!-- Cabecera de selección de tipo y producto -->
    <section class="selector-panel">
      <div class="selector-top-row">
        <Select
          v-model="form.tipo_item"
          name="tipo-item"
          label="Tipo de línea"
          :disabled="Boolean(form.producto)"
          :options="tipos.map((x) => ({ label: x.nombre, value: String(x.id) }))"
        />
        <Button
          v-if="
            catalogItem &&
            (session?.can('catalogo.crear_producto') || session?.can('comercial.administrar'))
          "
          type="button"
          variant="secondary"
          class="create-product-inline"
          @click="emit('createProduct', { ...form })"
        >
          <Plus :size="16" aria-hidden="true" />
          Crear producto sin perder esta proforma
        </Button>
      </div>

      <ProductoSelector
        v-if="catalogItem && !initialProductId && !detail?.producto"
        v-model="form.producto"
        :categoria="categoriaId"
        :familia="form.familia_producto ? Number(form.familia_producto) : undefined"
        @select="selectProduct"
      />

      <Select
        v-if="catalogItem && !form.producto"
        v-model="form.familia_producto"
        name="familia-producto"
        label="Familia pendiente (opcional)"
        :options="[
          { label: 'Sin familia pendiente', value: '' },
          ...(familias ?? []).map((x) => ({ label: x.nombre, value: String(x.id) })),
        ]"
      />
      <p v-if="catalogItem && form.familia_producto && !form.producto" class="hint-banner">
        La variante física deberá elegirse antes de aprobar; esta selección no reserva stock.
      </p>
    </section>

    <!-- Espacio de trabajo: Ficha completa izquierda + Cotización derecha (cuando hay producto maestro) -->
    <div :class="{ 'detail-workspace': catalogItem && master }">
      <aside
        v-if="catalogItem && master"
        class="master-sheet"
        aria-label="Ficha completa del producto seleccionado"
      >
        <header class="master-sheet__header">
          <div class="master-sheet__identity">
            <span class="master-sheet__icon" aria-hidden="true">
              <component :is="masterIcon" :size="20" />
            </span>
            <div>
              <div class="master-sheet__badges">
                <Badge tone="neutral">{{ master.categoria_info?.nombre || 'Catálogo' }}</Badge>
                <Badge v-if="master.familia_info" tone="neutral">{{
                  master.familia_info.nombre
                }}</Badge>
                <Badge v-if="master.promocion?.vigente" tone="info">Promoción vigente</Badge>
              </div>
              <h3>{{ master.nombre }}</h3>
              <small class="master-sheet__sku">
                <Tag :size="12" aria-hidden="true" /> {{ master.sku || 'Sin SKU' }} · Unidad:
                {{ master.unidad_stock_info?.nombre || '—' }}
              </small>
            </div>
          </div>
        </header>

        <!-- Visor de galería con controles arriba y miniaturas laterales (solo si tiene imágenes) -->
        <div
          v-if="masterGallery.length > 0 || master.imagen_principal || masterGalleryLoading"
          class="master-gallery"
        >
          <div class="master-gallery__bar">
            <span>
              {{
                masterGallery.length > 1
                  ? `Galería (${activeGalleryIndex + 1}/${masterGallery.length})`
                  : 'Imagen del producto'
              }}
            </span>
            <div class="master-gallery__controls">
              <button
                v-if="masterGallery.length > 1"
                type="button"
                class="gallery-ctl-btn"
                aria-label="Imagen anterior"
                @click="stepGallery(-1)"
              >
                <ChevronLeft :size="15" aria-hidden="true" />
              </button>
              <button
                v-if="masterGallery.length > 1"
                type="button"
                class="gallery-ctl-btn"
                aria-label="Imagen siguiente"
                @click="stepGallery(1)"
              >
                <ChevronRight :size="15" aria-hidden="true" />
              </button>
              <button
                v-if="activeGalleryImage || master.imagen_principal"
                type="button"
                class="gallery-ctl-btn"
                :aria-label="zoomed ? 'Reducir imagen' : 'Ampliar imagen'"
                @click="zoomed = !zoomed"
              >
                <ZoomOut v-if="zoomed" :size="15" aria-hidden="true" />
                <ZoomIn v-else :size="15" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            class="master-gallery__body"
            :class="{ 'master-gallery__body--with-thumbs': masterGallery.length > 1 }"
          >
            <div
              v-if="masterGallery.length > 1"
              class="master-gallery__thumbs"
              aria-label="Miniaturas"
            >
              <button
                v-for="(img, idx) in masterGallery"
                :key="img.id"
                type="button"
                :aria-pressed="activeGalleryIndex === idx"
                :aria-label="`Ver imagen ${idx + 1}`"
                @click="activeGalleryIndex = idx"
              >
                <GalleryPhoto :src="img.url" :alt="img.nombre" />
              </button>
            </div>
            <div class="master-gallery__stage" :class="{ 'master-gallery__stage--zoomed': zoomed }">
              <GalleryPhoto
                v-if="activeGalleryImage"
                :src="activeGalleryImage.url"
                :alt="activeGalleryImage.nombre || master.nombre"
              />
              <ProductImage
                v-else
                :image="master.imagen_principal"
                :alt="master.nombre"
                :category-code="master.categoria_info?.codigo"
              />
            </div>
          </div>
          <p v-if="masterGalleryLoading" class="gallery-loading-note">Cargando galería…</p>
        </div>

        <!-- KPIs comerciales limpios -->
        <div class="master-kpis">
          <div class="master-kpi">
            <span>Precio referencia</span>
            <strong>{{ dineroProducto(master.precio_vigente) }}</strong>
          </div>
          <template v-if="master.modalidad_abastecimiento === 'BAJO_PEDIDO'">
            <div class="master-kpi">
              <span>Abastecimiento</span>
              <strong>Disponible bajo pedido</strong>
              <Badge tone="info">Disponible bajo pedido</Badge>
            </div>
          </template>
          <template v-else>
            <div class="master-kpi">
              <span>Stock actual</span>
              <strong>{{ unidadesProducto(master, master.stock) }}</strong>
              <Badge
                v-if="
                  estadoStockMeta(master.estado_stock).showBadge && master.estado_stock !== 'NORMAL'
                "
                :tone="estadoStockMeta(master.estado_stock).tone"
              >
                {{ estadoStockMeta(master.estado_stock).label }}
              </Badge>
            </div>
            <div class="master-kpi">
              <span>Disponibilidad ref.</span>
              <strong>{{ unidadesProducto(master, master.disponibilidad_referencial) }}</strong>
              <Badge :tone="disponibilidadMeta(master.disponibilidad_referencial).tone">
                {{ disponibilidadMeta(master.disponibilidad_referencial).label }}
              </Badge>
            </div>
          </template>
        </div>

        <!-- Especificaciones técnicas legibles (sin JSON crudo) -->
        <div v-if="masterSpecs.length" class="master-specs">
          <div class="master-specs__title">
            <Boxes :size="15" aria-hidden="true" />
            <span>Especificaciones del producto</span>
          </div>
          <dl class="master-specs__grid">
            <div v-for="(spec, idx) in masterSpecs" :key="`${spec.label}-${idx}`">
              <dt>{{ spec.label }}</dt>
              <dd>{{ spec.value }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="master.observaciones" class="master-notes">
          <span class="master-notes__title">
            <StickyNote :size="14" aria-hidden="true" /> Observaciones de catálogo
          </span>
          <p>{{ master.observaciones }}</p>
        </div>

        <p class="master-sheet__footnote">
          Datos de solo lectura del catálogo. El precio unitario de la proforma se negocia aparte.
        </p>
      </aside>

      <!-- Panel de cotización -->
      <div class="quote-line-panel">
        <div class="quote-line-panel__heading">
          <FileText :size="17" aria-hidden="true" />
          <div>
            <h4>Condiciones de cotización</h4>
            <p>Ajusta nombre comercial, cantidad y precio unitario para esta proforma.</p>
          </div>
        </div>

        <TextField
          v-model="form.nombre"
          name="nombre-linea"
          label="Nombre comercial"
          :error="fields.nombre?.[0]"
        />
        <TextField v-model="form.descripcion" name="descripcion-linea" label="Descripción" />

        <div class="two">
          <TextField
            v-model="form.cantidad"
            name="cantidad-linea"
            label="Cantidad"
            type="number"
            :min="quantityMin"
            :step="quantityStep"
            :error="fields.cantidad?.[0]"
          />
          <Select
            v-model="form.unidad"
            name="unidad-linea"
            label="Unidad"
            :disabled="Boolean(form.producto)"
            :options="unidades.map((x) => ({ label: x.nombre, value: String(x.id) }))"
          />
        </div>

        <div class="two">
          <TextField
            v-model="form.precio_unitario"
            name="precio-unitario"
            min="0.01"
            step="0.01"
            :label="`Precio unitario (${moneda})`"
            type="number"
            hint="Mayor que cero."
            :error="fields.precio_unitario?.[0]"
          />
          <TextField
            v-model="form.descuento"
            name="descuento-linea"
            min="0"
            step="0.01"
            :label="`Descuento de la línea (${moneda})`"
            type="number"
            hint="Opcional; cero es válido."
            :error="fields.descuento?.[0]"
          />
        </div>

        <div
          v-if="liveLineTotal"
          class="live-total-card"
          aria-label="Resumen calculado de la línea"
        >
          <div class="live-total-row">
            <span>Subtotal bruto</span>
            <span>{{ formatCurrency(liveLineTotal.gross) }}</span>
          </div>
          <div v-if="liveLineTotal.disc > 0" class="live-total-row live-total-row--discount">
            <span>Descuento</span>
            <span>−{{ formatCurrency(liveLineTotal.disc) }}</span>
          </div>
          <div class="live-total-row live-total-row--final">
            <strong>Total estimado</strong>
            <strong>{{ formatCurrency(liveLineTotal.net) }}</strong>
          </div>
        </div>

        <p v-if="error || externalError" class="form-alert" role="alert">
          {{ error || externalError }}
        </p>

        <div class="actions">
          <Button
            variant="success"
            type="submit"
            :processing="saving || processing"
            processing-label="Guardando…"
          >
            <Save :size="17" aria-hidden="true" />
            Guardar línea
          </Button>
          <Button variant="secondary" :disabled="saving || processing" @click="emit('cancel')">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  </form>
</template>
<style scoped>
.detail-form {
  display: grid;
  gap: var(--space-4);
}
.selector-panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-soft, var(--color-surface));
}
.selector-top-row {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) auto;
  gap: var(--space-3);
  align-items: end;
}
.create-product-inline {
  white-space: nowrap;
}
.hint-banner {
  margin: 0;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.detail-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.95fr);
  gap: var(--space-5);
  align-items: start;
}
.master-sheet {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.master-sheet__identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.master-sheet__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.master-sheet__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.3rem;
}
.master-sheet__identity h3 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.35;
}
.master-sheet__sku {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.2rem;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.master-gallery {
  display: grid;
  gap: 0.55rem;
}
.master-gallery__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.master-gallery__controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.gallery-ctl-btn {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
}
.gallery-ctl-btn:hover {
  color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}
.master-gallery__body {
  display: grid;
  gap: 0.65rem;
  align-items: start;
}
.master-gallery__body--with-thumbs {
  grid-template-columns: 3.75rem minmax(0, 1fr);
}
.master-gallery__thumbs {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 15rem;
  overflow-y: auto;
}
.master-gallery__thumbs button {
  width: 3.5rem;
  height: 3.5rem;
  padding: 0.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  cursor: pointer;
  flex: none;
}
.master-gallery__thumbs button[aria-pressed='true'] {
  outline: 2px solid var(--color-primary);
}
.master-gallery__thumbs :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.master-gallery__stage {
  display: grid;
  place-items: center;
  min-height: 12rem;
  max-height: 17rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-background);
}
.master-gallery__stage :deep(.product-image) {
  width: 100%;
  min-height: 12rem;
  max-height: 17rem;
  border-radius: 0;
}
.master-gallery__stage :deep(img) {
  width: 100%;
  max-height: 17rem;
  object-fit: contain;
  transition: transform 0.2s ease;
}
.master-gallery__stage--zoomed :deep(img) {
  transform: scale(1.35);
}
.gallery-loading-note {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}
.master-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}
.master-kpi {
  display: grid;
  gap: 0.2rem;
  align-content: start;
  justify-items: start;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft, var(--color-surface-muted));
}
.master-kpi span {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}
.master-kpi strong {
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}
.master-specs {
  display: grid;
  gap: 0.55rem;
}
.master-specs__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
}
.master-specs__title svg {
  color: var(--color-primary-accent);
}
.master-specs__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}
.master-specs__grid > div {
  display: grid;
  gap: 0.12rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  min-width: 0;
}
.master-specs__grid dt {
  font-size: 0.71rem;
  color: var(--color-text-secondary);
}
.master-specs__grid dd {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.master-notes {
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.master-notes__title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.master-notes p {
  margin: 0.25rem 0 0;
  font-size: 0.83rem;
}
.master-sheet__footnote {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}
.quote-line-panel {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.quote-line-panel__heading {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.quote-line-panel__heading svg {
  flex: none;
  margin-top: 0.15rem;
  color: var(--color-primary-accent);
}
.quote-line-panel__heading h4 {
  margin: 0;
  font-size: 0.98rem;
}
.quote-line-panel__heading p {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.live-total-card {
  display: grid;
  gap: 0.45rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft, var(--color-surface-muted));
}
.live-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.84rem;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.live-total-row--discount {
  color: var(--color-success, #16a34a);
}
.live-total-row--final {
  padding-top: 0.45rem;
  border-top: 1px solid var(--color-border);
  font-size: 1rem;
  color: var(--color-text);
}
.actions {
  display: flex;
  gap: var(--space-3);
}
.form-alert {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.85rem;
}
@media (max-width: 62rem) {
  .detail-workspace {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 44rem) {
  .selector-top-row {
    grid-template-columns: 1fr;
  }
  .master-kpis,
  .master-specs__grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 35rem) {
  .two,
  .actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
