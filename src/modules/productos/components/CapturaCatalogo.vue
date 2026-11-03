<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import type {
  CamposCatalogo,
  CategoriaEnum,
  ResultadoCatalogo,
  ValorCatalogoPublico,
} from '@/generated/api'
import AudioRecorder from '@/modules/capturas/components/AudioRecorder.vue'
import Button from '@/shared/ui/Button.vue'
import { catalogoCapturaService } from '../services/catalogoCapturaService'

const props = defineProps<{
  categoria: CategoriaEnum
  opciones?: Record<string, ValorCatalogoPublico[]>
}>()
const emit = defineEmits<{ apply: [fields: CamposCatalogo] }>()
const recorder = ref<InstanceType<typeof AudioRecorder> | null>(null)
const recording = ref(false)
const processing = ref(false)
const text = ref('')
const original = ref('')
const audio = ref<Blob | null>(null)
const result = ref<ResultadoCatalogo | null>(null)
const error = ref('')
const session = crypto.randomUUID()
let controller: AbortController | null = null
let generation = 0
function cancel() {
  generation++
  controller?.abort()
  processing.value = false
}
onBeforeUnmount(cancel)
async function startRecording() {
  result.value = null
  recording.value = true
  // The existing recorder owns permission, recording, stop, cancel and cleanup.
  await nextTick()
  await recorder.value?.startRecording()
}
async function interpret(useAudio = false) {
  cancel()
  const current = generation
  const abort = new AbortController()
  controller = abort
  processing.value = true
  error.value = ''
  const origin = result.value?.id
  result.value = null
  try {
    const accepted = await catalogoCapturaService.create(
      {
        clave_idempotencia: crypto.randomUUID(),
        sesion_borrador: session,
        categoria: props.categoria,
        captura_origen: origin,
        ...(useAudio ? { audio: audio.value! } : { texto: text.value }),
      },
      abort.signal,
    )
    const deadline = Date.now() + 180_000
    while (!abort.signal.aborted && generation === current) {
      const response = await catalogoCapturaService.get(accepted.id, abort.signal)
      if (generation !== current) return
      if (response.texto_transcrito_original) {
        text.value = response.texto_transcrito_original
        if (useAudio || !original.value) original.value = response.texto_transcrito_original
      }
      if (['COMPLETADA', 'ERROR'].includes(response.estado)) {
        result.value = response
        if (response.estado === 'ERROR')
          error.value = 'No se obtuvo una propuesta. Puedes corregir el texto y reintentar.'
        return
      }
      if (Date.now() >= deadline)
        throw new Error('El procesamiento sigue pendiente. Puedes reintentar.')
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer)
          abort.signal.removeEventListener('abort', done)
          resolve()
        }
        const timer = setTimeout(done, 750)
        abort.signal.addEventListener('abort', done, { once: true })
      })
    }
  } catch (cause) {
    if (!abort.signal.aborted)
      error.value = cause instanceof Error ? cause.message : 'No se pudo procesar el audio.'
  } finally {
    if (generation === current) processing.value = false
  }
}
const labels: Record<string, string> = {
  nombre: 'Nombre comercial',
  observaciones: 'Descripción / observaciones',
  precio_lista: 'Precio de lista (BOB)',
  unidad_stock: 'Unidad comercial',
  marca: 'Marca',
  modelo: 'Modelo',
  color_primario: 'Color primario',
  color_secundario: 'Color secundario',
  especificaciones: 'Características',
  tipo: 'Tipo de piso',
  material: 'Material',
  diseno: 'Diseño',
  acabado: 'Acabado',
  espesor_mm: 'Espesor (mm)',
  largo_mm: 'Largo (mm)',
  ancho_mm: 'Ancho (mm)',
  m2_por_caja: 'm² por caja (informativo)',
}
function displayValue(field: string, value: unknown) {
  const concepts: Record<string, string> = {
    unidad_stock: 'UNIDAD_MEDIDA',
    marca: 'MARCA',
    color_primario: 'COLOR',
    color_secundario: 'COLOR',
    tipo: 'TIPO_PISO',
    material: 'MATERIAL_PISO',
    diseno: 'DISENO_PISO',
    acabado: 'ACABADO_PISO',
  }
  if (concepts[field])
    return (
      props.opciones?.[concepts[field]]?.find((option) => option.id === value)?.nombre ??
      'Valor pendiente de revisión'
    )
  if (value && typeof value === 'object')
    return Object.entries(value)
      .map(([key, item]) => `${key.replace(/_/g, ' ')}: ${item}`)
      .join('; ')
  return value
}
function upload(event: Event) {
  result.value = null
  audio.value = (event.target as HTMLInputElement).files?.[0] ?? null
}
</script>
<template>
  <section
    class="voice-catalog"
    aria-label="Autocompletar producto por voz"
    :aria-busy="processing"
  >
    <h2>Descripción por voz</h2>
    <p>Revisa los campos antes de aplicarlos. El producto se guarda mediante Guardar producto.</p>
    <Button :disabled="processing" @click="startRecording">Grabar descripción</Button>
    <AudioRecorder v-if="recording && !processing" ref="recorder" @ready="audio = $event" />
    <label
      >Subir audio<input
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
        :disabled="processing"
        @change="upload"
    /></label>
    <Button :disabled="!audio || processing" @click="interpret(true)">Procesar audio</Button>
    <p v-if="processing" role="status">Transcribiendo e interpretando…</p>
    <Button v-if="processing" variant="secondary" @click="cancel">Cancelar procesamiento</Button>
    <p v-if="error" role="alert">{{ error }}</p>
    <details v-if="original">
      <summary>Transcripción original</summary>
      <p>{{ original }}</p>
    </details>
    <label
      >Transcripción / texto corregido<textarea v-model="text" rows="4" :disabled="processing" />
    </label>
    <Button :disabled="!text.trim() || processing" @click="interpret(false)"
      >Reinterpretar texto</Button
    >
    <template v-if="result?.propuesta">
      <h3>Campos detectados</h3>
      <dl>
        <template v-for="(value, field) in result.propuesta.fields" :key="field"
          ><dt>{{ labels[field] ?? field }}</dt>
          <dd>{{ displayValue(field, value) }}</dd></template
        >
      </dl>
      <ul v-if="result.propuesta.warnings.length">
        <li v-for="warning in result.propuesta.warnings" :key="warning">{{ warning }}</li>
      </ul>
      <details>
        <summary>Evidencias y datos sin reconocer</summary>
        <ul>
          <li v-for="evidence in result.propuesta.evidence" :key="evidence.candidate_id">
            {{ evidence.label }}: «{{ evidence.text }}» — {{ evidence.decision }}
          </li>
        </ul>
        <p v-for="(fragment, index) in result.propuesta.unrecognized" :key="index">
          {{ fragment }}
        </p>
      </details>
      <Button
        :disabled="
          !Object.keys(result.propuesta.fields).length ||
          processing ||
          text !== result.texto_transcrito_original
        "
        @click="emit('apply', result.propuesta.fields)"
        >Aplicar al formulario</Button
      >
    </template>
  </section>
</template>
<style scoped>
.voice-catalog {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
h2,
h3,
p {
  margin: 0;
}
textarea {
  width: 100%;
  min-height: 6rem;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
