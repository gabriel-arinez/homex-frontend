<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  FileAudio,
  Mic,
  RotateCcw,
  Square,
  Pause,
  Play,
  X,
} from '@lucide/vue'
import {
  ALLOWED_AUDIO_EXTENSIONS,
  MAX_AUDIO_BYTES,
  MAX_UPLOAD_SECONDS,
  readAudioDuration,
} from '@/modules/capturas/audioLimits'
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
const emit = defineEmits<{
  apply: [fields: CamposCatalogo]
  'recording-state': [active: boolean, paused: boolean, elapsed: number]
  'processing-state': [active: boolean]
}>()
const recorder = ref<InstanceType<typeof AudioRecorder> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const requesting = ref(false)
const recording = ref(false)
const paused = ref(false)
const recordingElapsed = ref(0)
const processing = ref(false)
watch(processing, (active) => emit('processing-state', active))
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
  if (processing.value || requesting.value) return
  result.value = null
  error.value = ''
  if (recording.value) {
    recorder.value?.stopRecording()
    return
  }
  requesting.value = true
  recording.value = true
  await nextTick()
  try {
    const started = await recorder.value?.startRecording()
    if (!started) {
      error.value = recorder.value?.getError() || 'No fue posible iniciar la grabación.'
      recording.value = false
    }
  } finally {
    requesting.value = false
  }
}
function onRecorderStatus(state: string, elapsed: number) {
  paused.value = state === 'PAUSED'
  recordingElapsed.value = elapsed
  emit(
    'recording-state',
    recording.value && ['RECORDING', 'PAUSED'].includes(state),
    paused.value,
    elapsed,
  )
}
function pauseRecording() {
  recorder.value?.pauseRecording()
}
function resumeRecording() {
  recorder.value?.resumeRecording()
}
function cancelRecording() {
  recorder.value?.cancelRecording()
  recording.value = false
  paused.value = false
  recordingElapsed.value = 0
  audio.value = null
  emit('recording-state', false, false, 0)
}
function onRecorded(blob: Blob | null) {
  if (!blob) return
  recording.value = false
  paused.value = false
  emit('recording-state', false, false, recordingElapsed.value)
  if (blob.size > MAX_AUDIO_BYTES) {
    error.value = 'La grabación supera 20 MB. Intenta una descripción más corta.'
    return
  }
  audio.value = blob
  void interpret(true)
}
function chooseAudio() {
  if (processing.value || requesting.value || recording.value) return
  fileInput.value?.click()
}
async function interpret(useAudio = false) {
  cancel()
  const current = generation
  const abort = new AbortController()
  controller = abort
  processing.value = true
  recording.value = false
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
      props.opciones?.[concepts[field]]?.find((option) => String(option.id) === String(value))
        ?.nombre ?? 'Valor pendiente de revisión'
    )
  if (value && typeof value === 'object')
    return Object.entries(value)
      .map(([key, item]) => `${key.replace(/_/g, ' ')}: ${item}`)
      .join('; ')
  return value
}
async function upload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  if (!ALLOWED_AUDIO_EXTENSIONS.test(file.name) || file.size === 0) {
    error.value = 'Selecciona un audio válido en formato WAV, MP3, M4A, OGG o WebM.'
    return
  }
  if (file.size > MAX_AUDIO_BYTES) {
    error.value = 'El archivo supera el límite de 20 MB.'
    return
  }
  try {
    const seconds = await readAudioDuration(file)
    if (seconds !== null && seconds > MAX_UPLOAD_SECONDS) {
      error.value = 'El archivo supera los 5 minutos permitidos.'
      return
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo validar la duración.'
    return
  }
  result.value = null
  audio.value = file
  void interpret(true)
}
</script>
<template>
  <section
    class="voice-catalog"
    aria-label="Autocompletar producto por voz"
    :aria-busy="processing"
  >
    <div class="voice-block">
      <div class="block-title">
        <Mic :size="19" aria-hidden="true" />
        <div>
          <h2>Descripción por voz</h2>
          <p>Dicta nombre, marca, colores o características del producto.</p>
        </div>
      </div>
      <div class="voice-source-actions" role="group" aria-label="Origen del audio">
        <Button
          class="source-action source-record"
          :disabled="processing || requesting"
          @click="startRecording"
        >
          <Square v-if="recording" :size="28" aria-hidden="true" />
          <Mic v-else :size="28" aria-hidden="true" />
          <strong>{{ recording ? 'Finalizar grabación' : 'Grabar descripción' }}</strong>
          <small>{{ recording ? 'Finalizar y transcribir' : 'Máximo 3 minutos' }}</small>
        </Button>
        <Button
          variant="secondary"
          class="source-action"
          :disabled="processing || recording || requesting"
          @click="chooseAudio"
        >
          <FileAudio :size="28" aria-hidden="true" />
          <strong>Seleccionar archivo</strong>
          <small>Hasta 20 MB y 5 minutos</small>
        </Button>
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
          :disabled="processing || recording || requesting"
          aria-label="Seleccionar audio del dispositivo"
          @change="upload"
        />
      </div>
      <AudioRecorder
        v-if="recording"
        ref="recorder"
        compact
        @ready="onRecorded"
        @status="onRecorderStatus"
      />
      <div
        v-if="recording"
        class="recording-toolbar"
        role="group"
        aria-label="Controles de grabación"
      >
        <Button v-if="!paused" variant="secondary" @click="pauseRecording">
          <Pause :size="17" aria-hidden="true" /> Pausar
        </Button>
        <Button v-else variant="secondary" @click="resumeRecording">
          <Play :size="17" aria-hidden="true" /> Reanudar
        </Button>
        <Button variant="danger" @click="cancelRecording">
          <X :size="17" aria-hidden="true" /> Cancelar grabación
        </Button>
      </div>
    </div>

    <div v-if="processing" class="processing-note" role="status">
      <span class="loader" aria-hidden="true" />
      <span>Transcribiendo e interpretando…</span>
      <Button variant="secondary" @click="cancel">Cancelar procesamiento</Button>
    </div>
    <p v-if="error" role="alert" class="error">
      <AlertTriangle :size="17" aria-hidden="true" />{{ error }}
    </p>

    <div class="voice-block">
      <div class="block-title">
        <RotateCcw :size="19" aria-hidden="true" />
        <div>
          <h2>Revisar transcripción</h2>
          <p>Corrige las palabras o códigos antes de aplicar los datos.</p>
        </div>
      </div>
      <details v-if="original" class="original">
        <summary>Ver transcripción original</summary>
        <p>{{ original }}</p>
      </details>
      <label class="transcript-label"
        >Transcripción / texto corregido
        <textarea
          v-model="text"
          rows="4"
          :disabled="processing"
          placeholder="Ej. Silla ergonómica, marca…, color…, precio…"
        />
      </label>
      <Button variant="secondary" :disabled="!text.trim() || processing" @click="interpret(false)">
        <RotateCcw :size="16" aria-hidden="true" /> Reinterpretar texto
      </Button>
    </div>

    <div v-if="result?.propuesta" class="voice-block results">
      <div class="block-title">
        <CheckCircle2 :size="19" aria-hidden="true" />
        <div>
          <h2>Campos detectados</h2>
          <p>Estos valores son una propuesta; todavía no se ha guardado el producto.</p>
        </div>
      </div>
      <dl class="detected-list">
        <div v-for="(value, field) in result.propuesta.fields" :key="field" class="detected-item">
          <dt>{{ labels[field] ?? field }}</dt>
          <dd>{{ displayValue(field, value) }}</dd>
        </div>
      </dl>
      <div v-if="result.propuesta.warnings.length" class="warnings">
        <h3><AlertTriangle :size="17" aria-hidden="true" /> Datos a revisar</h3>
        <ul>
          <li v-for="warning in result.propuesta.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>
      <details class="evidences">
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
        class="apply-button"
        :disabled="
          !Object.keys(result.propuesta.fields).length ||
          processing ||
          text !== result.texto_transcrito_original
        "
        @click="emit('apply', result.propuesta.fields)"
      >
        <CheckCircle2 :size="18" aria-hidden="true" /> Aplicar al formulario
      </Button>
      <p v-if="text !== result.texto_transcrito_original" class="hint">
        El texto cambió; vuelve a reinterpretarlo antes de aplicar.
      </p>
    </div>
    <p class="voice-footer">
      Los datos sugeridos deben revisarse. El producto se crea únicamente al pulsar Guardar
      producto.
    </p>
  </section>
