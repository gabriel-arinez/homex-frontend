<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import type {
  DescuentoProducto,
  PatchedProductoWritable,
  Producto,
  ProductoPiso,
  ProductoSilla,
} from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import ProductImage from '../components/ProductImage.vue'
import { activeDiscount, presentation, productosService } from '../services/productosService'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import TextField from '@/shared/ui/TextField.vue'
const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute(),
  session = useSessionStore()
const product = ref<Producto | null>(null),
  chairs = ref<ProductoSilla[]>([]),
  floors = ref<ProductoPiso[]>([]),
  discounts = ref<DescuentoProducto[]>([]),
  loading = ref(true),
  error = ref(''),
  editing = ref(false),
  saving = ref(false),
  success = ref(''),
  fields = ref<Record<string, string[]>>({})
const form = reactive({ sku: '', nombre: '', precio_lista: '', observaciones: '', activo: true })
const canEdit = computed(() => session.can('comercial.administrar'))
const info = computed(() =>
  product.value ? presentation(product.value.id, chairs.value, floors.value) : null,
)
const discount = computed(() =>
  product.value ? activeDiscount(product.value.id, discounts.value) : undefined,
)
const money = (v: string) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(v))
function fill(v: Producto) {
  form.sku = v.sku ?? ''
  form.nombre = v.nombre
  form.precio_lista = v.precio_lista ?? ''
  form.observaciones = v.observaciones ?? ''
  form.activo = v.activo !== false
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    ;[product.value, chairs.value, floors.value, discounts.value] = await Promise.all([
      productosService.get(Number(route.params.id)),
      productosService.chairs(),
      productosService.floors(),
      productosService.discounts(),
    ])
    fill(product.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el producto.'
  } finally {
    loading.value = false
  }
}
async function save() {
  if (!product.value) return
  saving.value = true
  fields.value = {}
  error.value = ''
  const body: PatchedProductoWritable = {
    sku: form.sku || null,
    nombre: form.nombre,
    precio_lista: form.precio_lista,
    observaciones: form.observaciones || null,
    activo: form.activo,
  }
  try {
    product.value = await productosService.update(product.value.id, body)
    fill(product.value)
    editing.value = false
    success.value = 'Producto actualizado.'
  } catch (cause) {
    if (cause instanceof ApiError) fields.value = cause.fields
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
function cancelEdit() {
  editing.value = false
  if (product.value) fill(product.value)
}
onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      :title="product?.nombre || 'Producto'"
      description="Detalle comercial y disponibilidad general."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><Button v-if="product && canEdit && !editing" variant="secondary" @click="editing = true"
          >Editar datos comerciales</Button
        ></template
      ></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="8" /><ErrorState
      v-else-if="error && !product"
      :description="error"
    />
    <div v-else-if="product" class="layout">
      <Card
        ><ProductImage
          :image="product.imagen_principal"
          :alt="product.nombre"
          sizes="(max-width: 768px) 100vw, 50vw"
          eager /></Card
      ><Card
        ><p v-if="success" class="success">{{ success }}</p>
        <form v-if="editing" @submit.prevent="save">
          <TextField v-model="form.sku" name="sku" label="SKU" :error="fields.sku?.[0]" /><TextField
            v-model="form.nombre"
            name="nombre"
            label="Nombre"
            :error="fields.nombre?.[0]"
          /><TextField
            v-model="form.precio_lista"
            name="precio_lista"
            label="Precio de lista (BOB)"
            type="number"
            :error="fields.precio_lista?.[0]"
          /><TextField
            v-model="form.observaciones"
            name="observaciones"
            label="Observaciones"
            :error="fields.observaciones?.[0]"
          /><label><input v-model="form.activo" type="checkbox" /> Producto activo</label>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <div class="actions">
            <Button type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</Button
            ><Button variant="secondary" @click="cancelEdit">Cancelar</Button>
          </div>
        </form>
        <dl v-else>
          <div>
            <dt>SKU</dt>
            <dd>{{ product.sku || 'Sin SKU' }}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{{ info?.type }}</dd>
          </div>
          <div>
            <dt>Presentación</dt>
            <dd>{{ info?.detail || 'Sin detalle adicional' }}</dd>
          </div>
          <div>
            <dt>Precio vigente</dt>
            <dd>
              {{ money(product.precio_vigente) }} <small v-if="discount">Promoción vigente</small>
            </dd>
          </div>
          <div>
            <dt>Stock actual</dt>
            <dd>{{ product.stock }}</dd>
          </div>
          <div>
            <dt>En proformas pendientes</dt>
            <dd>{{ product.demanda_pendiente }}</dd>
          </div>
          <div>
            <dt>Disponibilidad referencial</dt>
            <dd>{{ product.disponibilidad_referencial }}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{{ product.activo === false ? 'Inactivo' : 'Activo' }}</dd>
          </div>
        </dl>
        <p class="stock-note">
          El stock es informativo y no puede modificarse desde esta pantalla.
        </p></Card
      >
    </div>
  </div>
</template>
<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(18rem, 0.8fr) minmax(0, 1.2fr);
  gap: var(--space-6);
}
form {
  display: grid;
  gap: var(--space-4);
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
dt {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
dd {
  margin: 0.25rem 0 0;
}
.actions {
  display: flex;
  gap: var(--space-3);
}
.success,
dd small {
  color: var(--color-success);
}
.form-error {
  color: var(--color-danger);
}
.stock-note {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
@media (max-width: 63.99rem) {
  .layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 35rem) {
  dl {
    grid-template-columns: 1fr;
  }
  .actions {
    display: grid;
  }
}
</style>
