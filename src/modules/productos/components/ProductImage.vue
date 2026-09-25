<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImageOff } from '@lucide/vue'
import type { ImagenPrincipal } from '@/generated/api'

const props = withDefaults(
  defineProps<{ image: ImagenPrincipal | null; alt: string; sizes?: string; eager?: boolean }>(),
  { sizes: '(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 320px', eager: false },
)
const failed = ref(false)
watch(
  () => props.image,
  () => (failed.value = false),
)
const variants = computed(() =>
  Object.entries(props.image?.variantes ?? {})
    .map(([width, url]) => ({ width: Number.parseInt(width, 10), url }))
    .filter(
      (item) => Number.isFinite(item.width) && item.width > 0 && /^https?:\/\//.test(item.url),
    )
    .sort((a, b) => a.width - b.width),
)
const source = computed(() => variants.value[0]?.url ?? null)
const srcset = computed(() => variants.value.map((item) => `${item.url} ${item.width}w`).join(', '))
</script>
<template>
  <div
    class="product-image"
    :style="image ? { aspectRatio: `${image.ancho} / ${image.alto}` } : undefined"
  >
    <img
      v-if="source && !failed"
      :src="source"
      :srcset="srcset"
      :sizes
      :alt
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @error="failed = true"
    />
    <div v-else class="fallback" role="img" :aria-label="`Sin imagen para ${alt}`">
      <ImageOff aria-hidden="true" /><span>Sin imagen</span>
    </div>
  </div>
</template>
<style scoped>
.product-image {
  display: grid;
  min-height: 10rem;
  overflow: hidden;
  place-items: center;
  border-radius: var(--radius-card);
  background: var(--color-background);
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.fallback {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-weight: 600;
}
</style>
