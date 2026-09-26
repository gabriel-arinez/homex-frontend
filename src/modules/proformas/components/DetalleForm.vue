<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type {
  DetalleProforma,
  DetalleProformaWritable,
  Producto,
  ValorCatalogoPublico,
} from '@/generated/api'
import ProductoSelector from './ProductoSelector.vue'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import { ApiError } from '@/shared/api'

const props = defineProps<{
  tipos: ValorCatalogoPublico[]
  unidades: ValorCatalogoPublico[]
  moneda: string
  detail?: DetalleProforma
  processing?: boolean
  externalError?: string
}>()
const emit = defineEmits<{ save: [body: DetalleProformaWritable]; cancel: [] }>()
const saving = ref(false),
  error = ref(''),
  fields = ref<Record<string, string[]>>({})
const form = reactive({
  tipo_item: String(props.detail?.tipo_item ?? props.tipos[0]?.id ?? ''),
  producto: String(props.detail?.producto ?? ''),
  nombre: props.detail?.nombre ?? '',
  descripcion: props.detail?.descripcion ?? '',
  cantidad: String(props.detail?.cantidad ?? 1),
  unidad: String(props.detail?.unidad ?? props.unidades[0]?.id ?? ''),
  modo_calculo: props.detail?.modo_calculo ?? 'PRECIO_UNITARIO',
  precio_unitario: props.detail?.precio_unitario ?? '',
  importe_negociado: props.detail?.importe_negociado ?? '',
})
const catalogItem = computed(
  () => props.tipos.find((x) => String(x.id) === form.tipo_item)?.codigo !== 'MUEBLE_MEDIDA',
)
function selectProduct(product: Producto | null) {
  if (product) {
    form.nombre = product.nombre
    if (props.moneda === 'BOB') form.precio_unitario = product.precio_vigente
  }
}
async function submit() {
  if (props.processing) return
  saving.value = true
  error.value = ''
  fields.value = {}
  try {
    const body: DetalleProformaWritable = {
      tipo_item: Number(form.tipo_item),
      producto: catalogItem.value && form.producto ? Number(form.producto) : null,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      cantidad: Number(form.cantidad),
      unidad: Number(form.unidad),
      modo_calculo: form.modo_calculo,
      precio_unitario: form.modo_calculo === 'PRECIO_UNITARIO' ? form.precio_unitario : '0',
      importe_negociado: form.modo_calculo === 'TOTAL_NEGOCIADO' ? form.importe_negociado : null,
      descuento: '0',
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
    /><ProductoSelector
      v-if="catalogItem"
      v-model="form.producto"
      @select="selectProduct"
    /><TextField
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
        min="1"
        step="1"
      /><Select
        v-model="form.unidad"
        name="unidad-linea"
        label="Unidad"
        :options="unidades.map((x) => ({ label: x.nombre, value: String(x.id) }))"
      />
    </div>
    <Select
      v-model="form.modo_calculo"
      name="modo-calculo"
      label="Forma de precio"
      :options="[
        { label: 'Precio por unidad', value: 'PRECIO_UNITARIO' },
        { label: 'Total negociado de la línea', value: 'TOTAL_NEGOCIADO' },
      ]"
    /><TextField
      v-if="form.modo_calculo === 'PRECIO_UNITARIO'"
      v-model="form.precio_unitario"
      name="precio-unitario"
      min="0"
      step="0.01"
      :label="`Precio unitario (${moneda})`"
      type="number"
      hint="El backend calcula cantidad × precio unitario."
    /><TextField
      v-else
      v-model="form.importe_negociado"
      name="importe-negociado"
      min="0"
      step="0.01"
      :label="`Total negociado (${moneda})`"
      type="number"
      hint="Este total exacto es autoritativo; no se recalcula desde un unitario redondeado."
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
