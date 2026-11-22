<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Check,
  FileText,
  Hash,
  Package,
  PackageCheck,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
  X,
} from '@lucide/vue'
import type { CatalogoMotivosAjuste, MovimientoStock, Producto } from '@/generated/api'
import { movimientosStockService } from '@/modules/movimientos-stock/services/movimientosStockService'
import { ApiError } from '@/shared/api'
import Button from '@/shared/ui/Button.vue'
import Modal from '@/shared/ui/Modal.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import TextAreaField from '@/shared/ui/TextAreaField.vue'
import TextField from '@/shared/ui/TextField.vue'
import { generateUuidV4 } from '@/shared/utils/uuid'
import { productosService } from '../services/productosService'
import { unidadesProducto } from '../utils/presentacionCatalogo'

const props = withDefaults(
  defineProps<{
    open: boolean
    initialProduct?: Producto | null
    initialType?: 'ENTRADA' | 'SALIDA'
    lockProduct?: boolean
  }>(),
  {
    initialProduct: null,
    initialType: 'ENTRADA',
    lockProduct: false,
  },
)

const emit = defineEmits<{
  close: []
  saved: [movimiento: MovimientoStock, tipo: 'ENTRADA' | 'SALIDA']
}>()

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
const ajusteSelectedCache = ref<Producto | null>(null)

const ajusteProductoSeleccionado = computed(() => {
  if (
    ajusteSelectedCache.value &&
    String(ajusteSelectedCache.value.id) === ajusteProductoId.value
  ) {
    return ajusteSelectedCache.value
  }
  return (
    ajusteProductos.value.find((p) => String(p.id) === ajusteProductoId.value) ??
    (props.initialProduct && String(props.initialProduct.id) === ajusteProductoId.value
      ? props.initialProduct
      : null)
  )
})

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

watch(
  () => [props.open, props.initialProduct?.id, props.initialType] as const,
  async ([isOpen]) => {
    if (!isOpen) return
    ajusteTipo.value = props.initialType
    ajusteCantidad.value = ''
    ajusteObservaciones.value = ''
    ajusteError.value = ''
    ajusteIdempotencyKey.value = generateUuidV4()
    ajusteProductoSearch.value = ''
    ajusteProductos.value = []
    ajusteSelectedCache.value = props.initialProduct ?? null
    ajusteProductoId.value = props.initialProduct ? String(props.initialProduct.id) : ''

    if (!motivosCatalogo.value) {
      try {
        motivosCatalogo.value = await movimientosStockService.motivosAjuste()
      } catch {
        motivosCatalogo.value = null
      }
    }
    ajusteMotivo.value = motivosDisponibles.value[0]?.codigo ?? ''
  },
  { immediate: true },
)

function selectAjusteProducto(item: Producto) {
  ajusteSelectedCache.value = item
  ajusteProductoId.value = String(item.id)
  ajusteProductoSearch.value = ''
  ajusteProductos.value = []
}

function clearAjusteProducto() {
  if (props.lockProduct) return
  ajusteSelectedCache.value = null
  ajusteProductoId.value = ''
  ajusteProductoSearch.value = ''
  ajusteProductos.value = []
}

