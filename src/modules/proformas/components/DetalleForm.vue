<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type {
  DetalleProforma,
  DetalleProformaWritable,
  FamiliaProducto,
  Producto,
  ValorCatalogoPublico,
} from '@/generated/api'
import ProductoSelector from './ProductoSelector.vue'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import { ApiError } from '@/shared/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { getActivePinia } from 'pinia'
import { productosService } from '@/modules/productos/services/productosService'

const props = defineProps<{
  tipos: ValorCatalogoPublico[]
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
}>()
const saving = ref(false),
  error = ref(''),
  fields = ref<Record<string, string[]>>({})
const session = getActivePinia() ? useSessionStore() : null
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
if (props.initialDraft) Object.assign(form, props.initialDraft)
const unidadCatalogo = ref<string | null>(null)
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
    if (
      product.id !== props.detail?.producto &&
      (props.existingProductIds ?? []).includes(product.id)
    ) {
      form.producto = ''
      error.value = 'Esta variante ya está incluida. Se enfocará la línea existente.'
      emit('duplicateProduct', product.id)
      return
    }
    form.familia_producto = ''
    unidadCatalogo.value = String(product.unidad_stock)
    form.unidad = String(product.unidad_stock)
    form.nombre = product.nombre
    if (props.moneda === 'BOB') form.precio_unitario = product.precio_vigente
  } else {
    unidadCatalogo.value = null
  }
}
onMounted(async () => {
  if (props.initialProductId) {
    try {
      const product = await productosService.get(props.initialProductId)
      form.producto = String(product.id)
      selectProduct(product)
      // Conservar lo redactado; el producto creado reemplaza solo la variante.
      if (props.initialDraft) {
        for (const campo of [
          'nombre',
          'descripcion',
          'cantidad',
          'precio_unitario',
          'descuento',
        ] as const) {
          if (props.initialDraft[campo] !== undefined) form[campo] = props.initialDraft[campo]
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
  <form class="detail-form" :aria-busy="saving" @submit.prevent="submit">
    <Select
      v-model="form.tipo_item"
      name="tipo-item"
      label="Tipo de línea"
      :options="tipos.map((x) => ({ label: x.nombre, value: String(x.id) }))"
    /><ProductoSelector v-if="catalogItem" v-model="form.producto" @select="selectProduct" /><Button
      v-if="catalogItem && session?.can('comercial.administrar')"
      type="button"
      variant="secondary"
      @click="emit('createProduct', { ...form })"
      >Crear producto sin perder esta proforma</Button
    ><Select
      v-if="catalogItem && !form.producto"
      v-model="form.familia_producto"
      name="familia-producto"
      label="Familia pendiente (opcional)"
      :options="[
        { label: 'Sin familia pendiente', value: '' },
        ...(familias ?? []).map((x) => ({ label: x.nombre, value: String(x.id) })),
      ]"
    />
    <p v-if="catalogItem && form.familia_producto && !form.producto" class="hint">
      La variante física deberá elegirse antes de aprobar; esta selección no reserva stock.
    </p>
    <TextField
      v-model="form.nombre"
      name="nombre-linea"
      label="Nombre comercial"
      :error="fields.nombre?.[0]"
    /><TextField v-model="form.descripcion" name="descripcion-linea" label="Descripción" />
    <div class="two">
      <TextField
        v-model="form.cantidad"
        name="cantidad-linea"
        label="Cantidad"
        type="number"
        :min="quantityMin"
        :step="quantityStep"
      /><Select
        v-model="form.unidad"
        name="unidad-linea"
        label="Unidad"
        :disabled="Boolean(form.producto)"
        :options="unidades.map((x) => ({ label: x.nombre, value: String(x.id) }))"
      />
    </div>
    <TextField
      v-model="form.precio_unitario"
      name="precio-unitario"
      min="0"
      step="0.01"
      :label="`Precio unitario (${moneda})`"
      type="number"
      hint="El backend calcula cantidad × precio unitario."
    /><TextField
      v-model="form.descuento"
      name="descuento-linea"
      min="0"
      step="0.01"
      :label="`Descuento de la línea (${moneda})`"
      type="number"
      hint="Opcional. El backend calcula y protege el subtotal y el total."
    />
    <p v-if="error || externalError" role="alert">{{ error || externalError }}</p>
    <div class="actions">
      <Button type="submit" :processing="saving || processing" processing-label="Guardando…"
        >Guardar línea</Button
      ><Button variant="secondary" :disabled="saving || processing" @click="emit('cancel')"
        >Cancelar</Button
      >
    </div>
  </form>
</template>
<style scoped>
.detail-form {
  display: grid;
  gap: var(--space-4);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.actions {
  display: flex;
  gap: var(--space-3);
}
[role='alert'] {
  color: var(--color-danger);
}
@media (max-width: 35rem) {
  .two,
  .actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
