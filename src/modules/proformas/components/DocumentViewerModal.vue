<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Printer, Download, X, ZoomIn, ZoomOut, Maximize2, FileText } from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'

export interface DocumentViewerModalProps {
  open: boolean
  title?: string
  subtitle?: string
  downloading?: boolean
  canDownloadPdf?: boolean
}

const props = withDefaults(defineProps<DocumentViewerModalProps>(), {
  title: 'Documento comercial',
  subtitle: 'Vista previa de impresión · Tamaño Carta (216 × 279 mm)',
  downloading: false,
  canDownloadPdf: true,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'download'): void
}>()

const zoom = ref(1)
const viewportRef = ref<HTMLElement | null>(null)

function zoomIn() {
  if (zoom.value < 1.8) {
    zoom.value = Math.min(1.8, Math.round((zoom.value + 0.1) * 10) / 10)
  }
}

function zoomOut() {
  if (zoom.value > 0.4) {
    zoom.value = Math.max(0.4, Math.round((zoom.value - 0.1) * 10) / 10)
  }
}

function resetZoom() {
  zoom.value = 1
}

function fitWidth() {
  if (!viewportRef.value) return
  const availableWidth = viewportRef.value.clientWidth - 48
  // 216mm ~ 816px a 96dpi
  const sheetWidthPx = 816
  const targetZoom = Math.min(1.2, Math.max(0.45, availableWidth / sheetWidthPx))
  zoom.value = Math.round(targetZoom * 100) / 100
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    emit('close')
  }
}

function printDocument() {
  window.print()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Ajustar automáticamente si la pantalla es menor a 900px
      if (typeof window !== 'undefined' && window.innerWidth < 900) {
        fitWidth()
      } else {
        zoom.value = 1
      }
    } else {
      document.body.style.overflow = ''
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="doc-viewer-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.self="emit('close')"
    >
      <!-- Barra superior de herramientas fija -->
      <header class="doc-viewer-bar no-print">
        <div class="doc-viewer-bar__identity">
          <span class="doc-viewer-bar__icon" aria-hidden="true">
            <FileText :size="20" />
          </span>
          <div class="doc-viewer-bar__titles">
            <h2 class="doc-viewer-bar__title">{{ title }}</h2>
            <p v-if="subtitle" class="doc-viewer-bar__subtitle">{{ subtitle }}</p>
          </div>
        </div>

        <!-- Controles de Zoom -->
        <div class="doc-viewer-bar__zoom-controls" aria-label="Controles de escala y zoom">
          <button
            type="button"
            class="zoom-btn"
            title="Reducir zoom"
            aria-label="Reducir zoom"
            :disabled="zoom <= 0.4"
            @click="zoomOut"
          >
            <ZoomOut :size="16" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="zoom-display"
            title="Restablecer zoom a 100%"
            aria-label="Restablecer escala al 100%"
            @click="resetZoom"
          >
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
            <ZoomIn :size="16" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="zoom-btn zoom-btn--text"
            title="Ajustar al ancho disponible"
            aria-label="Ajustar al ancho"
            @click="fitWidth"
          >
            <Maximize2 :size="14" aria-hidden="true" />
            <span>Ajustar</span>
          </button>
        </div>

        <!-- Acciones principales -->
        <div class="doc-viewer-bar__actions">
          <Button
            type="button"
            variant="secondary"
            class="doc-action-btn"
            title="Imprimir documento (Ctrl+P)"
            @click="printDocument"
          >
            <Printer :size="16" aria-hidden="true" />
            <span>Imprimir</span>
          </Button>

          <Button
            v-if="canDownloadPdf"
            type="button"
            variant="secondary"
            class="doc-action-btn"
            :processing="downloading"
            title="Descargar en formato PDF"
            @click="emit('download')"
          >
            <Download :size="16" aria-hidden="true" />
            <span>Descargar PDF</span>
          </Button>

          <button
            type="button"
            class="doc-close-btn"
            aria-label="Cerrar visor de documento"
            title="Cerrar (Esc)"
            @click="emit('close')"
          >
            <X :size="20" aria-hidden="true" />
          </button>
        </div>
      </header>

      <!-- Escenario central de lectura y navegación con fondo oscuro -->
      <main ref="viewportRef" class="doc-viewer-viewport" @click.self="emit('close')">
        <div
          class="doc-viewer-sheet-stage"
          :style="{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
          }"
        >
          <slot />
        </div>
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
  background-color: rgba(9, 9, 11, 0.94);
  backdrop-filter: blur(8px);
  color: #f4f4f5;
  overflow: hidden;
}

/* Barra superior */
.doc-viewer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  background-color: #18181b;
  border-bottom: 1px solid #27272a;
  z-index: 10;
  flex-shrink: 0;
}

.doc-viewer-bar__identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.doc-viewer-bar__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background-color: #27272a;
  color: #ef4444;
  flex-shrink: 0;
}

.doc-viewer-bar__titles {
  min-width: 0;
}

.doc-viewer-bar__title {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-viewer-bar__subtitle {
  font-size: 11px;
  color: #a1a1aa;
  margin: 2px 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Zoom controls */
.doc-viewer-bar__zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: #27272a;
  padding: 3px 6px;
  border-radius: 8px;
  border: 1px solid #3f3f46;
}

.zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 28px;
  height: 28px;
  border-radius: 5px;
  background: transparent;
  border: none;
  color: #d4d4d8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.zoom-btn--text {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
}

.zoom-btn:hover:not(:disabled) {
  background-color: #3f3f46;
  color: #ffffff;
}

.zoom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.zoom-display {
  background: transparent;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: #f4f4f5;
  padding: 0 6px;
  cursor: pointer;
  min-width: 44px;
  text-align: center;
}

.zoom-display:hover {
  color: #ffffff;
  text-decoration: underline;
}

/* Acciones principales */
.doc-viewer-bar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.doc-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  height: 34px;
}

.doc-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background-color: #27272a;
  border: 1px solid #3f3f46;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-left: 6px;
}

.doc-close-btn:hover {
  background-color: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
}

/* Viewport central */
.doc-viewer-viewport {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 30px 20px 60px 20px;
  scroll-behavior: smooth;
}

.doc-viewer-sheet-stage {
  transition: transform 0.15s ease-out;
  display: inline-block;
  margin-bottom: 40px;
}

/* Responsive */
@media (max-width: 768px) {
  .doc-viewer-bar {
    padding: 8px 12px;
    flex-wrap: wrap;
  }
  .doc-viewer-bar__subtitle {
    display: none;
  }
  .zoom-btn--text span {
    display: none;
  }
}

/* Impresión */
@media print {
  .no-print {
    display: none !important;
  }
  .doc-viewer-overlay {
    position: static !important;
    background: transparent !important;
    backdrop-filter: none !important;
    overflow: visible !important;
    color: #000000 !important;
  }
  .doc-viewer-viewport {
    padding: 0 !important;
    overflow: visible !important;
  }
  .doc-viewer-sheet-stage {
    transform: none !important;
    margin: 0 !important;
  }
}
</style>
