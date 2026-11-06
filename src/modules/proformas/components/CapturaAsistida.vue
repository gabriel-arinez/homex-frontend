<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { FileAudio, RotateCcw } from '@lucide/vue'
import {
  MAX_AUDIO_BYTES,
  MAX_UPLOAD_SECONDS,
  readAudioDuration,
} from '@/modules/capturas/audioLimits'
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
const hasResult = ref(false)
const fileError = ref('')
const EXTENSIONES_AUDIO = new Set(['.wav', '.mp3', '.m4a', '.ogg', '.webm'])
const original = ref('')
const corrected = ref('')
const lastInterpretation = ref('')
const captureId = ref<number | null>(null)
const pendingText = ref('')
watch(voice.processing, (value) => emit('processing', value))
watch(
  () => [props.sesion, props.moneda, props.proforma],
  () => {
    voice.cancel()
    recording.value = false
    fileError.value = ''
    confirm.value = false
    original.value = ''
    corrected.value = ''
    lastInterpretation.value = ''
    captureId.value = null
    pendingText.value = ''
    hasResult.value = false
    puedeSeleccionarAudio.value = false
  },
)
async function activate() {
  if (pendingText.value) {
    void send(undefined, pendingText.value)
    return
  }
  if (pendingMode.value === 'upload') {
    puedeSeleccionarAudio.value = true
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
  pendingText.value = ''
  fileError.value = ''
  if (voice.processing.value) return
  if (props.dirty && !props.reviewBeforeApply) confirm.value = true
  else void activate()
}
function proceed() {
  confirm.value = false
  void activate()
}
function reinterpret() {
  pendingText.value = corrected.value
  if (props.dirty && !props.reviewBeforeApply) confirm.value = true
  else void send(undefined, pendingText.value)
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
    fileError.value = 'Formato no admitido. Utiliza WAV, MP3, M4A, OGG o WebM.'
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
  void send(archivo)
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
  if (texto) {
    // La nueva interpretación conserva la transcripción original de la captura por voz.
    lastInterpretation.value = texto
    corrected.value = texto
  } else {
    original.value = visibleResult.texto_transcrito_original ?? ''
    lastInterpretation.value = original.value
    corrected.value = original.value
  }
  captureId.value = visibleResult.id
  hasResult.value = true
  // Una respuesta terminal sin propuesta no debe sustituir el mueble.
  // La transcripción queda disponible para revisión y reinterpretación.
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
      accept=".wav,.mp3,.m4a,.ogg,.webm"
      aria-hidden="true"
      @change="seleccionarAudio"
    />
    </VoiceSection>
    <div v-if="voice.processing.value" class="voice-processing" role="status" aria-live="polite">
      <FileAudio :size="20" aria-hidden="true" />
      <div>
        <strong>Analizando descripción</strong
        ><span>La información de tu mueble se mantiene mientras procesamos el audio.</span>
      </div>
      <Button variant="secondary" @click="cancel">Cancelar</Button>
    </div>
    <p v-if="fileError" role="alert" class="voice-error">{{ fileError }}</p>
    <p v-if="voice.error.value" role="alert" class="voice-error">{{ voice.error.value }}</p>
    <VoiceSection
      icon="review"
      title="Revisar transcripción"
      description="Corrige las palabras o códigos antes de aplicar los datos."
    >
      <details v-if="original" class="voice-original">
        <summary>Ver transcripción original</summary>
        <blockquote>{{ original }}</blockquote>
        <p v-if="lastInterpretation && lastInterpretation !== original">
          Última interpretación: {{ lastInterpretation }}
        </p>
      </details>
      <label class="transcript-label" for="transcripcion-corregida">
        Transcripción / texto corregido
      </label>
      <textarea
        id="transcripcion-corregida"
        v-model="corrected"
        :disabled="voice.processing.value"
        rows="4"
        placeholder="Ej. Mesa de reunión para diez personas, ancho…, largo…, materiales…"
      />
      <Button
        variant="secondary"
        :disabled="voice.processing.value || !corrected.trim() || corrected === lastInterpretation"
        @click="reinterpret"
      >
        <RotateCcw :size="16" aria-hidden="true" />
        Reinterpretar texto
      </Button>
      <p v-if="hasResult && !original" role="status">
        La interpretación se ha procesado. Revisa la ficha antes de incorporarla.
      </p>
    </VoiceSection>
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
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  background: var(--color-surface-muted);
  border-radius: var(--radius-card);
  padding: var(--space-3);
}
.voice-processing div {
  flex: 1;
  display: grid;
  gap: 0.3rem;
}
.voice-processing strong {
  font-size: 0.9rem;
}
.voice-processing span {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.voice-error {
  color: var(--color-danger-text);
}
.voice-original {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-3);
  overflow-wrap: anywhere;
}
.voice-original summary {
  font-weight: 600;
  cursor: pointer;
}
.voice-original blockquote {
  border-left: 2px solid var(--color-primary);
  margin: 0.75rem 0;
  padding-left: 1rem;
  color: var(--color-text-secondary);
}
.voice-original p {
  color: var(--color-text-secondary);
  font-size: 0.83rem;
}
.transcript-label {
  font-size: 0.85rem;
  font-weight: 600;
}
#transcripcion-corregida {
  width: 100%;
  display: block;
  min-height: 7rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  resize: vertical;
}
</style>
