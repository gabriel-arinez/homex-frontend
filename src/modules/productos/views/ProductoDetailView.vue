<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import type { Producto, ProductoWritable } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import ProductImage from '../components/ProductImage.vue'
import ProductoForm from '../components/ProductoForm.vue'
import { productosService } from '../services/productosService'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const session = useSessionStore()
const product = ref<Producto | null>(null)
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const success = ref('')
const confirmCancel = ref(false)
const dirty = ref(false)
const conflicted = ref(false)
let requestId = 0
const canEdit = computed(() => session.can('comercial.administrar'))
const money = (value: string) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value))
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
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) conflicted.value = true
    error.value = cause instanceof ApiError ? cause.message : 'No se pudo guardar.'
    if (conflicted.value) error.value += ' Conservamos los cambios locales; recarga únicamente si deseas descartarlos.'
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
function confirmNavigation() {
  return !saving.value && (!editing.value || !dirty.value || window.confirm(
    'Hay cambios en el producto sin guardar. ¿Deseas descartarlos?',
  ))
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (editing.value && dirty.value) event.preventDefault()
}
onBeforeRouteLeave(() => confirmNavigation())
onBeforeRouteUpdate((to, from) =>
  to.params.id === from.params.id || confirmNavigation(),
)
watch(() => route.params.id, () => void load())
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void load()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
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
      ><button type="button" @click="load">Reintentar</button></ErrorState
    ><template v-else-if="product"
      ><p v-if="success" class="success" role="status">{{ success }}</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <ProductoForm
        v-if="editing"
        :key="product.id"
        :initial="product"
        :processing="saving"
        @save="save"
        @change="dirty = true"
        @cancel="confirmCancel = true"
      />
      <div v-if="conflicted" class="conflict-actions">
        <Button variant="secondary" @click="load">Descartar cambios y recargar producto</Button>
      </div>
      <div v-else-if="!editing" class="layout">
        <Card
          ><ProductImage
            :image="product.imagen_principal"
            :alt="product.nombre"
            sizes="(max-width: 768px) 100vw, 50vw"
            eager /></Card
        ><Card
          ><dl>
            <div>
              <dt>SKU</dt>
              <dd>{{ product.sku }}</dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>{{ product.categoria_info?.nombre || `Categoría #${product.categoria}` }}</dd>
            </div>
            <div>
              <dt>Familia</dt>
              <dd>{{ product.familia_info?.nombre || 'Sin familia' }}</dd>
            </div>
            <div>
              <dt>Unidad comercial</dt>
              <dd>{{ product.unidad_stock_info?.nombre || `Unidad #${product.unidad_stock}` }}</dd>
            </div>
            <div>
              <dt>Precio de lista</dt>
              <dd>{{ money(product.precio_lista ?? '0') }}</dd>
            </div>
            <div>
              <dt>Precio vigente</dt>
              <dd>
                {{ money(product.precio_vigente) }}
                <span v-if="product.promocion?.vigente" class="promotion">Promoción vigente</span>
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
          <section v-if="product.silla">
            <h2>Ficha de silla</h2>
            <p>Modelo: {{ product.silla.modelo || 'No informado' }}</p>
            <p v-if="product.silla.especificaciones">
              Especificaciones: {{ product.silla.especificaciones }}
            </p>
          </section>
          <section v-if="product.piso">
            <h2>Ficha de piso</h2>
            <p>Modelo: {{ product.piso.modelo || 'No informado' }}</p>
            <p>m² por caja: {{ product.piso.m2_por_caja || 'No informado (dato descriptivo)' }}</p>
          </section>
          <p class="stock-note">
            El stock, la demanda, la disponibilidad y el precio vigente provienen del backend.
          </p></Card
        >
      </div></template
    ><ConfirmDialog
      :open="confirmCancel"
      title="Descartar cambios"
      description="Los cambios del producto no se guardarán."
      confirm-label="Descartar"
      @close="confirmCancel = false"
      @confirm="discardEdit"
    />
  </div>
</template>
<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(18rem, 0.8fr) minmax(0, 1.2fr);
  gap: var(--space-6);
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
.success,
.promotion {
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
}
</style>
