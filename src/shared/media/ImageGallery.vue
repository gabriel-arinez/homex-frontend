<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
import Modal from '@/shared/ui/Modal.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import GalleryPhoto from './GalleryPhoto.vue'
import { loadPending, savePending } from './pending'
import { galleryService, type GalleryImage, type LocalImage } from './gallery'
const props = withDefaults(
  defineProps<{
    endpoint?: string
    editable?: boolean
    modelValue?: LocalImage[]
    preservePending?: boolean
    streamlined?: boolean
    title?: string
  }>(),
  { editable: true, title: 'Galería de imágenes' },
)
const emit = defineEmits<{
  'update:modelValue': [images: LocalImage[]]
  changed: []
  busy: [value: boolean]
  status: [value: { confirmed: number; pending: number; busy: boolean; error: boolean }]
}>()
const images = ref<GalleryImage[]>([]),
  pending = ref<LocalImage[]>([]),
  limit = ref(8),
  error = ref(''),
  busy = ref(false),
  progress = ref(0),
  managing = ref(false),
  viewing = ref(false),
  zoom = ref(1),
  selected = ref(0),
  deleting = ref<number | null>(null)
const totalUploads = ref(0)
const selecting = ref(false)
const dropActive = ref(false)
let loadVersion = 0
let alive = true
const loading = ref(false)
const input = ref<HTMLInputElement | null>(null)
const imageViewport = ref<HTMLElement | null>(null)
const dragging = ref(false)
let dragStart: { x: number; y: number; left: number; top: number; pointer: number } | null = null
const local = computed(() => (props.endpoint ? pending.value : (props.modelValue ?? [])))
const all = computed(() => [
  ...images.value.map((i) => ({
    key: String(i.id),
    url: i.url,
    nombre: i.nombre,
    principal: i.principal,
  })),
  ...local.value.map((i) => ({
    key: i.digest,
    url: i.url,
    nombre: i.file.name,
    principal: i.principal,
  })),
])
const cover = computed(() => all.value.find((i) => i.principal) ?? all.value[0])
const current = computed(() => all.value[selected.value] ?? all.value[0])
watch(
  [() => images.value.length, () => local.value.length, busy, error],
  () =>
    emit('status', {
      confirmed: images.value.length,
      pending: local.value.length,
      busy: busy.value,
      error: Boolean(error.value),
    }),
  { immediate: true },
)
watch(
  () => all.value.length,
  (length) => {
    selected.value = Math.max(0, Math.min(selected.value, length - 1))
    if (!length) viewing.value = false
  },
)
function setLocal(value: LocalImage[]): Promise<boolean> {
  let persisted: Promise<boolean> = Promise.resolve(true)
  if (props.endpoint) {
    const path = props.endpoint
    pending.value = value
    persisted = savePending(path, value)
      .then(() => true)
      .catch(() => {
        if (alive && props.endpoint === path)
          error.value = props.streamlined
            ? 'No se guardó la vista previa local. Reintenta la carga antes de salir.'
            : 'No se guardó la vista previa local. Confirma la carga antes de salir.'
        return false
      })
  } else emit('update:modelValue', value)
  emit('changed')
  return persisted
}
watch(
  () => props.endpoint,
  async (path) => {
    const version = ++loadVersion
    loading.value = Boolean(path)
    pending.value.forEach((i) => URL.revokeObjectURL(i.url))
    pending.value = []
    images.value = []
    error.value = ''
    if (path)
      try {
        const result = await galleryService.list(path)
        if (version !== loadVersion) return
        images.value = result.imagenes
        limit.value = result.limite
        if (props.editable) {
          const restored = await loadPending(path).catch(() => [])
          if (version === loadVersion) pending.value = restored
          else restored.forEach((i) => URL.revokeObjectURL(i.url))
        }
      } catch (e) {
        if (version === loadVersion)
          error.value = e instanceof Error ? e.message : 'No se cargó la galería.'
      } finally {
        if (version === loadVersion) loading.value = false
      }
  },
  { immediate: true },
)
async function select(files: File[]) {
  if (loading.value || busy.value || selecting.value || !props.editable) return
  selecting.value = true
  const path = props.endpoint
  const next = [...local.value]
  const originalCount = next.length
  const created: string[] = []
  let staged = false
  let selectionError = ''
  error.value = ''
  try {
    for (const file of files) {
      if (images.value.length + next.length >= limit.value) {
        error.value = `Máximo ${limit.value} imágenes.`
        break
      }
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      ) {
        error.value = `${file.name}: usa JPEG, PNG o WebP de hasta 10 MiB.`
        continue
      }
      const bytes =
        typeof file.arrayBuffer === 'function'
          ? await file.arrayBuffer()
          : await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as ArrayBuffer)
              reader.onerror = () => reject(reader.error)
              reader.readAsArrayBuffer(file)
            })
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('')
      if (next.some((i) => i.digest === digest) || images.value.some((i) => i.sha256 === digest)) {
        error.value = `${file.name}: imagen duplicada.`
        continue
      }
      if (!alive || path !== props.endpoint || !props.editable) {
        created.forEach((url) => URL.revokeObjectURL(url))
        return
      }
      const url = URL.createObjectURL(file)
      created.push(url)
      next.push({
        file,
        digest,
        url,
        principal: images.value.length + next.length === 0,
      })
    }
    selectionError = error.value
    staged = await setLocal(next)
  } catch (cause) {
    created.forEach((url) => URL.revokeObjectURL(url))
    error.value = cause instanceof Error ? cause.message : 'No se pudieron preparar las imágenes.'
  } finally {
    selecting.value = false
  }
  if (
    alive &&
    props.streamlined &&
    path &&
    path === props.endpoint &&
    props.editable &&
    staged &&
    next.length > originalCount
  ) {
    const saved = await upload()
    if (alive && saved && path === props.endpoint && selectionError) error.value = selectionError
  }
}

