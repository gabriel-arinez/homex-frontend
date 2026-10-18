<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ProductoWritable } from '@/generated/api'
import { ApiError } from '@/shared/api'
import PageHeader from '@/shared/ui/PageHeader.vue'
import ProductoForm from '../components/ProductoForm.vue'
import { productosService } from '../services/productosService'
const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const saving = ref(false)
const error = ref('')
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
  saving.value = true
  error.value = ''
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
    await router.push(destination(product.id, mediaError))
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'No se pudo registrar el producto.'
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div>
    <PageHeader
      title="Nuevo producto"
      description="Registra una variante comercial con precio y stock independientes."
      show-menu
      @menu="emit('openMenu')"
    />
    <p v-if="error" role="alert">{{ error }}</p>
    <ProductoForm
      :processing="saving"
      :preselect-category="
        typeof route.query.categoria === 'string' ? route.query.categoria : undefined
      "
      @save="save"
      @cancel="router.push(destination())"
    />
  </div>
</template>
