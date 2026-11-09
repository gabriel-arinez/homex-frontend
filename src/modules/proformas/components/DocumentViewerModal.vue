<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  Printer,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Scan,
} from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
import PdfCanvasPage from './PdfCanvasPage.vue'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    subtitle?: string
    downloading?: boolean
    canDownloadPdf?: boolean
    pdfUrl?: string
    loading?: boolean
    error?: string
    notice?: string
  }>(),
  {
    title: 'Documento comercial',
    subtitle: 'PDF tamaño Carta · Versión guardada',
    downloading: false,
    canDownloadPdf: true,
    pdfUrl: '',
    loading: false,
    error: '',
    notice: '',
  },
)
const emit = defineEmits<{ close: []; download: []; retry: [] }>()
const zoom = ref(1)
const mode = ref<'page' | 'width' | 'custom'>('page')
const viewportRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLButtonElement | null>(null)
const printRef = ref<HTMLIFrameElement | null>(null)
const pdf = shallowRef<PDFDocumentProxy | null>(null)
const pages = ref<number[]>([])
const activePage = ref(1)
const pdfError = ref('')
const printError = ref('')
const printReady = ref(false)
let previousOverflow = ''
let previousFocus: HTMLElement | null = null
let scrollRaf = 0

const clamp = (n: number) => Math.min(1.8, Math.max(0.4, Math.round(n * 100) / 100))

function setZoom(next: number, nextMode: typeof mode.value = 'custom') {
  const el = viewportRef.value
  const x = el ? (el.scrollLeft + el.clientWidth / 2) / Math.max(1, el.scrollWidth) : 0
  const y = el ? (el.scrollTop + el.clientHeight / 2) / Math.max(1, el.scrollHeight) : 0
  zoom.value = clamp(next)
  mode.value = nextMode
  void nextTick(() => {
    if (!el) return
    el.scrollLeft = Math.max(0, x * el.scrollWidth - el.clientWidth / 2)
    el.scrollTop = Math.max(0, y * el.scrollHeight - el.clientHeight / 2)
    updatePage()
  })
}
function zoomIn() {
  setZoom(zoom.value + 0.1)
}
function zoomOut() {
  setZoom(zoom.value - 0.1)
}
function resetZoom() {
  setZoom(1)
}
function fit(modeToFit: 'page' | 'width') {
  const el = viewportRef.value
  if (!el) return
  // Letter pages are 612 × 792 pt; PDF.js uses 96 CSS px per inch.
  const widthFit = (el.clientWidth - 60) / 816
  const pageFit = Math.min(widthFit, (el.clientHeight - 52) / 1056)
  setZoom(modeToFit === 'width' ? widthFit : pageFit, modeToFit)
}
function updatePage() {
  const el = viewportRef.value
  if (!el || !pages.value.length) return
  const rect = el.getBoundingClientRect()
  let bestPage = 1
  let nearest = Number.POSITIVE_INFINITY
  for (const number of pages.value) {
    const node = document.getElementById(`homex-pdf-page-${number}`)
    if (!node) continue
    const bounds = node.getBoundingClientRect()
    const distance = Math.abs(
      bounds.top + Math.min(bounds.height / 2, rect.height / 2) - (rect.top + rect.height / 2),
    )
    if (distance < nearest) {
      nearest = distance
      bestPage = number
    }
  }
  activePage.value = bestPage
}
function onScroll() {
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(updatePage)
}
function goToPage(number: number) {
  const node = document.getElementById(`homex-pdf-page-${number}`)
  const el = viewportRef.value
  if (!node || !el) return
  el.scrollTo({ top: node.offsetTop - 16, behavior: 'smooth' })
  activePage.value = number
}
function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const controls = document.querySelectorAll<HTMLElement>(
    '.doc-viewer-overlay button:not([disabled]), .doc-viewer-overlay [tabindex="0"]',
  )
  if (!controls.length) return
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
function printDocument() {
  if (!props.pdfUrl || props.loading || !pdf.value) return
  printError.value = ''
  try {
    const frame = printRef.value?.contentWindow
    if (!frame || !printReady.value) throw new Error('El PDF aún no está preparado.')
    frame.focus()
    // PDF original, never the canvas or the HTML editor.
    frame.print()
  } catch {
    printError.value =
      'No se pudo iniciar la impresión del PDF. Descarga el archivo para imprimirlo con tu lector.'
  }
}
function printFrameLoaded() {
  printReady.value = true
}