async function pick(event: Event) {
  const target = event.target as HTMLInputElement
  await select(Array.from(target.files ?? []))
  target.value = ''
}
function drop(event: DragEvent) {
  dropActive.value = false
  void select(Array.from(event.dataTransfer?.files ?? []))
}
async function upload() {
  if (!props.endpoint || busy.value || selecting.value) return !busy.value && !selecting.value
  busy.value = true
  emit('busy', true)
  error.value = ''
  progress.value = 0
  const path = props.endpoint
  const items = [...pending.value]
  totalUploads.value = items.length
  const remaining = [...items]
  try {
    for (const item of items) {
      const result = await galleryService.upload(path, item.file, item.digest)
      remaining.shift()
      await savePending(path, remaining)
      URL.revokeObjectURL(item.url)
      if (!alive || props.endpoint !== path) return false
      images.value = result.imagenes
      pending.value = [...remaining]
      progress.value++
      emit('changed')
    }
    return true
  } catch (e) {
    if (alive && props.endpoint === path)
      error.value =
        e instanceof Error ? e.message : 'No se pudo cargar. Reintenta las imágenes pendientes.'
    return false
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
async function change(data: { principal?: number; orden?: number[]; eliminar?: number }) {
  if (!props.endpoint || busy.value || !props.editable) return false
  const path = props.endpoint
  busy.value = true
  emit('busy', true)
  try {
    const result = await galleryService.change(path, data)
    if (!alive || props.endpoint !== path) return false
    images.value = result.imagenes
    error.value = ''
    emit('changed')
    return true
  } catch (e) {
    if (alive && props.endpoint === path)
      error.value = e instanceof Error ? e.message : 'No se guardó el cambio.'
    return false
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
function primary(index: number) {
  if (!props.editable) return
  if (index < images.value.length) void change({ principal: images.value[index]!.id })
  else if (!props.endpoint) setLocal(local.value.map((i, n) => ({ ...i, principal: n === index })))
}
function canMove(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= all.value.length) return false
  if (!props.endpoint) return true
  // La API sólo acepta ordenar imágenes persistidas; no mezclar ambos grupos todavía.
  const saved = images.value.length
  return index < saved === target < saved
}
function move(index: number, offset: number) {
  if (!props.editable || busy.value || !canMove(index, offset)) return
  const target = index + offset
  if (props.endpoint && index < images.value.length) {
    const ids = images.value.map((i) => i.id)
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    void change({ orden: ids })
    return
  }
  const first = props.endpoint ? index - images.value.length : index
  const second = props.endpoint ? target - images.value.length : target
  const next = [...local.value]
  ;[next[first], next[second]] = [next[second]!, next[first]!]
  setLocal(next)
}
async function moveCurrent(offset: number) {
  const index = selected.value
  if (!canMove(index, offset) || busy.value || !props.editable) return
  const key = current.value?.key
  if (!key) return
  if (props.endpoint && index < images.value.length) {
    const ids = images.value.map((item) => item.id)
    const target = index + offset
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    if (!(await change({ orden: ids }))) return
  } else {
    move(index, offset)
    await nextTick()
  }
  const nextIndex = all.value.findIndex((item) => item.key === key)
  if (nextIndex >= 0) selected.value = nextIndex
}
function remove() {
  if (!props.editable) return
  const index = deleting.value
  deleting.value = null
  if (index === null) return
  if (index < images.value.length) {
    void change({ eliminar: images.value[index]!.id })
    return
  }
  const remaining = [...local.value],
    [removed] = remaining.splice(index - images.value.length, 1)
  if (removed) URL.revokeObjectURL(removed.url)
  if (!props.endpoint && !remaining.some((i) => i.principal) && remaining[0])
    remaining[0].principal = true
  setLocal(remaining)
}
function show(index: number) {
  selected.value = index
  viewing.value = true
  zoom.value = 1
}
function showCover() {
  show(
    Math.max(
      0,
      all.value.findIndex((i) => i.key === cover.value?.key),
    ),
  )
}
function thumbnail(index: number) {
  selected.value = index
  zoom.value = 1
}
function navigate(offset: number) {
  if (!all.value.length) return
  selected.value = (selected.value + offset + all.value.length) % all.value.length
  zoom.value = 1
}
function changeZoom(delta: number) {
  zoom.value = Math.min(3, Math.max(1, zoom.value + delta))
}
function startPan(event: PointerEvent) {
  if (zoom.value <= 1 || event.pointerType !== 'mouse' || event.button !== 0) return
  const viewport = imageViewport.value
  if (!viewport) return
  event.preventDefault()
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    left: viewport.scrollLeft,
    top: viewport.scrollTop,
    pointer: event.pointerId,
  }
  dragging.value = true
  viewport.setPointerCapture(event.pointerId)
}
function movePan(event: PointerEvent) {
  const viewport = imageViewport.value
  if (!viewport || !dragStart || dragStart.pointer !== event.pointerId) return
  viewport.scrollLeft = dragStart.left - (event.clientX - dragStart.x)
  viewport.scrollTop = dragStart.top - (event.clientY - dragStart.y)
}
function endPan(event: PointerEvent) {
  if (dragStart?.pointer !== event.pointerId) return
  dragStart = null
  dragging.value = false
}
watch([selected, viewing], () => {
  dragStart = null
  dragging.value = false
  void nextTick(() => {
    imageViewport.value?.scrollTo?.({ left: 0, top: 0 })
  })
})
watch(
  () => props.editable,
  (editable) => {
    if (!editable && !props.preservePending) {
      managing.value = false
      deleting.value = null
      pending.value.forEach((i) => URL.revokeObjectURL(i.url))
      pending.value = []
    }
  },
)
onBeforeUnmount(() => {
  alive = false
  loadVersion++
  local.value.forEach((i) => URL.revokeObjectURL(i.url))
})
defineExpose({ flush: upload, count: computed(() => all.value.length) })
</script>
<template>
  <section class="image-gallery" :aria-label="title" @dragover.prevent @drop.prevent="drop">
    <h3>
      {{ title }} <small>{{ all.length }}/{{ limit }}</small>
    </h3>
    <button
      v-if="cover"
      type="button"
      class="hero"
      aria-label="Ampliar imagen principal"
      @click="showCover"
    >
      <GalleryPhoto :src="cover.url" :alt="cover.nombre" />
    </button>
    <p v-else class="empty">Sin imágenes. Puedes guardar sin adjuntar fotografías.</p>
    <div class="thumbs">
      <button
        v-for="(item, index) in all"
        :key="item.key"
        type="button"
        :aria-label="`Ver ${item.nombre}`"
        @click="show(index)"
      >
        <GalleryPhoto :src="item.url" :alt="item.nombre" />
      </button>
    </div>
    <div v-if="editable" class="actions">
      <div
        v-if="streamlined"
        class="drop-zone"
        :class="{ 'drop-zone--active': dropActive }"
        @dragenter.prevent="dropActive = true"
        @dragover.prevent
        @dragleave="dropActive = false"
        @drop.stop.prevent="drop"
      >
        <ImagePlus :size="24" aria-hidden="true" />
        <strong>Arrastra imágenes aquí</strong>
        <span>JPEG, PNG o WebP · hasta 10 MiB por archivo</span>
      </div>
      <input
        ref="input"
        class="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-label="Agregar imágenes"
        :disabled="loading || busy || selecting"
        @change="pick"
      /><Button
        type="button"
        variant="secondary"
        :disabled="loading || busy || selecting || all.length >= limit"
        @click="input?.click()"
        ><ImagePlus v-if="streamlined" :size="16" aria-hidden="true" />Agregar imágenes</Button
      ><Button
        v-if="!streamlined"
        type="button"
        variant="secondary"
        :disabled="loading || busy || selecting"
        @click="managing = true"
        >Gestionar imágenes</Button
      >
    </div>
    <p v-if="editable && !streamlined" class="hint">
      Arrastra imágenes aquí · JPEG, PNG o WebP · 10 MiB por archivo.
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="endpoint && pending.length" class="pending">
      <p>
        {{ pending.length }}
        {{ streamlined ? 'imágenes pendientes de carga.' : 'imágenes listas para confirmar.' }}
      </p>
      <Button
        v-if="!streamlined || (!busy && !selecting)"
        type="button"
        :disabled="loading || busy || selecting"
        @click="upload"
        >{{
          busy ? 'Cargando…' : streamlined ? 'Reintentar carga' : 'Confirmar carga / Reintentar'
        }}</Button
      >
    </div>
    <p v-if="busy" role="status">
      Guardando imágenes… {{ progress }}/{{ totalUploads }}
      <progress
        v-if="totalUploads"
        :value="progress"
        :max="totalUploads"
        aria-label="Progreso de carga"
      />
    </p>
    <Modal :open="managing" title="Gestionar imágenes" wide @close="managing = false"
      ><div class="cards">
        <article v-for="(item, index) in all" :key="item.key">
          <div class="preview"><GalleryPhoto :src="item.url" :alt="item.nombre" /></div>
          <p>{{ item.nombre }}</p>
          <strong v-if="item.principal">Principal</strong>
          <div v-if="editable" class="actions">
            <Button
              type="button"
              variant="secondary"
              :disabled="busy || (Boolean(endpoint) && index >= images.length)"
              @click="primary(index)"
              >Establecer principal</Button
            ><Button
              type="button"
              variant="secondary"
              :disabled="busy || !canMove(index, -1)"
              aria-label="Mover antes"
              @click="move(index, -1)"
              >←</Button
            ><Button
              type="button"
              variant="secondary"
              :disabled="busy || !canMove(index, 1)"
              aria-label="Mover después"
              @click="move(index, 1)"
              >→</Button
            ><Button
              type="button"
              variant="danger"
              :disabled="loading || busy || selecting"
              @click="deleting = index"
              >Eliminar</Button
            >
          </div>
        </article>
      </div>
      <p v-if="endpoint && pending.length" class="hint">
        Puedes ordenar las imágenes pendientes entre sí. Confirma su carga para mezclarlas con las
        ya guardadas y cambiar la portada.
      </p>
      <p v-if="!all.length">Sin imágenes.</p></Modal
    >
    <Modal
      :open="viewing"
      title="Visor de imágenes"
      extra-wide
      sticky-frame
      @close="viewing = false"
      ><div
        class="viewer"
        :class="{ 'viewer--streamlined': streamlined }"
        tabindex="0"
        @keydown.left.self.prevent="navigate(-1)"
        @keydown.right.self.prevent="navigate(1)"
      >
        <div
          v-if="current"
          ref="imageViewport"
          class="large"
          :class="{ 'large--zoomed': zoom > 1, 'large--dragging': dragging }"
          :style="{ '--zoom': zoom }"
          tabindex="0"
          aria-label="Imagen ampliable; usa las flechas para desplazarte cuando haya zoom"
          @pointerdown="startPan"
          @pointermove="movePan"
          @pointerup="endPan"
          @pointercancel="endPan"
          @lostpointercapture="endPan"
        >
          <div class="zoom-canvas">
            <GalleryPhoto :src="current.url" :alt="current.nombre" />
          </div>
        </div>
        <div v-if="streamlined" class="thumbs">
          <button
            v-for="(item, index) in all"
            :key="item.key"
            type="button"
            :aria-label="`Ver ${item.nombre}`"
            :aria-pressed="selected === index"
            @click="thumbnail(index)"
          >
            <GalleryPhoto :src="item.url" :alt="item.nombre" />
          </button>
        </div>
        <div class="viewer-toolbar">
          <div class="viewer-navigation" aria-label="Navegación de imágenes">
            <Button
              type="button"
              variant="secondary"
              :disabled="all.length < 2"
              @click="navigate(-1)"
              ><ChevronLeft :size="16" aria-hidden="true" />Anterior</Button
            >
            <span aria-live="polite">{{ selected + 1 }} / {{ all.length }}</span>
            <Button
              type="button"
              variant="secondary"
              :disabled="all.length < 2"
              @click="navigate(1)"
              >Siguiente<ChevronRight :size="16" aria-hidden="true"
            /></Button>
          </div>
          <div class="viewer-zoom">
            <Button
              type="button"
              variant="secondary"
              aria-label="Reducir zoom"
              :disabled="zoom <= 1"
              @click="changeZoom(-0.25)"
              ><ZoomOut :size="17" aria-hidden="true"
            /></Button>
            <label
              >Zoom <input v-model.number="zoom" type="range" min="1" max="3" step="0.25"
            /></label>
            <span aria-live="polite">{{ Math.round(zoom * 100) }} %</span>
            <Button
              type="button"
              variant="secondary"
              aria-label="Aumentar zoom"
              :disabled="zoom >= 3"
              @click="changeZoom(0.25)"
              ><ZoomIn :size="17" aria-hidden="true"
            /></Button>
          </div>
          <div
            v-if="streamlined && editable && current"
            class="viewer-management"
            role="group"
            aria-label="Gestionar imagen seleccionada"
          >
            <div class="viewer-management-actions">
              <Button
                type="button"
                variant="secondary"
                :disabled="
                  loading ||
                  busy ||
                  selecting ||
                  current.principal ||
                  (Boolean(endpoint) && selected >= images.length)
                "
                @click="primary(selected)"
              >
                <Star :size="16" aria-hidden="true" /> Establecer principal
              </Button>
              <span class="viewer-order-label">Orden</span>
              <Button
                type="button"
                variant="secondary"
                aria-label="Mover imagen antes"
                title="Mover imagen antes"
                :disabled="loading || busy || selecting || !canMove(selected, -1)"
                @click="moveCurrent(-1)"
                ><ArrowLeft :size="17" aria-hidden="true"
              /></Button>
              <Button
                type="button"
                variant="secondary"
                aria-label="Mover imagen después"
                title="Mover imagen después"
                :disabled="loading || busy || selecting || !canMove(selected, 1)"
                @click="moveCurrent(1)"
                ><ArrowRight :size="17" aria-hidden="true"
              /></Button>
              <Button
                type="button"
                variant="danger"
                aria-label="Eliminar imagen"
                title="Eliminar imagen"
                :disabled="loading || busy || selecting"
                @click="deleting = selected"
                ><Trash2 :size="17" aria-hidden="true"
              /></Button>
            </div>
          </div>
        </div>
        <p v-if="zoom > 1" class="viewer-hint">
          Arrastra la imagen o usa las barras de desplazamiento y las flechas del teclado.
        </p>
        <div v-if="streamlined && current" class="viewer-file">
          <strong>{{ current.nombre }}</strong>
          <span v-if="current.principal">Imagen principal</span>
        </div>
        <p v-if="streamlined && error" role="alert">{{ error }}</p>
        <div v-if="!streamlined" class="thumbs">
          <button
            v-for="(item, index) in all"
            :key="item.key"
            type="button"
            :aria-label="`Ver ${item.nombre}`"
            :aria-pressed="selected === index"
            @click="thumbnail(index)"
          >
            <GalleryPhoto :src="item.url" :alt="item.nombre" />
          </button>
        </div></div
    ></Modal>
    <ConfirmDialog
      :open="deleting !== null"
      title="Eliminar imagen"
      description="La imagen se eliminará de esta galería."
      confirm-label="Eliminar"
      @close="deleting = null"
      @confirm="remove"
    />
  </section>
</template>
<style scoped>
.image-gallery {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
h3,
p {
  margin: 0;
}
h3 small,
.hint {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.hero {
  width: 100%;
  height: 20rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-background);
  cursor: zoom-in;
}
.thumbs {
  display: flex;
  gap: 0.5rem;
  overflow: auto;
}
.thumbs button {
  flex: 0 0 4rem;
  height: 4rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  cursor: pointer;
}
.actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.drop-zone {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-3);
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-control);
  color: var(--color-text-secondary);
  text-align: center;
  font-size: 0.8rem;
}
.drop-zone svg {
  color: var(--color-primary-accent);
}
.drop-zone strong {
  color: var(--color-text);
  font-size: 0.9rem;
}
.drop-zone--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.empty {
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-card);
  color: var(--color-text-secondary);
}
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1rem;
}
.cards article {
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  display: grid;
  gap: 0.75rem;
  overflow-wrap: anywhere;
}
.preview {
  height: 10rem;
}
.large {
  height: min(55vh, 36rem);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-background);
  overscroll-behavior: contain;
}
.large:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.large--zoomed {
  cursor: grab;
}
.large--dragging {
  cursor: grabbing;
  user-select: none;
}
.zoom-canvas {
  width: calc(100% * var(--zoom));
  height: calc(min(55vh, 36rem) * var(--zoom));
}
.zoom-canvas :deep(img) {
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}
.viewer {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
.viewer--streamlined {
  grid-template-columns: minmax(0, 1fr) 4.5rem;
  grid-template-areas:
    'image thumbnails'
    'toolbar toolbar'
    'hint hint'
    'file file'
    'error error';
}
.viewer--streamlined > .large {
  grid-area: image;
  min-width: 0;
}
.viewer--streamlined > .thumbs {
  grid-area: thumbnails;
  flex-direction: column;
  max-height: min(55vh, 36rem);
  overflow-x: hidden;
  overflow-y: auto;
}
.viewer--streamlined > .thumbs button {
  width: 4rem;
}
.viewer--streamlined > .viewer-toolbar {
  grid-area: toolbar;
}
.viewer--streamlined > .viewer-hint {
  grid-area: hint;
}
.viewer--streamlined > .viewer-file {
  grid-area: file;
}
.viewer--streamlined > [role='alert'] {
  grid-area: error;
}
@media (max-width: 48rem) {
  .viewer--streamlined {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'image'
      'thumbnails'
      'toolbar'
      'hint'
      'file'
      'error';
  }
  .viewer--streamlined > .thumbs {
    flex-direction: row;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
  }
}
.viewer-toolbar,
.viewer-navigation,
.viewer-zoom {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.viewer-toolbar {
  justify-content: space-between;
}
.viewer-navigation span,
.viewer-zoom span {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  white-space: nowrap;
}
.viewer-zoom label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.viewer-zoom input {
  width: 8rem;
  accent-color: var(--color-primary);
}
.viewer-hint {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.viewer-management {
  display: flex;
  align-items: center;
  min-width: 0;
}
.viewer-file {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-1);
  min-width: 0;
  overflow-wrap: anywhere;
}
.viewer-file span {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.viewer-management-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.viewer-order-label {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.viewer .thumbs button[aria-pressed='true'] {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
[role='alert'] {
  color: var(--color-danger);
}
button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}
@media (max-width: 40rem) {
  .hero {
    height: 15rem;
  }
}
</style>
