<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AlertTriangle, CheckCircle2, FileText, Mic, RotateCcw, Sparkles } from '@lucide/vue'
import type { CategoriaEnum, ResultadoCatalogo, ResultadoAsistida } from '@/generated/api'
import { catalogoCapturaService } from '@/modules/productos/services/catalogoCapturaService'
import { asistidasService } from '../services/asistidasService'
import {
  MAX_AUDIO_BYTES,
  MIN_AUDIO_SECONDS,
  MAX_TRANSCRIPT_CHARACTERS,
  CAPTURE_TIMEOUT_MS,
  validateTranscript,
  countTranscriptWords,
  countTranscriptCharacters,
} from '../audioLimits'
import { prepareAudioForCapture } from '../audioConversion'
import AudioRecorder from './AudioRecorder.vue'
import AudioReview from './AudioReview.vue'
import TranscriptEvidence from './TranscriptEvidence.vue'
import VoiceCaptureControls from './VoiceCaptureControls.vue'
import Button from '@/shared/ui/Button.vue'
import {
  buildFurnitureTranscriptEvidence,
  categorizeEvidenceLabel,
  type VoiceEvidence,
} from '../voiceEvidence'
const props = defineProps<{
  mode: 'catalog' | 'furniture'
  categoria?: CategoriaEnum
  sesion: string
  moneda?: 'BOB' | 'USD'
  proforma?: number | null
  dirty?: boolean
  options?: Record<string, import('@/generated/api').ValorCatalogoPublico[]>
}>()
const emit = defineEmits<{
  applied: [result: ResultadoCatalogo | ResultadoAsistida]
  'recording-state': [active: boolean, paused: boolean, elapsed: number]
  processing: [active: boolean]
}>()
const recorder = ref<InstanceType<typeof AudioRecorder> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const recording = ref(false),
  paused = ref(false),
  processing = ref(false),
  requesting = ref(false),
  preparingAudio = ref(false)
const previewAudio = ref<Blob | null>(null)
const audio = ref<Blob | null>(null),
  text = ref(''),
  original = ref(''),
  error = ref(''),
  applied = ref(false)
const result = ref<ResultadoCatalogo | ResultadoAsistida | null>(null)
const asrCaptureId = ref<number | null>(null)
const lastInterpretationId = ref<number | null>(null)
const originCaptureId = computed(() => asrCaptureId.value ?? lastInterpretationId.value)
const busy = computed(
  () => processing.value || recording.value || requesting.value || preparingAudio.value,
)
let settingAsrText = false
const editError = ref('')
const appliedWarnings = ref<string[]>([])
const appliedResult = ref<ResultadoCatalogo | ResultadoAsistida | null>(null)
const appliedEvidence = computed<VoiceEvidence[]>(() => {
  const res = appliedResult.value
  const transcript = text.value.trim()
  if (!res || !transcript) return []
  if ('propuesta_configurador' in res) {
    return buildFurnitureTranscriptEvidence(
      transcript,
      res.propuesta_configurador,
      res.pendientes,
    )
  }
  const ev = res.propuesta?.evidence ?? []
  return ev.map((item) => ({
    ...item,
    category: categorizeEvidenceLabel(item.label, item.decision),
    fieldLabel: item.label,
  }))
})
const transcriptWords = computed(() => countTranscriptWords(text.value))
const transcriptCharacters = computed(() => countTranscriptCharacters(text.value))
const transcriptError = computed(() => validateTranscript(text.value))
const hasTranscriptStage = computed(() =>
  Boolean(text.value || original.value || asrCaptureId.value),
)
const catalog = computed(() => (result.value && 'propuesta' in result.value ? result.value : null))
const furniture = computed(() =>
  result.value && 'propuesta_configurador' in result.value ? result.value : null,
)
const proposal = computed(() =>
  catalog.value?.propuesta?.fields && Object.keys(catalog.value.propuesta.fields).length
    ? catalog.value.propuesta.fields
    : furniture.value?.resultado === 'REQUIRES_REVIEW' &&
        furniture.value.version_proyeccion === 'PRF04_2'
      ? furniture.value.propuesta_configurador
      : null,
)
const warnings = computed(
  () =>
    catalog.value?.propuesta?.warnings ?? furniture.value?.pendientes.map((p) => p.mensaje) ?? [],
)
let generation = 0,
  controller: AbortController | null = null
