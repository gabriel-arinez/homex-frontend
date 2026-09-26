<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ArchivoAdjunto } from '@/generated/api'
import { proformasService } from '../services/proformasService'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
const props = defineProps<{ proformaId: number; detalleId: number; editable: boolean }>()
const files = ref<ArchivoAdjunto[]>([]),
  previews = ref<
    Array<{ file: File; url: string; state: 'pending' | 'uploading' | 'error'; error?: string }>
  >([]),
  error = ref(''),
  deleting = ref<ArchivoAdjunto | null>(null)
async function load() {
  try {
    files.value = await proformasService.attachments(props.proformaId, props.detalleId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se cargaron las imágenes.'
  }
}
function revoke(item: { url: string }) {
  URL.revokeObjectURL(item.url)
}
function clearPreviews() {
  previews.value.forEach(revoke)
  previews.value = []
}
function select(event: Event) {
  const input = event.target as HTMLInputElement
  if (!props.editable) {
    input.value = ''
    return
  }
  for (const file of Array.from(input.files ?? [])) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error.value = `${file.name}: usa JPEG, PNG o WebP.`
      continue
    }
    previews.value.push({ file, url: URL.createObjectURL(file), state: 'pending' })
  }
  input.value = ''
}
async function upload(item: (typeof previews.value)[number]) {
  if (!props.editable) {
    item.state = 'error'
    item.error = 'La proforma ya no admite cambios.'
    return
  }
  item.state = 'uploading'
  try {
    files.value.push(await proformasService.upload(props.proformaId, props.detalleId, item.file))
    revoke(item)
    previews.value = previews.value.filter((x) => x !== item)
  } catch (e) {
    item.state = 'error'
    item.error = e instanceof Error ? e.message : 'No se pudo subir.'
  }
}
async function remove() {
  if (!deleting.value) return
  try {
    await proformasService.removeAttachment(props.proformaId, props.detalleId, deleting.value.id)
    files.value = files.value.filter((x) => x.id !== deleting.value?.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo eliminar.'
  } finally {
    deleting.value = null
  }
}
watch(
  () => props.editable,
  (editable) => {
    if (!editable) clearPreviews()
  },
)
onMounted(load)
onBeforeUnmount(clearPreviews)
</script>
<template>
  <section class="attachments">
    <div class="heading">
      <div>
        <h4>Imágenes de referencia</h4>
        <p>JPEG, PNG o WebP. Las previews locales se eliminan al salir.</p>
      </div>
      <label v-if="editable" class="picker"
        >Seleccionar imágenes<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          @change="select"
      /></label>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="previews.length" class="gallery">
      <article v-for="item in previews" :key="item.url">
        <img :src="item.url" :alt="`Preview de ${item.file.name}`" /><span>{{
          item.state === 'uploading'
            ? 'Subiendo…'
            : item.state === 'error'
              ? 'Error'
              : 'Lista para subir'
        }}</span
        ><small v-if="item.error">{{ item.error }}</small
        ><Button v-if="editable && item.state !== 'uploading'" variant="secondary" @click="upload(item)"
          >Subir</Button
        >
      </article>
    </div>
    <div v-if="files.length" class="gallery">
      <article v-for="file in files" :key="file.id">
        <a :href="file.url" target="_blank" rel="noopener"
          ><img :src="file.url" :alt="file.nombre" /></a
        ><span>{{ file.nombre }}</span
        ><a :href="file.url" download>Descargar</a
        ><Button v-if="editable" variant="danger" @click="deleting = file">Eliminar</Button>
      </article>
    </div>
    <p v-if="!files.length && !previews.length">Sin imágenes adjuntas.</p>
    <ConfirmDialog
      :open="Boolean(deleting)"
      title="Eliminar imagen"
      description="La imagen persistida se eliminará de esta línea."
      confirm-label="Eliminar"
      @close="deleting = null"
      @confirm="remove"
    />
  </section>
</template>
<style scoped>
.attachments {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-3);
}
h4,
.heading p {
  margin: 0;
}
.heading p {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.picker {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  font-weight: 700;
  cursor: pointer;
}
.picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-3);
}
article {
  display: grid;
  gap: 0.4rem;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  border-radius: var(--radius-control);
}
article span,
article small {
  overflow-wrap: anywhere;
  font-size: 0.8rem;
}
[role='alert'],
article small {
  color: var(--color-danger);
}
@media (max-width: 35rem) {
  .heading {
    display: grid;
  }
  .picker {
    text-align: center;
  }
}
</style>
