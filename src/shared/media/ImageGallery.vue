<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
    title?: string
  }>(),
  { editable: true, title: 'Galería de imágenes' },
)
const emit = defineEmits<{
  'update:modelValue': [images: LocalImage[]]
  changed: []
  busy: [value: boolean]
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
let loadVersion = 0
const loading = ref(false)
const input = ref<HTMLInputElement | null>(null)
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
  () => all.value.length,
  (length) => {
    selected.value = Math.max(0, Math.min(selected.value, length - 1))
    if (!length) viewing.value = false
  },
)
function setLocal(value: LocalImage[]) {
  if (props.endpoint) {
    pending.value = value
    void savePending(props.endpoint, value).catch(() => {
      error.value = 'No se guardó la vista previa local. Confirma la carga antes de salir.'
    })
  } else emit('update:modelValue', value)
  emit('changed')
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
      if (path !== props.endpoint || !props.editable) return
      next.push({
        file,
        digest,
        url: URL.createObjectURL(file),
        principal: images.value.length + next.length === 0,
      })
    }
    setLocal(next)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron preparar las imágenes.'
  } finally {
    selecting.value = false
  }
}

async function pick(event: Event) {
  const target = event.target as HTMLInputElement
  await select(Array.from(target.files ?? []))
  target.value = ''
}
function drop(event: DragEvent) {
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
      if (props.endpoint !== path) continue
      images.value = result.imagenes
      pending.value = [...remaining]
      progress.value++
      emit('changed')
    }
    return true
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'No se pudo cargar. Reintenta las imágenes pendientes.'
    return false
  } finally {
    busy.value = false
    emit('busy', false)
  }
}
async function change(data: { principal?: number; orden?: number[]; eliminar?: number }) {
  if (!props.endpoint || busy.value || !props.editable) return
  busy.value = true
  emit('busy', true)
  try {
    images.value = (await galleryService.change(props.endpoint, data)).imagenes
    emit('changed')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se guardó el cambio.'
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
  return (index < saved) === (target < saved)
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
  selected.value = (selected.value + offset + all.value.length) % all.value.length
  zoom.value = 1
}
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
        >Agregar imágenes</Button
      ><Button
        type="button"
        variant="secondary"
        :disabled="loading || busy || selecting"
        @click="managing = true"
        >Gestionar imágenes</Button
      >
    </div>
    <p v-if="editable" class="hint">
      Arrastra imágenes aquí · JPEG, PNG o WebP · 10 MiB por archivo.
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="endpoint && pending.length" class="pending">
      <p>{{ pending.length }} imágenes listas para confirmar.</p>
      <Button type="button" :disabled="loading || busy || selecting" @click="upload">{{
        busy ? 'Cargando…' : 'Confirmar carga / Reintentar'
      }}</Button>
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
    <Modal :open="viewing" title="Visor de imágenes" wide @close="viewing = false"
      ><div
        class="viewer"
        tabindex="0"
        @keydown.left.prevent="navigate(-1)"
        @keydown.right.prevent="navigate(1)"
      >
        <div v-if="current" class="large" :style="{ '--zoom': zoom }">
          <GalleryPhoto :src="current.url" :alt="current.nombre" />
        </div>
        <div class="actions">
          <Button type="button" variant="secondary" @click="navigate(-1)">Anterior</Button
          ><span>{{ selected + 1 }}/{{ all.length }}</span
          ><Button type="button" variant="secondary" @click="navigate(1)">Siguiente</Button
          ><label
            >Zoom <input v-model.number="zoom" type="range" min="1" max="3" step="0.25"
          /></label>
        </div>
        <div class="thumbs">
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
}
.large :deep(img) {
  transform: scale(var(--zoom));
  transform-origin: top left;
}
.viewer {
  display: grid;
  gap: 1rem;
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