function cancel() {
  generation++
  controller?.abort()
  result.value = null
  processing.value = false
  preparingAudio.value = false
  emit('processing', false)
}
function discard() {
  cancel()
  audio.value = null
  previewAudio.value = null
  error.value = ''
  recorder.value?.cancelRecording?.()
  recording.value = false
  requesting.value = false
  paused.value = false
  emit('recording-state', false, false, 0)
}
watch(
  text,
  () => {
    if (!settingAsrText) cancel()
  },
  { flush: 'sync' },
)
watch(
  () => [props.sesion, props.moneda, props.proforma, props.categoria],
  () => {
    discard()
    result.value = null
    text.value = ''
    original.value = ''
    asrCaptureId.value = null
    lastInterpretationId.value = null
    applied.value = false
    appliedWarnings.value = []
  },
)
function resetAll() {
  discard()
  result.value = null
  text.value = ''
  original.value = ''
  asrCaptureId.value = null
  lastInterpretationId.value = null
  applied.value = false
  appliedWarnings.value = []
}
onBeforeUnmount(discard)
async function start() {
  if (processing.value || requesting.value) return
  discard()
  applied.value = false
  requesting.value = true
  recording.value = true
  const current = generation
  await nextTick()
  const activeRecorder = recorder.value
  try {
    const started = await activeRecorder?.startRecording?.()
    if (current !== generation) {
      activeRecorder?.cancelRecording?.()
      return
    }
    if (!started) {
      recording.value = false
      error.value = recorder.value?.getError?.() || 'No fue posible iniciar la grabación.'
    }
  } finally {
    if (current === generation) requesting.value = false
  }
}
function status(state: string, seconds: number) {
  paused.value = state === 'PAUSED'
  if (['ERROR', 'DENIED', 'UNSUPPORTED'].includes(state) && recording.value) {
    recording.value = false
    paused.value = false
    requesting.value = false
    error.value =
      recorder.value?.getError?.() || 'La grabación no cumplió el mínimo requerido de 15 segundos.'
    emit('recording-state', false, false, 0)
    return
  }
  emit(
    'recording-state',
    recording.value && ['RECORDING', 'PAUSED'].includes(state),
    paused.value,
    seconds,
  )
}
function recorded(blob: Blob | null) {
  if (!blob || !recording.value) return
  recording.value = false
  paused.value = false
  requesting.value = false
  emit('recording-state', false, false, 0)
  acceptAudio(blob)
}
function acceptAudio(blob: Blob) {
  if (!blob.size || blob.size > MAX_AUDIO_BYTES) {
    error.value = 'Audio vacío o superior a 20 MB.'
    return
  }
  audio.value = blob
  previewAudio.value = blob
  result.value = null
  applied.value = false
  void process(true)
}
function chooseAudio() {
  if (busy.value) return
  discard()
  fileInput.value?.click()
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  discard()
  if (!file) return
  const current = generation
  preparingAudio.value = true
  try {
    const prepared = await prepareAudioForCapture(file)
    if (current !== generation) return
    preparingAudio.value = false
    acceptAudio(prepared)
  } catch (cause) {
    if (current === generation)
      error.value = cause instanceof Error ? cause.message : 'No se pudo validar el audio.'
  } finally {
    if (current === generation) preparingAudio.value = false
  }
}
async function process(useAudio = false) {
  if (busy.value || (!useAudio && audio.value)) return
  if (!useAudio && transcriptError.value) {
    error.value = transcriptError.value
    return
  }
  if (useAudio && !audio.value) return
  cancel()
  result.value = null
  error.value = ''
  const current = generation,
    abort = new AbortController()
  controller = abort
  const submittedText = useAudio
    ? text.value
    : text.value
        .normalize('NFC')
        .replace(/[ \t]+/g, ' ')
        .trim()
  if (!useAudio && submittedText !== text.value) {
    settingAsrText = true
    text.value = submittedText
    settingAsrText = false
  }
  processing.value = true
  emit('processing', true)
  try {
    const common = {
      clave_idempotencia: crypto.randomUUID(),
      sesion_borrador: props.sesion,
      ...(useAudio
        ? { audio: audio.value!, solo_transcribir: true }
        : {
            texto: submittedText,
            ...(originCaptureId.value ? { captura_origen: originCaptureId.value } : {}),
          }),
    }
    const created =
      props.mode === 'catalog'
        ? await catalogoCapturaService.create(
            { ...common, categoria: props.categoria! },
            abort.signal,
          )
        : await asistidasService.create(
            { ...common, moneda_codigo: props.moneda, proforma: props.proforma ?? undefined },
            abort.signal,
          )
    const deadline = Date.now() + CAPTURE_TIMEOUT_MS
    while (!abort.signal.aborted && current === generation) {
      const response =
        props.mode === 'catalog'
          ? await catalogoCapturaService.get(created.id, abort.signal)
          : await asistidasService.get(created.id, abort.signal)
      if (current !== generation) return
      if (['COMPLETADA', 'ERROR'].includes(response.estado)) {
        if (
          useAudio &&
          (response.estado === 'COMPLETADA' || response.texto_transcrito_original?.trim())
        ) {
          const normalizedTranscript = (response.texto_transcrito_original ?? '')
            .normalize('NFC')
            .replace(/[ \t]+/g, ' ')
            .trim()
          if (!normalizedTranscript && response.estado === 'COMPLETADA') {
            error.value =
              'No se reconoció texto. Escucha el audio, repite la grabación o reintenta la transcripción.'
            return
          }
          // Set editable text before the result: the watcher invalidates prior interpretations.
          asrCaptureId.value = response.id
          settingAsrText = true
          text.value = normalizedTranscript
          settingAsrText = false
          original.value = response.texto_asr_original ?? normalizedTranscript
          if (text.value.trim()) audio.value = null
        }
        if (response.estado === 'ERROR') {
          error.value =
            response.error_codigo === 'TRANSCRIPT_TOO_LONG'
              ? 'La transcripción supera el límite de caracteres. Reduce el texto y vuelve a procesarlo.'
              : 'No se pudo procesar la captura. Conserva o corrige el texto y vuelve a intentar.'
          return
        }
        if (!useAudio) {
          lastInterpretationId.value = response.id
          result.value = response
          if (!proposal.value) {
            error.value =
              'No se identificó una propuesta comercial. Añade o corrige la descripción y vuelve a procesar.'
          } else {
            appliedWarnings.value = [...warnings.value]
            appliedResult.value = response
            applied.value = true
            emit('applied', response)
            result.value = null
          }
        }
        return
      }
      if (Date.now() >= deadline)
        throw new Error(
          'La transcripción sigue pendiente. El formulario se conserva; vuelve a intentarlo más tarde.',
        )
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer)
          abort.signal.removeEventListener('abort', finish)
          resolve()
        }
        const timer = setTimeout(finish, 750)
        abort.signal.addEventListener('abort', finish, { once: true })
      })
    }
  } catch (cause) {
    if (current === generation && !abort.signal.aborted)
      error.value = cause instanceof Error ? cause.message : 'No fue posible procesar la captura.'
  } finally {
    if (current === generation) {
      processing.value = false
      emit('processing', false)
    }
  }
}
function updateTranscript(event: Event) {
  const input = event.target as HTMLTextAreaElement
  const next = input.value
  if (
    countTranscriptCharacters(next) > MAX_TRANSCRIPT_CHARACTERS &&
    countTranscriptCharacters(next) > transcriptCharacters.value
  ) {
    input.value = text.value
    editError.value =
      'No se añadió el texto: el máximo es 3000 caracteres. Reduce la transcripción para continuar.'
    return
  }
  editError.value = ''
  text.value = next
}
function pasteTranscript(event: ClipboardEvent) {
  const input = event.target as HTMLTextAreaElement
  if (!event.clipboardData) return
  const pasted = event.clipboardData.getData('text')
  const next =
    text.value.slice(0, input.selectionStart) + pasted + text.value.slice(input.selectionEnd)
  if (
    countTranscriptCharacters(next) > MAX_TRANSCRIPT_CHARACTERS &&
    countTranscriptCharacters(next) > transcriptCharacters.value
  ) {
    event.preventDefault()
    editError.value =
      'No se pegó el texto: el máximo es 3000 caracteres. El contenido existente se conserva.'
  }
}
</script>
<template>
  <section
    class="staged-voice"
    aria-label="Captura por voz con revisión humana"
    :aria-busy="processing"
  >
    <div class="voice-intro">
      <h3>Descripción por voz</h3>
      <p>Dicta o sube un audio con el nombre, medidas, materiales y precio.</p>
    </div>

    <VoiceCaptureControls
      v-if="!hasTranscriptStage && !applied && !processing && !preparingAudio"
      :recording="recording"
      :paused="paused"
      :disabled="processing || requesting || preparingAudio"
      @record="start"
      @upload="chooseAudio"
      @pause="recorder?.pauseRecording()"
      @resume="recorder?.resumeRecording()"
      @finish="recorder?.stopRecording()"
      @cancel="discard"
    >
      <template #recorder>
        <AudioRecorder
          v-if="recording"
          ref="recorder"
          compact
          :min-duration-seconds="MIN_AUDIO_SECONDS"
          @ready="recorded"
          @status="status"
        />
      </template>
    </VoiceCaptureControls>

    <input
      ref="fileInput"
      type="file"
      aria-label="Archivo de audio para transcribir"
      aria-hidden="true"
      tabindex="-1"
      accept=".wav,.mp3,.m4a,.ogg,.webm,.aac,.opus,.mp4,.flac"
      class="file-input"
      :disabled="busy"
      @change="upload"
    />

    <!-- Animación de procesamiento ASR o NLP -->
    <div v-if="preparingAudio || processing" class="voice-processing-card" role="status">
      <div class="voice-processing-card__visual" aria-hidden="true">
        <span class="voice-pulse-ring" />
        <Mic v-if="preparingAudio || audio" :size="22" />
        <Sparkles v-else :size="22" />
      </div>
      <div class="voice-processing-card__copy">
        <strong>
          {{
            preparingAudio
              ? 'Validando audio…'
              : audio
                ? 'Transcribiendo audio…'
                : 'Procesando con NLP y aplicando…'
          }}
        </strong>
        <span>
          {{
            preparingAudio
              ? 'Comprobando formato y duración mínima de 15 segundos.'
              : audio
                ? 'Convirtiendo tu grabación en texto para que puedas revisarlo.'
                : 'Extrayendo campos técnicos y comerciales para el formulario.'
          }}
        </span>
        <div class="voice-progress-bar" aria-hidden="true">
          <span class="voice-progress-bar__fill" />
        </div>
      </div>
      <Button variant="secondary" @click="preparingAudio ? discard() : cancel()">Cancelar</Button>
    </div>

    <!-- Pista de audio grabada (estilizada) -->
    <AudioReview
      v-if="previewAudio && !applied && !processing"
      :audio="previewAudio"
      :disabled="processing"
      :retry="Boolean(audio) && !processing"
      @retry="process(true)"
      @discard="resetAll"
    />

    <!-- Alertas de validación o error con botón de reinicio -->
    <div v-if="error && !processing" class="voice-alert-card" role="alert">
      <div class="voice-alert-card__head">
        <AlertTriangle :size="18" aria-hidden="true" />
        <div>
          <strong>Revisa antes de continuar</strong>
          <p>{{ error }}</p>
        </div>
      </div>
      <div v-if="!hasTranscriptStage" class="voice-alert-card__actions">
        <Button variant="warning" @click="start">
          <RotateCcw :size="15" aria-hidden="true" />
          Reiniciar grabación
        </Button>
        <Button variant="secondary" @click="chooseAudio">Subir otro archivo</Button>
      </div>
    </div>

    <!-- Único apartado de Revisión y Corrección tras transcribir -->
    <section
      v-if="hasTranscriptStage && !applied && !processing"
      class="transcript-review-card"
      aria-label="Revisión y corrección de transcripción"
    >
      <div class="transcript-review-card__head">
        <span class="transcript-review-card__icon" aria-hidden="true">
          <FileText :size="18" />
        </span>
        <div>
          <h4>Revisar y corregir transcripción</h4>
          <p>Ajusta cualquier palabra o número y aplica directamente al formulario.</p>
        </div>
      </div>

      <label class="transcript-label">
        <span class="sr-only">Revisar y corregir transcripción</span>
        <textarea
          :value="text"
          class="transcript-textarea"
          aria-label="Revisar y corregir transcripción"
          aria-describedby="voice-transcript-count voice-transcript-error"
          :aria-invalid="Boolean(transcriptError && text)"
          rows="7"
          :disabled="recording"
          @input="updateTranscript"
          @paste="pasteTranscript"
        />
      </label>

      <div id="voice-transcript-count" class="transcript-constraints" aria-live="polite">
        <span
          class="constraint-pill"
          :class="transcriptWords >= 20 ? 'constraint-pill--ok' : 'constraint-pill--warn'"
        >
          {{ transcriptWords }} / 20 palabras mínimas
        </span>
        <span
          class="constraint-pill"
          :class="
            transcriptCharacters <= MAX_TRANSCRIPT_CHARACTERS
              ? 'constraint-pill--neutral'
              : 'constraint-pill--danger'
          "
        >
          {{ transcriptCharacters }} / {{ MAX_TRANSCRIPT_CHARACTERS }} caracteres máx.
        </span>
      </div>

      <p
        v-if="text && transcriptError"
        id="voice-transcript-error"
        class="transcript-inline-alert"
        role="alert"
      >
        <AlertTriangle :size="15" aria-hidden="true" />
        <span>{{ transcriptError }}</span>
      </p>
      <p v-if="editError" class="transcript-inline-alert" role="alert">
        <AlertTriangle :size="15" aria-hidden="true" />
        <span>{{ editError }}</span>
      </p>

      <div class="transcript-actions">
        <Button
          variant="success"
          :disabled="busy || Boolean(audio) || Boolean(transcriptError)"
          @click="process(false)"
        >
          <Sparkles :size="16" aria-hidden="true" />
          Procesar y aplicar
        </Button>
        <Button variant="secondary" :disabled="busy" @click="resetAll">
          <RotateCcw :size="15" aria-hidden="true" />
          Grabar de nuevo
        </Button>
      </div>
    </section>

    <!-- Estado posterior a la aplicación directa al formulario -->
    <div v-if="applied" class="voice-applied-stack">
      <div class="voice-success-card" role="status">
        <CheckCircle2 :size="20" aria-hidden="true" />
        <div>
          <strong>Propuesta aplicada al formulario</strong>
          <p>
            Los campos detectados se marcaron en verde. Si hay observaciones, aparecerán señaladas
            en el formulario.
          </p>
        </div>
      </div>

      <div v-if="appliedWarnings.length" class="voice-warnings-card" role="status">
        <div class="voice-warnings-card__head">
          <AlertTriangle :size="17" aria-hidden="true" />
          <strong>Observaciones detectadas ({{ appliedWarnings.length }})</strong>
        </div>
        <ul>
          <li v-for="warning in appliedWarnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>

      <div v-if="text.trim()" class="voice-applied-evidence">
        <TranscriptEvidence :text="text" :evidence="appliedEvidence" />
      </div>

      <div class="voice-applied-actions">
        <Button variant="secondary" @click="applied = false">
          <FileText :size="15" aria-hidden="true" />
          Editar transcripción
        </Button>
        <Button variant="secondary" @click="resetAll">
          <RotateCcw :size="15" aria-hidden="true" />
          Nueva captura por voz
        </Button>
      </div>
    </div>
  </section>
