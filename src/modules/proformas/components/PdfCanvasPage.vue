<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'

const props = defineProps<{
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  scrollRoot: HTMLElement | null
}>()
const emit = defineEmits<{ error: [message: string] }>()
const container = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const textContainer = ref<HTMLElement | null>(null)
const visible = ref(false)
const size = ref({ width: 816, height: 1056 })
const rendered = ref(false)
const style = computed(() => ({
  width: `${Math.round(size.value.width * props.scale)}px`,
  height: `${Math.round(size.value.height * props.scale)}px`,
}))
let observer: IntersectionObserver | null = null
let renderTask: RenderTask | null = null
let textLayer: TextLayer | null = null

function observe() {
  observer?.disconnect()
  observer = null
  if (!container.value) return
  if (typeof IntersectionObserver === 'undefined') {
    visible.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      visible.value = Boolean(entries[0]?.isIntersecting)
    },
    { root: props.scrollRoot, rootMargin: '700px 300px', threshold: 0 },
  )
  observer.observe(container.value)
}
onMounted(observe)
watch(() => props.scrollRoot, observe)
onBeforeUnmount(() => {
  observer?.disconnect()
  renderTask?.cancel()
  textLayer?.cancel()
  if (canvas.value) {
    canvas.value.width = 0
    canvas.value.height = 0
  }
})

watch(
  [() => props.pdf, () => props.pageNumber, () => props.scale, visible],
  async (_, __, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
    })
    rendered.value = false
    if (!visible.value) {
      if (canvas.value) {
        canvas.value.width = 0
        canvas.value.height = 0
      }
      if (textContainer.value) textContainer.value.replaceChildren()
      return
    }
    try {
      const page = await props.pdf.getPage(props.pageNumber)
      if (cancelled) return
      const actual = page.getViewport({ scale: 96 / 72 })
      size.value = { width: actual.width, height: actual.height }
      await nextTick()
      if (cancelled || !canvas.value) return
      const viewport = page.getViewport({ scale: (96 / 72) * props.scale })
      const surface = canvas.value
      const context = surface.getContext('2d', { alpha: false })
      if (!context) throw new Error('No se pudo crear el lienzo del PDF.')
      // Pixel density is applied at render time, never with CSS transforms.
      // Cap the canvas allocation to protect memory on large screens.
      const pixels = viewport.width * viewport.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5, Math.sqrt(16000000 / pixels))
      const density = Math.max(1, dpr)
      surface.width = Math.round(viewport.width * density)
      surface.height = Math.round(viewport.height * density)
      surface.style.width = `${viewport.width}px`
      surface.style.height = `${viewport.height}px`
      renderTask = page.render({
        canvas: surface,
        canvasContext: context,
        viewport,
        transform: [density, 0, 0, density, 0, 0],
      })
      await renderTask.promise
      if (cancelled) return
      if (textContainer.value) {
        textContainer.value.replaceChildren()
        textContainer.value.style.setProperty('--scale-factor', String(viewport.scale))
        textContainer.value.style.setProperty('--total-scale-factor', String(viewport.scale))
        try {
          textLayer = new TextLayer({
            textContentSource: page.streamTextContent(),
            container: textContainer.value,
            viewport,
          })
          await textLayer.render()
        } catch {
          // Text selection is supplemental; never hide an otherwise valid PDF page.
          if (!cancelled) textContainer.value?.replaceChildren()
        }
      }
      if (!cancelled) rendered.value = true
    } catch (cause) {
      if (!cancelled && !(cause instanceof Error && cause.name === 'RenderingCancelledException')) {
        emit(
          'error',
          cause instanceof Error ? cause.message : 'No se pudo representar esta página.',
        )
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <section
    :id="`homex-pdf-page-${pageNumber}`"
    ref="container"
    class="pdf-page"
    :style="style"
    :aria-label="`Página ${pageNumber}`"
  >
    <canvas ref="canvas" class="pdf-page__canvas" aria-hidden="true" />
    <div ref="textContainer" class="textLayer pdf-page__text" />
    <div v-if="!rendered" class="pdf-page__loading" role="status">
      Preparando página {{ pageNumber }}…
    </div>
  </section>
</template>

<style scoped>
.pdf-page {
  position: relative;
  flex: none;
  background: white;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}
.pdf-page__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.pdf-page__text {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
}
.pdf-page__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #fff;
  color: #334155;
  font-size: 13px;
}
</style>

<style>
/* PDF.js text selection only. Avoid importing the entire generic viewer stylesheet. */
.pdf-page .textLayer {
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor, 1) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
  position: absolute;
  inset: 0;
  overflow: hidden;
  text-align: initial;
  line-height: 1;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  z-index: 2;
}
.pdf-page .textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
}
.pdf-page .textLayer > :not(.markedContent),
.pdf-page .textLayer .markedContent span:not(.markedContent) {
  --font-height: 0;
  --scale-x: 1;
  --rotate: 0deg;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}
.pdf-page .textLayer span.markedContent { top: 0; height: 0; }
.pdf-page .textLayer ::selection { background: rgba(37, 99, 235, .25); }
.pdf-page .textLayer .endOfContent {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  bottom: 0;
  z-index: -1;
  cursor: default;
  user-select: none;
}
</style>