async function loadAjusteProductos(term = '') {
  const clean = term.trim()
  if (!clean) {
    ajusteProductos.value = []
    ajusteProductosLoading.value = false
    return
  }
  ajusteProductosLoading.value = true
  try {
    const res = await productosService.list({
      search: clean,
      page_size: 25,
    })
    ajusteProductos.value = res.results
  } catch {
    ajusteProductos.value = []
  } finally {
    ajusteProductosLoading.value = false
  }
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
    const movimiento = await movimientosStockService.registrarAjuste(
      {
        producto: prodId,
        tipo_operacion: ajusteTipo.value,
        cantidad: ajusteCantidad.value.trim(),
        motivo: ajusteMotivo.value as never,
        observaciones: ajusteObservaciones.value.trim(),
      },
      ajusteIdempotencyKey.value,
    )
    emit('saved', movimiento, ajusteTipo.value)
    emit('close')
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
</script>

<template>
  <Modal
    :open="open"
    wide
    title="Registrar movimiento de inventario"
    description="Registra una entrada o salida manual de tipo Ajuste. Esta operación quedará registrada permanentemente y no podrá editarse ni eliminarse."
    @close="emit('close')"
  >
    <template #title-icon>
      <span class="ajuste-modal-icon">
        <Boxes :size="20" aria-hidden="true" />
      </span>
    </template>

    <div
      v-if="ajusteProductoSeleccionado"
      class="ajuste-board"
      aria-label="Resumen del movimiento de stock"
    >
      <div class="ajuste-metric ajuste-metric--highlight">
        <span class="ajuste-metric__icon">
          <Boxes :size="16" aria-hidden="true" />
        </span>
        <div>
          <span>Stock actual</span>
          <strong>{{
            unidadesProducto(ajusteProductoSeleccionado, ajusteProductoSeleccionado.stock)
          }}</strong>
        </div>
      </div>
      <div class="ajuste-metric ajuste-metric--highlight">
        <span
          class="ajuste-metric__icon"
          :class="
            ajusteTipo === 'ENTRADA'
              ? 'ajuste-metric__icon--success'
              : 'ajuste-metric__icon--danger'
          "
        >
          <TrendingUp :size="16" aria-hidden="true" />
        </span>
        <div>
          <span>Variación</span>
          <strong :class="ajusteTipo === 'ENTRADA' ? 'variation-qty--in' : 'variation-qty--out'">
            {{ ajusteTipo === 'ENTRADA' ? '+' : '-' }}{{ ajusteCantidad || '0' }}
          </strong>
        </div>
      </div>
      <div class="ajuste-metric ajuste-metric--highlight">
        <span
          class="ajuste-metric__icon"
          :class="
            stockResultanteEstimado !== null && stockResultanteEstimado < 0
              ? 'ajuste-metric__icon--danger'
              : 'ajuste-metric__icon--primary'
          "
        >
          <PackageCheck :size="16" aria-hidden="true" />
        </span>
        <div>
          <span>Stock resultante</span>
          <strong>
            {{
              stockResultanteEstimado !== null
                ? unidadesProducto(ajusteProductoSeleccionado, stockResultanteEstimado)
                : '—'
            }}
          </strong>
        </div>
      </div>
    </div>

    <form id="ajuste-stock-form" class="ajuste-form" @submit.prevent="submitAjuste">
      <div class="ajuste-section ajuste-form__full">
        <div class="ajuste-section__header">
          <SlidersHorizontal :size="15" aria-hidden="true" />
          <span>Operación y producto</span>
        </div>
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

        <div v-if="ajusteProductoSeleccionado" class="ajuste-selected-card">
          <div class="ajuste-selected-card__info">
            <PackageCheck :size="18" class="ajuste-selected-card__icon" aria-hidden="true" />
            <div>
              <strong>{{ ajusteProductoSeleccionado.nombre }}</strong>
              <small>
                SKU: {{ ajusteProductoSeleccionado.sku || `#${ajusteProductoSeleccionado.id}` }} ·
                Stock actual:
                {{ unidadesProducto(ajusteProductoSeleccionado, ajusteProductoSeleccionado.stock) }}
              </small>
            </div>
          </div>
          <Button
            v-if="!lockProduct"
            type="button"
            variant="secondary"
            @click="clearAjusteProducto"
          >
            <RotateCcw :size="14" aria-hidden="true" />
            Cambiar producto
          </Button>
        </div>
        <div v-else class="ajuste-product-picker">
          <SearchField
            v-model="ajusteProductoSearch"
            label="Buscar producto por nombre o SKU"
            @update:model-value="loadAjusteProductos"
          />
          <div
            v-if="ajusteProductoSearch.trim().length > 0"
            class="ajuste-product-results"
            role="listbox"
            aria-label="Resultados de productos"
          >
            <p v-if="ajusteProductosLoading" class="ajuste-product-results__state">
              Buscando productos...
            </p>
            <p v-else-if="!ajusteProductos.length" class="ajuste-product-results__state">
              No se encontraron productos para esa búsqueda.
            </p>
            <button
              v-for="item in ajusteProductos"
              :key="item.id"
              type="button"
              role="option"
              class="ajuste-product-option"
              :aria-selected="String(item.id) === ajusteProductoId"
              @click="selectAjusteProducto(item)"
            >
              <Package :size="16" class="ajuste-product-option__icon" aria-hidden="true" />
              <div class="ajuste-product-option__body">
                <strong>{{ item.nombre }}</strong>
                <small>
                  {{ item.sku || `#${item.id}` }} ·
                  {{ item.unidad_stock_info?.nombre || 'Unidad' }}
                </small>
              </div>
              <span class="ajuste-product-option__stock">
                Stock: {{ unidadesProducto(item, item.stock) }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="ajuste-section ajuste-form__full">
        <div class="ajuste-section__header">
          <FileText :size="15" aria-hidden="true" />
          <span>Detalle del ajuste</span>
        </div>
        <div class="ajuste-section__grid">
          <div class="ajuste-field-wrap">
            <div class="ajuste-field-badge">
              <Hash :size="13" aria-hidden="true" />
              <span>{{ ajusteProductoSeleccionado?.unidad_stock_info?.nombre || 'Unidades' }}</span>
            </div>
            <TextField
              v-model="ajusteCantidad"
              name="ajuste-cantidad"
              label="Cantidad"
              type="number"
              :step="
                ajusteProductoSeleccionado?.unidad_stock_info?.codigo === 'M2' ? '0.0001' : '1'
              "
              min="0"
              placeholder="0"
            />
          </div>

          <div class="ajuste-field-wrap">
            <div class="ajuste-field-badge">
              <SlidersHorizontal :size="13" aria-hidden="true" />
              <span>{{ ajusteTipo === 'ENTRADA' ? 'Ingreso manual' : 'Egreso manual' }}</span>
            </div>
            <Select
              v-model="ajusteMotivo"
              name="ajuste-motivo"
              label="Motivo"
              :options="motivosDisponibles.map((m) => ({ label: m.nombre, value: m.codigo }))"
            />
          </div>

          <div class="ajuste-form__full">
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
          </div>
        </div>
      </div>

      <p v-if="ajusteError" class="stock-alert ajuste-form__full" role="alert">
        {{ ajusteError }}
      </p>
    </form>

    <template #footer>
      <Button variant="secondary" :disabled="ajusteSaving" @click="emit('close')">
        <X :size="16" aria-hidden="true" />
        Cancelar
      </Button>
      <Button type="submit" form="ajuste-stock-form" :disabled="ajusteSaving">
        <Check :size="16" aria-hidden="true" />
        {{ ajusteSaving ? 'Registrando...' : 'Confirmar movimiento' }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.stock-alert {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  border-radius: var(--radius-control);
  background: var(--color-danger-soft);
  color: var(--color-danger-text, var(--color-danger));
  font-size: 0.85rem;
}
.variation-qty--in {
  color: var(--color-success, #16a34a);
}
.variation-qty--out {
  color: var(--color-danger, #dc2626);
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
