<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { ProductoWritable } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import ProductoForm from '../components/ProductoForm.vue'
import { productosService } from '../services/productosService'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const saving = ref(false)
const error = ref('')
const serverErrors = ref<Record<string, string[]>>({})
const dirty = ref(false)
const confirmCancel = ref(false)
const confirmLeave = ref(false)
let resolveLeave: ((answer: boolean) => void) | null = null

function destination(producto?: number, mediaError = false) {
  const requested = route.query.returnTo
  const target =
    typeof requested === 'string' && /^\/proformas(?:\/|$)/.test(requested)
      ? requested
      : '/productos'
  return producto
    ? {
        path: target,
        query: {
          ...route.query,
          draft: route.query.draft,
          productoCreado: String(producto),
          mediaError: mediaError ? '1' : undefined,
        },
      }
    : { path: target, query: { draft: route.query.draft } }
}
async function save(body: ProductoWritable, file: File | null) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  serverErrors.value = {}
  try {
    const product = await productosService.create(body)
    let mediaError = false
    if (file) {
      try {
        await productosService.uploadImage(product.id, file)
      } catch {
        mediaError = true
      }
    }
    dirty.value = false
    await router.push(destination(product.id, mediaError))
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value = cause.message
      serverErrors.value = cause.fields
    } else error.value = 'No se pudo registrar el producto.'
  } finally {
    saving.value = false
  }
}
function cancel() {
  if (saving.value) return
  if (dirty.value) confirmCancel.value = true
  else void router.push(destination())
}
function discard() {
  confirmCancel.value = false
  dirty.value = false
  void router.push(destination())
}
function answerLeave(answer: boolean) {
  confirmLeave.value = false
  const resolve = resolveLeave
  resolveLeave = null
  resolve?.(answer)
}
function confirmNavigation(): boolean | Promise<boolean> {
  if (saving.value) return false
  if (!dirty.value) return true
  return new Promise<boolean>((resolve) => {
    if (resolveLeave) resolveLeave(false)
    resolveLeave = resolve
    confirmLeave.value = true
  })
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}
onBeforeRouteLeave(confirmNavigation)
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>
<template>
  <div class="create-product-page">
    <PageHeader
      title="Nuevo producto"
      description="Registra un artículo comercial en el catálogo HOMEX."
      show-menu @menu="emit('openMenu')"
    />
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <ProductoForm :processing="saving" :server-errors="serverErrors"
      :can-upload-image="session.can('comercial.administrar')"
      :preselect-category="typeof route.query.categoria === 'string' ? route.query.categoria : undefined"
      @change="dirty = true" @save="save" @cancel="cancel" />
    <ConfirmDialog :open="confirmCancel" title="Descartar producto"
      description="Los datos que ingresaste no se guardarán."
      confirm-label="Descartar y salir" @close="confirmCancel = false" @confirm="discard" />
    <ConfirmDialog :open="confirmLeave" title="Salir sin guardar"
      description="Hay cambios sin guardar en este producto. Si sales, se descartarán."
      confirm-label="Salir sin guardar" @close="answerLeave(false)" @confirm="answerLeave(true)" />
  </div>
</template>
<style scoped>
.create-product-page { min-width: 0; }
.form-error { color: var(--color-danger-text); padding: var(--space-3);
  border: 1px solid var(--color-danger); border-radius: var(--radius-control);
  margin-bottom: var(--space-4); }
</style>
