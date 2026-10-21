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
const original = ref('')
const corrected = ref('')
const captureId = ref<number | null>(null)
const pendingText = ref('')
watch(voice.processing, (value) => emit('processing', value))
watch(
  () => [props.sesion, props.moneda, props.proforma],
  () => {
    voice.cancel()
    recording.value = false
  },
)
function start() {
  pendingText.value = ''
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
  if (!result || context !== JSON.stringify([props.sesion, props.moneda, props.proforma])) return
  original.value = result.texto_transcrito_original ?? ''
  corrected.value = original.value
  captureId.value = result.id
  emit('applied', result)
}
function cancel() {
  voice.cancel()
  recording.value = false
}
</script>
<template>
  <section aria-label="Asistencia por voz">
    <Button :disabled="voice.processing.value" @click="start">Dictar especificaciones</Button>
    <template v-if="recording">
      <AudioRecorder @ready="(audio) => audio && send(audio)" />
      <Button variant="secondary" @click="cancel">Cancelar dictado</Button>
    </template>
    <p v-if="voice.processing.value" role="status">Procesando… El mueble anterior se conserva.</p>
    <Button v-if="voice.processing.value" variant="secondary" @click="cancel"
      >Cancelar procesamiento</Button
    >
    <p v-if="voice.error.value" role="alert">{{ voice.error.value }}</p>
    <details v-if="original">
      <summary>Ver transcripción</summary>
      <p>{{ original }}</p>
      <label
        >Corregir texto para una nueva interpretación<textarea
          v-model="corrected"
          :disabled="voice.processing.value"
        />
      </label>
      <Button
        :disabled="voice.processing.value || !corrected.trim() || corrected === original"
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
