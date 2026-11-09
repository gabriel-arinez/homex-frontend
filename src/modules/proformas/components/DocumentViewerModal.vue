<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Printer, Download, X, ZoomIn, ZoomOut, Maximize2, FileText, RotateCw } from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'

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
    subtitle: 'Vista previa de impresión · Tamaño Carta (216 × 279 mm)',
    downloading: false,
    canDownloadPdf: true,
    pdfUrl: '',
    loading: false,
    error: '',
    notice: '',
  },
)
const emit = defineEmits<{
  close: []
  download: []
  retry: []
}>()

const zoom = ref(1)
const viewportRef = ref<HTMLElement | null>(null)
const frameRef = ref<HTMLIFrameElement | null>(null)
const closeRef = ref<HTMLButtonElement | null>(null)
const printError = ref('')
let previousOverflow = ''
let previousFocus: HTMLElement | null = null

function zoomIn() {
  zoom.value = Math.min(1.8, Math.round((zoom.value + 0.1) * 10) / 10)
}
function zoomOut() {
  zoom.value = Math.max(0.4, Math.round((zoom.value - 0.1) * 10) / 10)
}
function resetZoom() {
  zoom.value = 1
}
function fitWidth() {
  if (!viewportRef.value) return
  zoom.value = Math.min(
    1.2,
    Math.max(0.4, Math.floor(((viewportRef.value.clientWidth - 48) / 816) * 100) / 100),
  )
}
function handleKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') emit('close')
}
function printDocument() {
  if (!props.pdfUrl || props.loading) return
  printError.value = ''
  try {
    const frame = frameRef.value?.contentWindow
    if (!frame) throw new Error('No se pudo acceder al documento.')
    frame.focus()
    // Imprimir el PDF incrustado, nunca el formulario ni la ventana HOMEX.
    frame.print()
  } catch {
    printError.value =
      'El navegador no pudo iniciar la impresión del PDF. Abre el documento en una pestaña nueva o descárgalo para imprimirlo.'
  }
}
watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousOverflow = document.body.style.overflow
      previousFocus = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      zoom.value = 1
      printError.value = ''
      await nextTick()
      if (window.innerWidth < 900) fitWidth()
      closeRef.value?.focus()
    } else {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
      printError.value = ''
    }
  },
  { immediate: true },
)
watch(
  () => props.pdfUrl,
  () => {
    printError.value = ''
  },
)
window.addEventListener('keydown', handleKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
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
        <div class="doc-viewer-bar__zoom-controls" aria-label="Controles de escala">
          <button
            type="button"
            class="zoom-btn"
            title="Reducir zoom"
            aria-label="Reducir zoom"
            :disabled="zoom <= 0.4"
            @click="zoomOut"
          >
            <ZoomOut :size="17" />
          </button>
          <button type="button" class="zoom-display" title="Restablecer escala" @click="resetZoom">
            {{ Math.round(zoom * 100) }}%
          </button>
          <button
            type="button"
            class="zoom-btn"
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
            :disabled="zoom >= 1.8"
            @click="zoomIn"
          >
            <ZoomIn :size="17" />
          </button>
          <button
            type="button"
            class="zoom-btn zoom-btn--text"
            title="Ajustar al ancho"
            @click="fitWidth"
          >
            <Maximize2 :size="15" /><span>Ajustar</span>
          </button>
        </div>
        <div class="doc-viewer-bar__actions">
          <Button
            type="button"
            variant="secondary"
            :disabled="loading || !pdfUrl"
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

      <main ref="viewportRef" class="doc-viewer-viewport">
        <div v-if="loading" class="doc-state" role="status">Preparando documento PDF…</div>
        <div v-else-if="error" class="doc-state" role="alert">
          <p>{{ error }}</p>
          <Button type="button" variant="secondary" @click="emit('retry')"
            ><RotateCw :size="16" aria-hidden="true" /> Reintentar</Button
          >
        </div>
        <div
          v-else-if="pdfUrl"
          class="doc-viewer-sheet-stage"
          :style="{ width: `${816 * zoom}px`, height: `${1056 * zoom}px` }"
        >
          <iframe
            ref="frameRef"
            class="doc-pdf-frame"
            :src="`${pdfUrl}#toolbar=0&navpanes=0`"
            :title="`Documento PDF: ${title}`"
            :style="{ transform: `scale(${zoom})` }"
          />
        </div>
        <div v-else class="doc-state">No hay documento disponible.</div>
      </main>
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
  gap: 16px;
  padding: 10px 20px;
  background: #18181b;
  border-bottom: 1px solid #3f3f46;
  flex-shrink: 0;
}
.doc-viewer-bar__identity,
.doc-viewer-bar__zoom-controls,
.doc-viewer-bar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
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
.doc-viewer-bar__zoom-controls {
  gap: 3px;
  padding: 4px;
  border: 1px solid #52525b;
  border-radius: 8px;
  background: #27272a;
}
.zoom-btn,
.zoom-display,
.doc-close-btn {
  color: #fafafa;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  height: 30px;
}
.zoom-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 0 6px;
}
.zoom-display {
  min-width: 47px;
  font-weight: 700;
}
.zoom-btn:hover:not(:disabled),
.zoom-display:hover,
.doc-close-btn:hover {
  background: #3f3f46;
}
.zoom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.doc-viewer-bar__actions {
  gap: 10px;
}
.doc-close-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  background: #27272a;
  border: 1px solid #52525b;
}
.doc-close-btn:focus-visible,
.zoom-btn:focus-visible,
.zoom-display:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}
.doc-viewer-viewport {
  flex: 1;
  overflow: auto;
  padding: 30px 20px 60px;
  display: flex;
  justify-content: safe center;
  align-items: flex-start;
}
.doc-viewer-sheet-stage {
  flex: none;
  position: relative;
  margin: 0 auto;
  background: white;
  box-shadow: 0 12px 35px #0008;
}
.doc-pdf-frame {
  width: 816px;
  height: 1056px;
  border: 0;
  display: block;
  background: white;
  transform-origin: top left;
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
@media (max-width: 760px) {
  .doc-viewer-bar {
    flex-wrap: wrap;
    padding: 8px 12px;
  }
  .doc-viewer-bar__subtitle {
    display: none;
  }
  .doc-viewer-bar__zoom-controls {
    order: 3;
    margin: auto;
  }
  .doc-viewer-viewport {
    padding: 12px;
  }
}
</style>