</template>
<style scoped>
.staged-voice {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
}
.voice-intro {
  display: grid;
  gap: 0.25rem;
}
h3,
h4,
p {
  margin: 0;
}
.voice-intro p {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}
.voice-processing-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-info) 38%, var(--color-border));
  border-radius: var(--radius-card);
  background: var(--color-info-soft);
}
.voice-processing-card__visual {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.85rem;
  height: 2.85rem;
  border-radius: 999px;
  background: var(--color-info);
  color: #fff;
}
.voice-pulse-ring {
  position: absolute;
  inset: -4px;
  border-radius: 999px;
  border: 2px solid var(--color-info);
  animation: voice-pulse 1.4s ease-out infinite;
}
.voice-processing-card__copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.voice-processing-card__copy strong {
  font-size: 0.92rem;
}
.voice-processing-card__copy span {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
.voice-progress-bar {
  position: relative;
  height: 0.3rem;
  margin-top: 0.25rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-info) 20%, transparent);
  overflow: hidden;
}
.voice-progress-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 42%;
  border-radius: 999px;
  background: var(--color-info);
  animation: voice-slide 1.2s ease-in-out infinite;
}
@keyframes voice-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.85;
  }
  100% {
    transform: scale(1.28);
    opacity: 0;
  }
}
@keyframes voice-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}
.voice-alert-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-warning) 50%, var(--color-border));
  border-radius: var(--radius-card);
  background: var(--color-warning-soft);
}
.voice-alert-card__head {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  color: var(--color-warning);
}
.voice-alert-card__head strong {
  display: block;
  font-size: 0.9rem;
  color: var(--color-text);
}
.voice-alert-card__head p {
  margin-top: 0.2rem;
  font-size: 0.84rem;
  color: var(--color-text);
}
.voice-alert-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.transcript-review-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.transcript-review-card__head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.transcript-review-card__icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent);
}
.transcript-review-card__head h4 {
  font-size: 0.95rem;
}
.transcript-review-card__head p {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
.transcript-label {
  display: grid;
}
.transcript-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-3) var(--space-4);
  color: var(--color-text);
  background: var(--color-background);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  font: inherit;
  font-size: 1.04rem;
  line-height: 1.6;
  resize: vertical;
}
.transcript-textarea:focus {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 1px;
}
.transcript-constraints {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.constraint-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 650;
  border: 1px solid var(--color-border);
}
.constraint-pill--ok {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.constraint-pill--warn {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
}
.constraint-pill--danger {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.constraint-pill--neutral {
  color: var(--color-text-secondary);
  background: var(--color-surface-soft);
}
.transcript-inline-alert {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-control);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: 0.82rem;
  font-weight: 600;
}
.transcript-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.voice-applied-stack {
  display: grid;
  gap: var(--space-3);
}
.voice-applied-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.voice-success-card {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-success) 40%, var(--color-border));
  border-radius: var(--radius-card);
  background: var(--color-success-soft);
  color: var(--color-success);
}
.voice-success-card strong {
  display: block;
  color: var(--color-text);
  font-size: 0.94rem;
}
.voice-success-card p {
  margin-top: 0.2rem;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
}
.voice-warnings-card {
  display: grid;
  gap: 0.5rem;
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  border-radius: var(--radius-card);
  background: var(--color-warning-soft);
}
.voice-warnings-card__head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--color-warning);
  font-size: 0.86rem;
}
.voice-warnings-card ul {
  margin: 0;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.25rem;
  font-size: 0.82rem;
}
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
}
</style>
