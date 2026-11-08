<script setup lang="ts">
import { nextTick, onScopeDispose, ref, watch } from 'vue'
import { Loader2 } from '@lucide/vue'
import {
  MAX_AUDIO_BYTES,
  MAX_UPLOAD_SECONDS,
  readAudioDuration,
} from '@/modules/capturas/audioLimits'
import { convertAudioFileToWav } from '@/modules/capturas/audioConversion'
import type { ResultadoAsistida } from '@/generated/api'
import AudioRecorder from '@/modules/capturas/components/AudioRecorder.vue'
import VoiceCaptureControls from '@/modules/capturas/components/VoiceCaptureControls.vue'
import VoiceSection from '@/modules/capturas/components/VoiceSection.vue'
import Button from '@/shared/ui/Button.vue'
import Modal from '@/shared/ui/Modal.vue'
import { useCapturaAsistida } from '../composables/useCapturaAsistida'

const props = defineProps<{
  dirty: boolean
  sesion: string
  moneda: 'BOB' | 'USD'
  proforma?: number | null
  reviewBeforeApply?: boolean
}>()
const emit = defineEmits<{
  applied: [result: ResultadoAsistida]
  proposed: [result: ResultadoAsistida]
  processing: [value: boolean]
  'recording-state': [active: boolean, paused: boolean, elapsed: number]
}>()
const voice = useCapturaAsistida()
const confirm = ref(false)
const recording = ref(false)
const paused = ref(false)
const recorder = ref<InstanceType<typeof AudioRecorder> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pendingMode = ref<'record' | 'upload'>('record')
const puedeSeleccionarAudio = ref(false)
const fileError = ref('')
const EXTENSIONES_AUDIO = new Set([
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
const captureId = ref<number | null>(null)
const processingTimer = ref(0)
let processingInterval: number | null = null

watch(voice.processing, (isProc) => {
  emit('processing', isProc)
  if (isProc) {
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
watch(
  () => [props.sesion, props.moneda, props.proforma],
  () => {
    voice.cancel()
    recording.value = false
    fileError.value = ''
    confirm.value = false
    captureId.value = null
    puedeSeleccionarAudio.value = false
  },
)
async function activate() {
  if (pendingMode.value === 'upload') {
    puedeSeleccionarAudio.value = true
    await nextTick()
    fileInput.value?.click()
    return
  }
  recording.value = true
  puedeSeleccionarAudio.value = true
  await nextTick()
  // El componente real expone startRecording; algunos tests sustituyen el grabador.
  if (recorder.value?.startRecording) {
    const started = await recorder.value.startRecording()
    if (!started) {
      recording.value = false
      fileError.value = recorder.value.getError?.() || 'No fue posible iniciar la grabación.'
    }
  }
}
function start(mode: 'record' | 'upload' = 'record') {
  pendingMode.value = mode
  puedeSeleccionarAudio.value = false
  fileError.value = ''
  if (voice.processing.value) return
  if (props.dirty && !props.reviewBeforeApply) confirm.value = true
  else void activate()
}
function proceed() {
  confirm.value = false
  void activate()
}
function onRecorderStatus(state: string, seconds: number) {
  paused.value = state === 'PAUSED'
  emit(
    'recording-state',
    recording.value && ['RECORDING', 'PAUSED'].includes(state),
    paused.value,
    seconds,
  )
}
function pausar() {
  recorder.value?.pauseRecording()
}
function reanudar() {
  recorder.value?.resumeRecording()
}
function finalizar() {
  recorder.value?.stopRecording()
}
async function seleccionarAudio(event: Event) {
  const input = event.target as HTMLInputElement
  const archivo = input.files?.[0]
  input.value = ''
  fileError.value = ''

  if (!archivo || !puedeSeleccionarAudio.value || voice.processing.value) return
  puedeSeleccionarAudio.value = false

  const extension = archivo.name.slice(archivo.name.lastIndexOf('.')).toLowerCase()

  if (!EXTENSIONES_AUDIO.has(extension)) {
    fileError.value = 'Formato no admitido. Utiliza WAV, MP3, M4A, OGG, WebM o AAC.'
    return
  }

  if (archivo.size === 0) {
    fileError.value = 'El archivo de audio está vacío.'
    return
  }

  if (archivo.size > MAX_AUDIO_BYTES) {
    fileError.value = 'El archivo supera el límite de 20 MB.'
    return
  }

  try {
    const seconds = await readAudioDuration(archivo)
    if (seconds !== null && seconds > MAX_UPLOAD_SECONDS) {
      fileError.value = 'La duración del audio no puede superar 5 minutos.'
      return
    }
  } catch (cause) {
    fileError.value = cause instanceof Error ? cause.message : 'No se pudo validar el audio.'
    return
  }

  // Si es un formato como .aac, .opus o .flac que el backend podría no soportar directamente,
  // se convierte a .wav mediante Web Audio API si está disponible.
  let audioParaEnviar = archivo
  if (['.aac', '.opus', '.flac', '.mp4'].includes(extension)) {
    try {
      audioParaEnviar = await convertAudioFileToWav(archivo)
    } catch {
      // Si la conversión falla, se envía el archivo original
      audioParaEnviar = archivo
    }
  }

  void send(audioParaEnviar)
}

async function send(audio?: Blob, texto?: string) {
  recording.value = false
  paused.value = false
  emit('recording-state', false, false, 0)
  puedeSeleccionarAudio.value = false
  const context = JSON.stringify([props.sesion, props.moneda, props.proforma])
  const result = await voice.capture({
    clave_idempotencia: crypto.randomUUID(),
    sesion_borrador: props.sesion,
    moneda_codigo: props.moneda,
    proforma: props.proforma ?? undefined,
    ...(audio ? { audio } : { texto }),
    ...(texto && captureId.value ? { captura_origen: captureId.value } : {}),
  })
  const visibleResult = result ?? voice.terminalResult.value
  if (!visibleResult || context !== JSON.stringify([props.sesion, props.moneda, props.proforma]))
    return
  captureId.value = visibleResult.id

  // Una respuesta terminal sin propuesta no debe sustituir el mueble.
  if (
    result &&
    result.resultado === 'REQUIRES_REVIEW' &&
    result.propuesta_configurador &&
    result.version_proyeccion === 'PRF04_2'
  ) {
    if (props.reviewBeforeApply) emit('proposed', result)
    else emit('applied', result)
  }
}
function cancel() {
  voice.cancel()
  recorder.value?.cancelRecording()
  recording.value = false
  paused.value = false
  emit('recording-state', false, false, 0)
  puedeSeleccionarAudio.value = false
  fileError.value = ''
}
</script>
<template>
  <section class="voice-workflow" aria-label="Asistencia por voz">
    <VoiceSection
      icon="mic"
      title="Descripción por voz"
      description="Dicta nombre, medidas, materiales o características del mueble."
    >
      <VoiceCaptureControls
        :recording="recording"
        :paused="paused"
        :disabled="voice.processing.value"
        @record="start('record')"
        @upload="start('upload')"
        @pause="pausar"
        @resume="reanudar"
        @finish="finalizar"
        @cancel="cancel"
      >
        <template #recorder>
          <AudioRecorder
            v-if="recording"
            ref="recorder"
            compact
            @ready="(audio) => audio && send(audio)"
            @status="onRecorderStatus"
          />
        </template>
      </VoiceCaptureControls>
      <input
        ref="fileInput"
        class="visually-hidden-audio"
        type="file"
        tabindex="-1"
        :disabled="!puedeSeleccionarAudio || voice.processing.value"
        accept=".wav,.mp3,.m4a,.ogg,.webm,.aac,.opus,.mp4,.flac"
        aria-hidden="true"
        @change="seleccionarAudio"
      />
    </VoiceSection>
    <div v-if="voice.processing.value" class="voice-processing" role="status" aria-live="polite">
      <div class="processing-header">
        <div class="processing-pulse">
          <Loader2 class="spinning" :size="20" aria-hidden="true" />
        </div>
        <div class="processing-info">
          <strong>Analizando descripción de mueble</strong>
          <span class="processing-time"
            >Tiempo transcurrido: {{ String(Math.floor(processingTimer / 60)).padStart(2, '0') }}:{{
              String(processingTimer % 60).padStart(2, '0')
            }}</span
          >
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
          :class="{ 'step-item--active': processingTimer >= 4 && processingTimer < 10 }"
        >
          <span class="step-dot" />
          <span>2. Transcribiendo y reconociendo términos</span>
        </div>
        <div class="step-item" :class="{ 'step-item--active': processingTimer >= 10 }">
          <span class="step-dot" />
          <span>3. Estructurando piezas, medidas y cotización</span>
        </div>
      </div>
      <p class="processing-disclaimer">
        La información de tu mueble se mantiene segura mientras procesamos el audio.
      </p>
    </div>
    <p v-if="fileError" role="alert" class="voice-error">{{ fileError }}</p>
    <p v-if="voice.error.value" role="alert" class="voice-error">{{ voice.error.value }}</p>
    <Modal
      :open="confirm"
      title="Reemplazar información del mueble"
      title-id="prf04-replace-title"
      @close="confirm = false"
    >
      <p>
        La captura por voz reemplazará toda la información de este mueble. No afectará los demás
        ítems de la proforma.
      </p>
      <Button variant="secondary" @click="confirm = false">Cancelar</Button>
      <Button @click="proceed">Continuar con voz</Button>
    </Modal>
  </section>
</template>

<style scoped>
.voice-workflow {
  display: grid;
  gap: 1rem;
}
.visually-hidden-audio {
  position: absolute;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  overflow: hidden;
  white-space: nowrap;
}
.voice-processing {
  display: grid;
  gap: var(--space-3);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
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
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
.processing-info {
  flex: 1;
  display: grid;
  gap: 0.2rem;
}
.processing-info strong {
  font-size: 0.92rem;
  color: var(--color-text);
}
.processing-time {
  font-size: 0.8rem;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.processing-steps {
  display: grid;
  gap: 0.45rem;
  padding: var(--space-2) 0;
  border-top: 1px dashed var(--color-border);
  border-bottom: 1px dashed var(--color-border);
}
.step-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border-strong);
}
.step-item--active {
  color: var(--color-text);
  font-weight: 600;
}
.step-item--active .step-dot {
  background: var(--color-primary);
  box-shadow: 0 0 6px var(--color-primary);
}
.processing-disclaimer {
  margin: 0;
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}
.voice-error {
  color: var(--color-danger-text);
}
</style>
