<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Armchair, Layers, Package } from '@lucide/vue'
import { mediaUrl } from '@/shared/media/gallery'
import type { ImagenPrincipal } from '@/generated/api'

const props = withDefaults(
  defineProps<{
    image: ImagenPrincipal | null
    alt: string
    categoryCode?: string | null
    sizes?: string
    eager?: boolean
    compact?: boolean
  }>(),
  {
    categoryCode: null,
    sizes: '(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 320px',
    eager: false,
    compact: false,
  },
)
const failed = ref(false)
watch(
  () => props.image,
  () => (failed.value = false),
)
const fallbackIcon = computed(() => {
  if (props.categoryCode === 'SILLA') return Armchair
  if (props.categoryCode === 'PISO_FLOTANTE') return Layers
  return Package
})
const variants = computed(() =>
  Object.entries(props.image?.variantes ?? {})
    .map(([width, url]) => ({ width: Number.parseInt(width, 10), url: mediaUrl(url) }))
    .filter(
      (item) => Number.isFinite(item.width) && item.width > 0 && /^https?:\/\//.test(item.url),
    )
    .sort((a, b) => a.width - b.width),
)
const source = computed(
  () => variants.value[0]?.url ?? (props.image?.original ? mediaUrl(props.image.original) : null),
)
const srcset = computed(() => variants.value.map((item) => `${item.url} ${item.width}w`).join(', '))
</script>
<template>
  <div
    class="product-image"
    :class="{ 'product-image--compact': compact }"
    :style="image && !compact ? { aspectRatio: `${image.ancho} / ${image.alto}` } : undefined"
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
      <span class="fallback-icon-box" aria-hidden="true">
        <component :is="fallbackIcon" :size="26" />
      </span>
      <span class="fallback-label">Sin imagen</span>
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
  background: var(--color-surface-soft, var(--color-background));
}
.product-image--compact {
  min-height: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.product-image--compact img {
  object-fit: cover;
}
.product-image--compact .fallback-icon-box {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: inherit;
}
.product-image--compact .fallback-label {
  display: none;
}
.fallback {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  color: var(--color-text-secondary);
  font-weight: 600;
}
.fallback-icon-box {
  display: grid;
  width: 3.1rem;
  height: 3.1rem;
  place-items: center;
  border-radius: 0.9rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-primary-accent);
}
.fallback-label {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
</style>