watch(
  [() => props.open, () => props.pdfUrl],
  async ([open, url], _, onCleanup) => {
    let disposed = false
    let task: PDFDocumentLoadingTask | null = null
    onCleanup(() => {
      disposed = true
      if (task) void task.destroy()
    })
    pdf.value = null
    pages.value = []
    activePage.value = 1
    pdfError.value = ''
    printReady.value = false
    if (!open || !url) return
    try {
      task = getDocument({ url })
      const document = await task.promise
      if (disposed) return
      pdf.value = document
      pages.value = Array.from({ length: document.numPages }, (_, i) => i + 1)
      await nextTick()
      if (!disposed) {
        fit('page')
        if (viewportRef.value) {
          viewportRef.value.scrollTop = 0
          viewportRef.value.scrollLeft = 0
        }
      }
    } catch (error) {
      if (!disposed) {
        pdfError.value = error instanceof Error ? error.message : `No se pudo abrir el PDF: ${String(error)}`
      }
    }
  },
  { immediate: true },
)
watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      printError.value = ''
      await nextTick()
      closeRef.value?.focus()
    } else {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
      printError.value = ''
    }
  },
  { immediate: true },
)
function onResize() {
  if (pdf.value && mode.value !== 'custom') fit(mode.value)
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  if (props.open) document.body.style.overflow = previousOverflow
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="doc-viewer-overlay" role="dialog" aria-modal="true" :aria-label="title">
      <header class="doc-viewer-bar">
        <div class="doc-viewer-bar__identity">
          <span class="doc-viewer-bar__icon"><FileText :size="20" aria-hidden="true" /></span>
          <div class="doc-viewer-bar__titles">
            <h2 class="doc-viewer-bar__title">{{ title }}</h2>
            <p class="doc-viewer-bar__subtitle">{{ subtitle }}</p>
          </div>
        </div>
        <div class="doc-viewer-bar__tools">
          <div class="doc-viewer-bar__zoom-controls" aria-label="Zoom del documento">
            <button
              type="button"
              class="zoom-btn"
              aria-label="Reducir zoom"
              :disabled="zoom <= 0.4"
              @click="zoomOut"
            >
              <ZoomOut :size="17" />
            </button>
            <button
              type="button"
              class="zoom-display"
              title="Restablecer escala al 100 %"
              @click="resetZoom"
            >
              {{ Math.round(zoom * 100) }}%
            </button>
            <button
              type="button"
              class="zoom-btn"
              aria-label="Aumentar zoom"
              :disabled="zoom >= 1.8"
              @click="zoomIn"
            >
              <ZoomIn :size="17" />
            </button>
            <button
              type="button"
              class="zoom-btn zoom-btn--text"
              title="Ajustar página completa"
              @click="fit('page')"
            >
              <Scan :size="15" /> Página
            </button>
            <button
              type="button"
              class="zoom-btn zoom-btn--text"
              title="Ajustar ancho"
              @click="fit('width')"
            >
              <Maximize2 :size="15" /> Ancho
            </button>
          </div>
          <div
            class="doc-viewer-bar__page-controls"
            v-if="pages.length > 1"
            aria-label="Navegación entre páginas"
          >
            <button
              type="button"
              class="zoom-btn"
              aria-label="Página anterior"
              :disabled="activePage <= 1"
              @click="goToPage(activePage - 1)"
            >
              <ChevronLeft :size="17" />
            </button>
            <span>{{ activePage }} / {{ pages.length }}</span>
            <button
              type="button"
              class="zoom-btn"
              aria-label="Página siguiente"
              :disabled="activePage >= pages.length"
              @click="goToPage(activePage + 1)"
            >
              <ChevronRight :size="17" />
            </button>
          </div>
        </div>
        <div class="doc-viewer-bar__actions">
          <Button
            type="button"
            variant="secondary"
            :disabled="loading || !pdfUrl || !pdf"
            @click="printDocument"
            ><Printer :size="17" aria-hidden="true" /> Imprimir</Button
          >
          <Button
            v-if="canDownloadPdf"
            type="button"
            variant="secondary"
            :processing="downloading"
            :disabled="loading || !pdfUrl"
            @click="emit('download')"
            ><Download :size="17" aria-hidden="true" /> Descargar PDF</Button
          >
          <button
            ref="closeRef"
            type="button"
            class="doc-close-btn"
            aria-label="Cerrar visor de documento"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </div>
      </header>

      <p v-if="notice" class="doc-viewer-notice" role="status">{{ notice }}</p>
      <p v-if="printError" class="doc-viewer-error" role="alert">{{ printError }}</p>
      <main
        ref="viewportRef"
        class="doc-viewer-viewport"
        tabindex="0"
        aria-label="Páginas del PDF"
        @scroll.passive="onScroll"
      >
        <div v-if="loading || (pdfUrl && !pdf && !pdfError)" class="doc-state" role="status">
          Preparando documento PDF…
        </div>
        <div v-else-if="error || pdfError" class="doc-state" role="alert">
          <p>{{ error || pdfError }}</p>
          <Button type="button" variant="secondary" @click="emit('retry')"
            ><RotateCw :size="16" aria-hidden="true" /> Reintentar</Button
          >
        </div>
        <div v-else-if="pdf" class="doc-page-stack">
          <PdfCanvasPage
            v-for="number in pages"
            :key="number"
            :pdf="pdf"
            :page-number="number"
            :scale="zoom"
            :scroll-root="viewportRef"
            @error="pdfError = $event"
          />
        </div>
        <div v-else class="doc-state">No hay documento disponible.</div>
      </main>
      <iframe
        v-if="pdfUrl"
        ref="printRef"
        class="doc-native-print-frame"
        :src="pdfUrl"
        title="Documento original preparado para imprimir"
        tabindex="-1"
        aria-hidden="true"
        @load="printFrameLoaded"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.doc-viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: #09090b;
  color: #fafafa;
}
.doc-viewer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  background: #18181b;
  border-bottom: 1px solid #3f3f46;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.doc-viewer-bar__identity,
