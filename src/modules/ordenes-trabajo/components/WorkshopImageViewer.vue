<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Star, ZoomIn, ZoomOut } from '@lucide/vue'
import type { GalleryImage } from '@/shared/media/gallery'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'

const props = defineProps<{
  images: GalleryImage[]
  title?: string
}>()

const selected = ref(0)
const zoom = ref(1)
const viewportRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
let dragStart: { x: number; y: number; left: number; top: number; pointer: number } | null = null

watch(
  () => props.images,
  (list) => {
    const coverIdx = list.findIndex((img) => img.principal)
    selected.value = coverIdx >= 0 ? coverIdx : 0
    zoom.value = 1
  },
  { immediate: true },
)

const current = computed(() => props.images[selected.value] ?? props.images[0] ?? null)

function selectIndex(index: number) {
  selected.value = index
  zoom.value = 1
}

function navigate(offset: number) {
  if (props.images.length < 2) return
  selected.value = (selected.value + offset + props.images.length) % props.images.length
  zoom.value = 1
}

function changeZoom(delta: number) {
  zoom.value = Math.min(3, Math.max(1, Number((zoom.value + delta).toFixed(2))))
}

function startPan(event: PointerEvent) {
  if (zoom.value <= 1 || event.pointerType !== 'mouse' || event.button !== 0) return
  const vp = viewportRef.value
  if (!vp) return
  event.preventDefault()
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    left: vp.scrollLeft,
    top: vp.scrollTop,
    pointer: event.pointerId,
  }
  dragging.value = true
  vp.setPointerCapture(event.pointerId)
}

function movePan(event: PointerEvent) {
  const vp = viewportRef.value
  if (!vp || !dragStart || dragStart.pointer !== event.pointerId) return
  vp.scrollLeft = dragStart.left - (event.clientX - dragStart.x)
  vp.scrollTop = dragStart.top - (event.clientY - dragStart.y)
}

function endPan(event: PointerEvent) {
  if (dragStart?.pointer !== event.pointerId) return
  dragStart = null
  dragging.value = false
}
</script>

<template>
  <div v-if="images.length && current" class="workshop-viewer">
    <header class="viewer-head">
      <div class="viewer-head__title">
        <ImageIcon :size="15" aria-hidden="true" />
        <span>{{ title || 'Referencias visuales' }}</span>
        <small>{{ selected + 1 }} / {{ images.length }}</small>
        <span v-if="current.principal" class="viewer-head__star" title="Imagen principal">
          <Star :size="12" aria-hidden="true" />
        </span>
      </div>

      <div class="viewer-head__controls">
        <div v-if="images.length > 1" class="viewer-ctrl-group" role="group" aria-label="Navegar">
          <button
            type="button"
            class="viewer-ctrl-btn"
            aria-label="Imagen anterior"
            @click="navigate(-1)"
          >
            <ChevronLeft :size="15" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="viewer-ctrl-btn"
            aria-label="Imagen siguiente"
            @click="navigate(1)"
          >
            <ChevronRight :size="15" aria-hidden="true" />
          </button>
        </div>

        <div class="viewer-ctrl-group" role="group" aria-label="Zoom">
          <button
            type="button"
            class="viewer-ctrl-btn"
            aria-label="Reducir zoom"
            :disabled="zoom <= 1"
            @click="changeZoom(-0.5)"
          >
            <ZoomOut :size="15" aria-hidden="true" />
          </button>
          <span class="viewer-zoom-pct">{{ Math.round(zoom * 100) }}%</span>
          <button
            type="button"
            class="viewer-ctrl-btn"
            aria-label="Aumentar zoom"
            :disabled="zoom >= 3"
            @click="changeZoom(0.5)"
          >
            <ZoomIn :size="15" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

    <div class="viewer-stage" :class="{ 'viewer-stage--single': images.length <= 1 }">
      <div v-if="images.length > 1" class="viewer-thumbs-col" role="list">
        <button
          v-for="(img, idx) in images"
          :key="img.id"
          type="button"
          class="viewer-thumb-btn"
          :class="{ active: idx === selected }"
          :aria-label="`Ver ${img.nombre || `imagen ${idx + 1}`}`"
          :aria-pressed="idx === selected"
          @click="selectIndex(idx)"
        >
          <GalleryPhoto :src="img.variantes?.['320'] ?? img.url" :alt="img.nombre" />
        </button>
      </div>

      <div
        ref="viewportRef"
        class="viewer-canvas"
        :class="{ 'viewer-canvas--zoomed': zoom > 1, 'viewer-canvas--dragging': dragging }"
        @pointerdown="startPan"
        @pointermove="movePan"
        @pointerup="endPan"
        @pointercancel="endPan"
        @lostpointercapture="endPan"
      >
        <div class="viewer-zoom-box" :style="{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }">
          <GalleryPhoto :src="current.url" :alt="current.nombre" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workshop-viewer {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.viewer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.viewer-head__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text);
}
.viewer-head__title svg {
  color: var(--color-primary-accent);
}
.viewer-head__title small {
  color: var(--color-text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.viewer-head__star {
  display: inline-flex;
  align-items: center;
  color: var(--color-warning, #d97706);
}
.viewer-head__controls {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}
.viewer-ctrl-group {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.viewer-ctrl-btn {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}
.viewer-ctrl-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
}
.viewer-ctrl-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.viewer-zoom-pct {
  min-width: 2.6rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}
.viewer-stage {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: 0.65rem;
  align-items: stretch;
}
.viewer-stage--single {
  grid-template-columns: minmax(0, 1fr);
}
.viewer-thumbs-col {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 28rem;
  overflow-y: auto;
  padding-right: 0.15rem;
}
.viewer-thumb-btn {
  width: 3.75rem;
  height: 3.75rem;
  flex: none;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  cursor: pointer;
}
.viewer-thumb-btn.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}
.viewer-thumb-btn :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.viewer-canvas {
  position: relative;
  height: 28rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.viewer-canvas--zoomed {
  overflow: auto;
  cursor: grab;
}
.viewer-canvas--dragging {
  cursor: grabbing;
}
.viewer-zoom-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100%;
  min-height: 100%;
}
.viewer-zoom-box :deep(img) {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
@media (max-width: 38rem) {
  .viewer-stage {
    grid-template-columns: minmax(0, 1fr);
  }
  .viewer-thumbs-col {
    flex-direction: row;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .viewer-canvas {
    height: 20rem;
  }
}
</style>
