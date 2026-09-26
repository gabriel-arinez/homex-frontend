<script setup lang="ts">
import { computed, watch } from 'vue'
import { Mic, Square, X, RotateCcw } from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
import { useAudioRecorder } from '../composables/useAudioRecorder'
const emit = defineEmits<{ ready: [blob: Blob | null] }>()
const r = useAudioRecorder(),
  time = computed(
    () =>
      `${String(Math.floor(r.elapsed.value / 60)).padStart(2, '0')}:${String(r.elapsed.value % 60).padStart(2, '0')}`,
  )
watch(r.blob, (value) => emit('ready', value))
async function start() {
  await r.start()
  emit('ready', null)
}
function stop() {
  r.stop()
}
function cancel() {
  r.cancel()
  emit('ready', null)
}
</script>
<template>
  <section class="recorder" aria-labelledby="recorder-title">
    <h2 id="recorder-title">Dictado por voz</h2>
    <p v-if="r.state.value === 'RECORDING'" role="status" class="recording">
      <span aria-hidden="true"></span>Grabando {{ time }}
    </p>
    <p v-else-if="r.state.value === 'READY'" role="status">
      Audio listo para enviar. Se conservará sólo mientras el backend lo procesa.
    </p>
    <p v-if="r.error.value" role="alert" class="error">{{ r.error.value }}</p>
    <div class="actions">
      <Button
        v-if="['IDLE', 'DENIED', 'ERROR', 'UNSUPPORTED'].includes(r.state.value)"
        :disabled="!r.supported.value"
        @click="start"
        ><Mic />Grabar</Button
      ><Button v-if="r.state.value === 'RECORDING'" @click="stop"><Square />Detener</Button
      ><Button v-if="r.state.value === 'RECORDING'" variant="secondary" @click="cancel"
        ><X />Cancelar</Button
      ><Button v-if="r.state.value === 'READY'" variant="secondary" @click="cancel"
        ><RotateCcw />Descartar y repetir</Button
      >
    </div>
  </section>
</template>
<style scoped>
.recorder {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-soft);
}
h2 {
  margin-top: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.actions :deep(svg) {
  width: 1.1rem;
}
.recording {
  font-weight: 700;
}
.recording span {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  margin-right: 0.5rem;
  border-radius: 50%;
  background: var(--color-danger);
  animation: pulse 1s infinite;
}
.error {
  color: var(--color-danger-text);
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@media (max-width: 480px) {
  .actions > * {
    width: 100%;
    min-height: 2.75rem;
  }
}
</style>