.doc-viewer-bar__tools,
.doc-viewer-bar__actions,
.doc-viewer-bar__zoom-controls,
.doc-viewer-bar__page-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.doc-viewer-bar__icon {
  display: grid;
  place-items: center;
  background: #27272a;
  color: #ef4444;
  width: 36px;
  height: 36px;
  border-radius: 8px;
}
.doc-viewer-bar__title {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
}
.doc-viewer-bar__subtitle {
  font-size: 11px;
  color: #d4d4d8;
  margin: 2px 0 0;
}
.doc-viewer-bar__zoom-controls,
.doc-viewer-bar__page-controls {
  padding: 3px;
  border: 1px solid #52525b;
  border-radius: 8px;
  background: #27272a;
}
.zoom-btn,
.zoom-display,
.doc-close-btn {
  color: #fafafa;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  min-height: 30px;
}
.zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 30px;
  padding: 0 6px;
}
.zoom-display {
  min-width: 46px;
  padding: 0 4px;
  font-weight: 700;
}
.zoom-btn:hover:not(:disabled),
.zoom-display:hover,
.doc-close-btn:hover {
  background: #3f3f46;
}
.zoom-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.doc-viewer-bar__page-controls span {
  font-size: 12px;
  padding: 0 4px;
  white-space: nowrap;
}
.doc-close-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  background: #27272a;
  border: 1px solid #52525b;
}
.doc-viewer-bar button:focus-visible,
.doc-viewer-viewport:focus-visible {
  outline: 2px solid #f8fafc;
  outline-offset: 2px;
}
.doc-viewer-viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  scrollbar-width: none;
  touch-action: pan-x pan-y;
  overscroll-behavior: contain;
}
.doc-viewer-viewport::-webkit-scrollbar {
  display: none;
}
.doc-page-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: max-content;
  min-width: 100%;
  padding-bottom: 30px;
}
.doc-state {
  margin: 10vh auto 0;
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 24px;
  color: #fafafa;
  text-align: center;
}
.doc-viewer-error,
.doc-viewer-notice {
  margin: 0;
  padding: 10px 20px;
  font-size: 13px;
  background: #713f12;
  color: #fff;
}
.doc-viewer-error {
  background: #991b1b;
}
.doc-native-print-frame {
  position: absolute;
  width: 0;
  height: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}
@media (max-width: 920px) {
  .doc-viewer-bar {
    justify-content: center;
    padding: 8px 12px;
  }
  .doc-viewer-bar__identity {
    margin-right: auto;
  }
  .doc-viewer-viewport {
    padding: 12px;
  }
}
@media (max-width: 620px) {
  .doc-viewer-bar__subtitle,
  .zoom-btn--text {
    display: none;
  }
  .doc-viewer-bar__tools {
    order: 3;
  }
  .doc-viewer-bar__actions {
    margin-left: auto;
  }
}
</style>
