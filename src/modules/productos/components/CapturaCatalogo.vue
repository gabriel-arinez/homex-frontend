<script setup lang="ts">
import { nextTick, onBeforeUnmount, onScopeDispose, ref, watch } from 'vue'
import { AlertTriangle, Loader2 } from '@lucide/vue'
import {
  ALLOWED_AUDIO_EXTENSIONS,
  MAX_AUDIO_BYTES,
  MAX_UPLOAD_SECONDS,
  readAudioDuration,
} from '@/modules/capturas/audioLimits'
import { convertAudioFileToWav } from '@/modules/capturas/audioConversion'
import type {
  CamposCatalogo,
  CategoriaEnum,
  ResultadoCatalogo,
  ValorCatalogoPublico,
} from '@/generated/api'
import AudioRecorder from '@/modules/capturas/components/AudioRecorder.vue'
import VoiceCaptureControls from '@/modules/capturas/components/VoiceCaptureControls.vue'
import VoiceSection from '@/modules/capturas/components/VoiceSection.vue'
import Button from '@/shared/ui/Button.vue'
import { catalogoCapturaService } from '../services/catalogoCapturaService'

const props = defineProps<{
  categoria: CategoriaEnum
  opciones?: Record<string, ValorCatalogoPublico[]>
}>()