</template>
<style scoped>
.recording-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.65rem;
}
.voice-catalog {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}
.voice-block {
  display: grid;
  gap: var(--space-3);
}
.voice-block + .voice-block {
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
.block-title {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.block-title > svg {
  flex: 0 0 auto;
  color: var(--color-primary);
}
.block-title h2 {
  margin: 0;
  font-size: 1.06rem;
}
.block-title p {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.voice-source-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  position: relative;
}
.voice-source-actions :deep(.source-action) {
  min-width: 0;
  min-height: 7.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.45rem;
  white-space: normal;
  text-align: center;
}
.voice-source-actions :deep(.source-action strong) {
  font-size: 0.93rem;
}
.voice-source-actions :deep(.source-action small) {
  font-size: 0.76rem;
  font-weight: 400;
  opacity: 0.9;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}
.transcript-label {
  display: grid;
  gap: 0.55rem;
  font-size: 0.85rem;
  font-weight: 600;
}
.transcript-label textarea {
  min-height: 7rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  resize: vertical;
}
.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.original,
.evidences {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-3);
  overflow-wrap: anywhere;
}
.original summary,
.evidences summary {
  font-weight: 600;
  cursor: pointer;
}
.original p,
.evidences p {
  font-size: 0.83rem;
}
.processing-note {
  display: grid;
  gap: var(--space-3);
  align-items: center;
  background: var(--color-surface-soft);
  border-radius: var(--radius-control);
  padding: var(--space-4);
  font-size: 0.86rem;
}
.loader {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: rotate 1s linear infinite;
}
.error {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-danger-soft);
  color: var(--color-danger-text);
}
.detected-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}
.detected-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-3);
  overflow-wrap: anywhere;
}
.detected-item dt {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  margin-bottom: 0.35rem;
}
.detected-item dd {
  margin: 0;
  font-size: 0.94rem;
  font-weight: 600;
}
.warnings {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.warnings h3 {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.9rem;
  margin: 0 0 0.5rem;
}
.warnings ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.83rem;
}
.evidences ul {
  padding-left: 1.2rem;
  font-size: 0.82rem;
}
.apply-button {
  width: 100%;
}
.voice-footer {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  line-height: 1.5;
}
@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 36rem) {
  .voice-catalog {
    padding: var(--space-4);
  }
  .voice-source-actions :deep(.source-action) {
    min-height: 7rem;
    padding: 0.65rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .loader {
    animation: none;
  }
}
</style>
