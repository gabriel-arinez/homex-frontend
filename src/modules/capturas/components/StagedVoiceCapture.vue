<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { CategoriaEnum, ResultadoCatalogo, ResultadoAsistida } from '@/generated/api'
import { catalogoCapturaService } from '@/modules/productos/services/catalogoCapturaService'
import { asistidasService } from '../services/asistidasService'
import {
  ALLOWED_AUDIO_EXTENSIONS,
  MAX_AUDIO_BYTES,
  MAX_TRANSCRIPT_CHARACTERS,
  CAPTURE_TIMEOUT_MS,
  readAudioDuration,
  validateAudioDuration,
  validateTranscript,
} from '../audioLimits'
import type { VoiceEvidence } from '../voiceEvidence'
import AudioRecorder from './AudioRecorder.vue'
import AudioReview from './AudioReview.vue'
import VoiceCaptureControls from './VoiceCaptureControls.vue'
import TranscriptEvidence from './TranscriptEvidence.vue'
import Button from '@/shared/ui/Button.vue'
const props = defineProps<{
  mode: 'catalog' | 'furniture'
  categoria?: CategoriaEnum
  sesion: string
  moneda?: 'BOB' | 'USD'
  proforma?: number | null
  dirty?: boolean
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
  requesting = ref(false)
const audio = ref<Blob | null>(null),
  text = ref(''),
  original = ref(''),
  error = ref(''),
  applied = ref(false)
const result = ref<ResultadoCatalogo | ResultadoAsistida | null>(null)
const captureId = ref<number | null>(null)
const transcriptError = computed(() => validateTranscript(text.value))
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
const evidence = computed(
  () =>
    (catalog.value?.propuesta?.evidence ?? furniture.value?.candidatos ?? []) as VoiceEvidence[],
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
  processing.value = false
  emit('processing', false)
}
function discard() {
  cancel()
  audio.value = null
  error.value = ''
  recorder.value?.cancelRecording?.()
  recording.value = false
  emit('recording-state', false, false, 0)
}
watch(text, () => {
  cancel()
  result.value = null
})
watch(
  () => [props.sesion, props.moneda, props.proforma, props.categoria],
  () => {
    discard()
    result.value = null
    text.value = ''
    original.value = ''
    captureId.value = null
    applied.value = false
  },
)
onBeforeUnmount(discard)
async function start() {
  if (processing.value || requesting.value) return
  discard()
  applied.value = false
  requesting.value = true
  recording.value = true
  await nextTick()
  try {
    if (!(await recorder.value?.startRecording?.())) {
      recording.value = false
      error.value = recorder.value?.getError?.() || 'No fue posible iniciar la grabación.'
    }
  } finally {
    requesting.value = false
  }
}
function status(state: string, seconds: number) {
  paused.value = state === 'PAUSED'
  emit(
    'recording-state',
    recording.value && ['RECORDING', 'PAUSED'].includes(state),
    paused.value,
    seconds,
  )
}
function recorded(blob: Blob | null) {
  if (!blob) return
  recording.value = false
  paused.value = false
  emit('recording-state', false, false, 0)
  if (!blob.size || blob.size > MAX_AUDIO_BYTES) {
    error.value = 'Audio vacío o superior a 20 MB.'
    return
  }
  audio.value = blob
  result.value = null
  applied.value = false
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  discard()
  if (!file.size || file.size > MAX_AUDIO_BYTES) {
    error.value = 'El archivo está vacío o supera 20 MB.'
    return
  }
  if (!ALLOWED_AUDIO_EXTENSIONS.test(file.name)) {
    error.value = 'Formato de audio no admitido.'
    return
  }
  const current = generation
  const validation = validateAudioDuration(await readAudioDuration(file))
  if (current !== generation) return
  if (validation) {
    error.value = validation
    return
  }
  recorded(file)
}
async function process(useAudio = false) {
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
  const submittedText = text.value
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
            ...(captureId.value ? { captura_origen: captureId.value } : {}),
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
        captureId.value = response.id
        if (response.estado === 'ERROR') {
          error.value =
            'No se pudo procesar la captura. Conserva o corrige el texto y vuelve a intentar.'
          return
        }
        if (useAudio) {
          // Set editable text before the result: the watcher invalidates prior interpretations.
          text.value = response.texto_transcrito_original ?? ''
          original.value = response.texto_asr_original ?? response.texto_transcrito_original ?? ''
          audio.value = null
        } else {
          result.value = response
          if (!proposal.value)
            error.value =
              'No se identificó una propuesta comercial. Añade o corrige la descripción y vuelve a procesar.'
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
function normalizeText() {
  text.value = text.value
    .normalize('NFC')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function apply() {
  if (!result.value || !proposal.value || processing.value) return
  applied.value = true
  emit('applied', result.value)
  result.value = null
}
</script>
<template>
  <section
    class="staged-voice"
    aria-label="Captura por voz con revisión humana"
    :aria-busy="processing"
  >
    <h3>Descripción por voz</h3>
    <p>Dicta nombre, medidas, materiales o características del mueble o producto.</p>
    <VoiceCaptureControls
      :recording="recording"
      :paused="paused"
      :disabled="processing || requesting"
      @record="start"
      @upload="fileInput?.click()"
      @pause="recorder?.pauseRecording()"
      @resume="recorder?.resumeRecording()"
      @finish="recorder?.stopRecording()"
      @cancel="discard"
    >
      <template #recorder
        ><AudioRecorder v-if="recording" ref="recorder" compact @ready="recorded" @status="status"
      /></template>
    </VoiceCaptureControls>
    <input
      ref="fileInput"
      type="file"
      aria-label="Archivo de audio para transcribir"
      aria-hidden="true"
      tabindex="-1"
      accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.aac,.opus,.mp4,.flac"
      class="file-input"
      :disabled="processing || recording"
      @change="upload"
    />
    <AudioReview
      v-if="audio"
      :audio="audio"
      :disabled="processing"
      @transcribe="process(true)"
      @discard="discard"
    />
    <template v-if="!applied">
      <label
        >Revisar y corregir transcripción<textarea
          v-model="text"
          :aria-invalid="Boolean(transcriptError && text)"
          :maxlength="MAX_TRANSCRIPT_CHARACTERS + 1"
          rows="7"
          :disabled="recording"
        />
      </label>
      <Button
        variant="secondary"
        :disabled="processing || recording || !text"
        @click="normalizeText"
        >Normalizar espacios</Button
      >
      <small aria-live="polite"
        >{{ text.length }} / {{ MAX_TRANSCRIPT_CHARACTERS }} caracteres</small
      >
      <details v-if="original">
        <summary>Transcripción original del ASR (evidencia)</summary>
        <p class="original">{{ original }}</p>
      </details>
      <p v-if="text && transcriptError" role="alert">{{ transcriptError }}</p>
      <Button
        :disabled="processing || recording || Boolean(transcriptError)"
        @click="process(false)"
        >Procesar texto</Button
      >
      <section v-if="result && proposal" aria-label="Revisar propuesta comercial">
        <h3>Revisar propuesta</h3>
        <TranscriptEvidence :text="text" :evidence="evidence" />
        <pre class="proposal">{{ JSON.stringify(proposal, null, 2) }}</pre>
        <ul v-if="warnings.length">
          <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
        </ul>
        <p v-if="dirty">
          La aplicación reemplazará la información de este mueble. Revisa los datos antes de
          confirmar.
        </p>
        <p>
          Confirma la propuesta para incorporarla. Las observaciones pendientes se revisarán en los
          campos del formulario.
        </p>
        <Button :disabled="processing" @click="apply">Aplicar propuesta</Button>
      </section>
    </template>
    <p v-else role="status">Propuesta aplicada. Continúa en los campos del formulario.</p>
    <p v-if="processing" role="status">
      {{
        audio
          ? 'Transcribiendo audio; todavía no se ejecuta NLP.'
          : 'Interpretando el texto revisado.'
      }}
      <Button variant="secondary" @click="cancel">Cancelar</Button>
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>
.staged-voice {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-3);
}
h3,
p {
  margin: 0;
}
label {
  display: grid;
  gap: var(--space-2);
  font-weight: 600;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-3);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  font: inherit;
  resize: vertical;
}
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
}
.original,
.proposal {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 24rem;
  overflow-y: auto;
}
</style>
