<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { ProductoWritable } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import ProductoForm from '../components/ProductoForm.vue'
import { galleryService, type LocalImage } from '@/shared/media/gallery'
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
let allowNavigationAfterSave = false

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
const createdId = ref<number | null>(null)
const uploaded = new Map<string, number>()
async function save(body: ProductoWritable, images: LocalImage[]) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  serverErrors.value = {}
  try {
    const retrying = createdId.value !== null
    let product
    if (createdId.value) {
      const previous = await productosService.get(createdId.value)
      product = await productosService.update(previous.id, body, previous.revision)
    } else product = await productosService.create(body)
    createdId.value = product.id
    if (images.length || uploaded.size || retrying) {
      const path = `/api/v1/catalogo/productos/${product.id}/imagenes/`
      const current = await galleryService.list(path)
      for (const existing of current.imagenes) {
        if (!images.some((i) => i.digest === existing.sha256)) {
          await galleryService.change(path, { eliminar: existing.id })
          if (existing.sha256) uploaded.delete(existing.sha256)
        } else if (existing.sha256) uploaded.set(existing.sha256, existing.id)
      }
      for (const image of images) {
        if (uploaded.has(image.digest)) continue
        const result = await galleryService.upload(path, image.file, image.digest)
        const added = result.imagenes.find((i) => i.sha256 === image.digest)
        if (added) uploaded.set(image.digest, added.id)
      }
      if (images.length) {
        const ids = images
          .map((i) => uploaded.get(i.digest))
          .filter((id): id is number => id !== undefined)
        if (ids.length) await galleryService.change(path, { orden: ids })
        const cover = images.find((i) => i.principal)
        const id = cover ? uploaded.get(cover.digest) : undefined
        if (id) await galleryService.change(path, { principal: id })
      }
    }
    dirty.value = false
    allowNavigationAfterSave = true
    await router.push(destination(product.id))
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value = cause.message
      serverErrors.value = cause.fields
    } else error.value = 'No se pudo registrar el producto.'
  } finally {
    allowNavigationAfterSave = false
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
  // Allow the redirect caused by a successfully persisted product,
  // while preventing unrelated navigation during a pending save.
  if (allowNavigationAfterSave) return true
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
      show-menu
      @menu="emit('openMenu')"
    />
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <ProductoForm
      :processing="saving"
      :server-errors="serverErrors"
      :can-upload-image="session.can('catalogo.crear_producto')"
      :preselect-category="
        typeof route.query.categoria === 'string' ? route.query.categoria : undefined
      "
      @change="dirty = true"
      @save="save"
      @cancel="cancel"
    />
    <ConfirmDialog
      :open="confirmCancel"
      title="Descartar producto"
      description="Los datos que ingresaste no se guardarán."
      confirm-label="Descartar y salir"
      @close="confirmCancel = false"
      @confirm="discard"
    />
    <ConfirmDialog
      :open="confirmLeave"
      title="Salir sin guardar"
      description="Hay cambios sin guardar en este producto. Si sales, se descartarán."
      confirm-label="Salir sin guardar"
      @close="answerLeave(false)"
      @confirm="answerLeave(true)"
    />
  </div>
</template>
<style scoped>
.create-product-page {
  min-width: 0;
}
.form-error {
  color: var(--color-danger-text);
  padding: var(--space-3);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-control);
  margin-bottom: var(--space-4);
}
</style>
