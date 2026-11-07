<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { apiRequest } from '@/shared/api'
import { mediaUrl } from './gallery'
const props = defineProps<{ src: string; alt: string }>()
const emit = defineEmits<{ load: []; error: [] }>()
const source = ref(''),
  error = ref(false)
let version = 0,
  objectUrl = ''
function clear() {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = ''
}
watch(
  () => props.src,
  async (src) => {
    const current = ++version
    clear()
    source.value = ''
    error.value = false
    if (!src.startsWith('/api/v1/imagenes-privadas/')) {
      source.value = mediaUrl(src)
      return
    }
    try {
      const blob = await apiRequest<Blob>(src, { responseType: 'blob' })
      if (current !== version) return
      objectUrl = URL.createObjectURL(blob)
      source.value = objectUrl
    } catch {
      if (current === version) {
        error.value = true
        emit('error')
      }
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  version++
  clear()
})
</script>
<template>
  <img
    v-if="source && !error"
    :src="source"
    :alt="alt"
    @load="emit('load')"
    @error="((error = true), emit('error'))"
  /><span v-else role="img" :aria-label="alt">{{
    error ? 'No se pudo cargar la imagen' : 'Cargando imagen…'
  }}</span>
</template>
<style scoped>
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