const emit = defineEmits<{
  apply: [fields: CamposCatalogo]
  applied: [payload: { fields: CamposCatalogo; text: string; warnings: string[] }]
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
const processingTimer = ref(0)
let processingInterval: number | null = null

watch(processing, (active) => {
  emit('processing-state', active)
  if (active) {
    processingTimer.value = 0
    if (processingInterval) clearInterval(processingInterval)
    processingInterval = window.setInterval(() => {
      processingTimer.value++
    }, 1000)
  } else {
    if (processingInterval) {
      clearInterval(processingInterval)
      processingInterval = null
    }
  }
})

onScopeDispose(() => {
  if (processingInterval) clearInterval(processingInterval)
})

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
        if (response.estado === 'ERROR') {
          error.value =
            'No se obtuvo una propuesta. Puedes reintentar la grabación o ingresar los datos manualmente.'
        } else if (response.propuesta?.fields) {
          const fields = response.propuesta.fields
          const transcrito = response.texto_transcrito_original || ''
          const warnings = response.propuesta.warnings || []
          // Emisión directa al formulario sin pantalla intermedia
          emit('apply', fields)
          emit('applied', { fields, text: transcrito, warnings })
        }
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

async function upload(event: Event) {
  const target = event.target as HTMLInputElement
  let file = target.files?.[0]
  target.value = ''
  if (!file) return

  const EXTENSIONES_SOPORTADAS = new Set([
    '.wav',
    '.mp3',
    '.m4a',
    '.ogg',
    '.webm',
    '.aac',
    '.opus',
    '.mp4',
    '.flac',
  ])
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()

  if (!EXTENSIONES_SOPORTADAS.has(extension) && !ALLOWED_AUDIO_EXTENSIONS.test(file.name)) {
    error.value = 'Formato no admitido. Utiliza WAV, MP3, M4A, OGG, WebM o AAC.'
    return
  }
  if (file.size === 0) {
    error.value = 'El archivo de audio está vacío.'
    return
  }
  if (file.size > MAX_AUDIO_BYTES) {
    error.value = 'El archivo supera el límite de 20 MB.'
    return
  }

  // Transcodificación transparente para formatos móviles (.aac, .opus)
  if (['.aac', '.opus'].includes(extension)) {
    try {
      file = await convertAudioFileToWav(file)
    } catch {
      error.value =
        'No se pudo transcodificar el archivo móvil. Intenta con un formato estándar (WAV o MP3).'
      return
    }
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
    <VoiceSection
      class="voice-block"
      icon="mic"
      title="Descripción por voz"
      description="Dicta nombre, marca, colores o características del producto. Los datos se aplicarán directamente al formulario."
    >
      <VoiceCaptureControls
        :recording="recording"
        :paused="paused"
        :disabled="processing || requesting"
        @record="startRecording"
        @upload="chooseAudio"
        @pause="pauseRecording"
        @resume="resumeRecording"
        @finish="recorder?.stopRecording()"
        @cancel="cancelRecording"
      >
        <template #recorder>
          <AudioRecorder
            v-if="recording"
            ref="recorder"
            compact
            @ready="onRecorded"
            @status="onRecorderStatus"
          />
        </template>
      </VoiceCaptureControls>
      <input
        ref="fileInput"
        class="visually-hidden"
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.aac,.opus,.mp4,.flac"
        :disabled="processing || recording || requesting"
        tabindex="-1"
        aria-hidden="true"
        @change="upload"
      />
    </VoiceSection>

    <!-- Feedback en vivo con fases y cronómetro -->
    <div v-if="processing" class="voice-processing" role="status" aria-live="polite">
      <div class="processing-header">
        <div class="processing-pulse">
          <Loader2 class="spinning" :size="20" aria-hidden="true" />
        </div>
        <div class="processing-info">
          <strong>Analizando descripción comercial</strong>
          <span class="processing-time">
            Tiempo transcurrido: {{ String(Math.floor(processingTimer / 60)).padStart(2, '0') }}:{{
              String(processingTimer % 60).padStart(2, '0')
            }}
          </span>
        </div>
        <Button variant="secondary" size="sm" @click="cancel">Cancelar</Button>
      </div>

      <div class="processing-steps">
        <div class="step-item" :class="{ 'step-item--active': processingTimer < 4 }">
          <span class="step-dot" />
          <span>1. Procesando archivo de audio</span>
        </div>
        <div
          class="step-item"
          :class="{ 'step-item--active': processingTimer >= 4 && processingTimer < 9 }"
        >
          <span class="step-dot" />
          <span>2. Transcribiendo términos y dictado</span>
        </div>
        <div class="step-item" :class="{ 'step-item--active': processingTimer >= 9 }">
          <span class="step-dot" />
          <span>3. Estructurando atributos comerciales</span>
        </div>
      </div>
      <p class="processing-disclaimer">
        La propuesta se inyecta directamente al formulario editable al concluir el análisis.
      </p>
    </div>

    <p v-if="error" role="alert" class="error">
      <AlertTriangle :size="17" aria-hidden="true" />{{ error }}
    </p>

    <div class="voice-guide">
      <h4>Recomendaciones para dictar</h4>
      <ul>
        <li>Menciona el <strong>nombre del producto</strong> («Silla ergonómica ejecutiva»).</li>
        <li>
          Indica el <strong>precio</strong> («precio 4500» o «precio de lista 5200 bolivianos»).
        </li>
        <li>
          Detalla atributos («respaldo de malla negra», «apoyo lumbar ajustable», «5 ruedas»).
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.voice-catalog {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}

.voice-processing {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}

.processing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.processing-pulse {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  background: var(--color-primary-soft, rgba(224, 46, 50, 0.12));
  border-radius: 50%;
  color: var(--color-primary);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.processing-info {
  display: grid;
  gap: 0.15rem;
  flex: 1 1 auto;
}

.processing-info strong {
  font-size: 0.92rem;
  font-weight: 600;
}

.processing-time {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.processing-steps {
  display: grid;
  gap: 0.45rem;
  margin-top: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
}

.step-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.81rem;
  color: var(--color-text-secondary);
}

.step-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-border-strong);
}

.step-item--active {
  color: var(--color-text);
  font-weight: 600;
}

.step-item--active .step-dot {
  background: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(224, 46, 50, 0.25);
}

.processing-disclaimer {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-text-secondary);
  font-style: italic;
}

.error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  background: var(--color-surface-danger, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-control);
  color: var(--color-danger-text);
  font-size: 0.84rem;
}

.voice-guide {
  padding: var(--space-4);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
}

.voice-guide h4 {
  margin: 0 0 var(--space-2);
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--color-text);
}

.voice-guide ul {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.55;
}
</style>
