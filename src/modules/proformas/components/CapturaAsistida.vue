<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ResultadoAsistida } from '@/generated/api'
import AudioRecorder from '@/modules/capturas/components/AudioRecorder.vue'
import Button from '@/shared/ui/Button.vue'
import Modal from '@/shared/ui/Modal.vue'
import { useCapturaAsistida } from '../composables/useCapturaAsistida'

const props = defineProps<{
  dirty: boolean
  sesion: string
  moneda: 'BOB' | 'USD'
  proforma?: number | null
}>()
const emit = defineEmits<{ applied: [result: ResultadoAsistida]; processing: [value: boolean] }>()
const voice = useCapturaAsistida()
const confirm = ref(false)
const recording = ref(false)
const fileError = ref('')
const MAX_AUDIO_BYTES = 25_000_000
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
  },
)
function start() {
  pendingText.value = ''
  fileError.value = ''
  if (voice.processing.value) return
  if (props.dirty) confirm.value = true
  else recording.value = true
}
function proceed() {
  confirm.value = false
  if (pendingText.value) void send(undefined, pendingText.value)
  else recording.value = true
}
function reinterpret() {
  pendingText.value = corrected.value
  if (props.dirty) confirm.value = true
  else void send(undefined, pendingText.value)
}
function seleccionarAudio(event: Event) {
  const input = event.target as HTMLInputElement
  const archivo = input.files?.[0]
  input.value = ''
  fileError.value = ''

  if (!archivo || !recording.value || voice.processing.value) return

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
    fileError.value = 'El archivo supera el límite de 25 MB.'
    return
  }

  void send(archivo)
}

async function send(audio?: Blob, texto?: string) {
  recording.value = false
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
  // Una respuesta terminal sin propuesta no debe sustituir el mueble.
  // La transcripción queda disponible para revisión y reinterpretación.
  if (
    result &&
    result.resultado === 'REQUIRES_REVIEW' &&
    result.propuesta_configurador &&
    result.version_proyeccion === 'PRF04_2'
  ) {
    emit('applied', result)
  }
}
function cancel() {
  voice.cancel()
  recording.value = false
  fileError.value = ''
}
</script>
<template>
  <section aria-label="Asistencia por voz">
    <Button :disabled="voice.processing.value" @click="start">Dictar especificaciones</Button>
    <template v-if="recording">
      <AudioRecorder @ready="(audio) => audio && send(audio)" />
      <div class="audio-file-option">
        <label>
          O seleccionar archivo de audio
          <input
            type="file"
            accept=".wav,.mp3,.m4a,.ogg,.webm"
            aria-label="Seleccionar archivo de audio"
            @change="seleccionarAudio"
          />
        </label>
        <p>Formatos: WAV, MP3, M4A, OGG y WebM. Máximo 25 MB.</p>
        <p v-if="fileError" role="alert">{{ fileError }}</p>
      </div>
      <Button variant="secondary" @click="cancel">Cancelar dictado</Button>
    </template>
    <p v-if="voice.processing.value" role="status">Procesando… El mueble anterior se conserva.</p>
    <Button v-if="voice.processing.value" variant="secondary" @click="cancel"
      >Cancelar procesamiento</Button
    >
    <p v-if="voice.error.value" role="alert">{{ voice.error.value }}</p>
    <details v-if="original">
      <summary>Ver transcripción original</summary>
      <p>{{ original }}</p>
      <p v-if="lastInterpretation && lastInterpretation !== original">
        Última interpretación: {{ lastInterpretation }}
      </p>
      <label
        >Corregir texto para una nueva interpretación<textarea
          v-model="corrected"
          :disabled="voice.processing.value"
        />
      </label>
      <Button
        :disabled="voice.processing.value || !corrected.trim() || corrected === lastInterpretation"
        @click="reinterpret"
        >Interpretar texto corregido</Button
      >
    </details>
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
.audio-file-option {
  display: grid;
  gap: var(--space-2);
  margin-block: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.audio-file-option label {
  display: grid;
  gap: var(--space-2);
  font-weight: 600;
}
.audio-file-option input {
  max-width: 100%;
  font-weight: 400;
}
.audio-file-option p {
  margin: 0;
  font-size: 0.875rem;
}
.audio-file-option [role='alert'] {
  color: var(--color-danger-text);
}
</style>
