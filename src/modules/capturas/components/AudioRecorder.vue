<script setup lang="ts">
import { computed, watch } from 'vue'
import { Mic, Square, X, RotateCcw, Pause, Play } from '@lucide/vue'
import { MAX_RECORD_SECONDS } from '../audioLimits'
import Button from '@/shared/ui/Button.vue'
import { useAudioRecorder } from '../composables/useAudioRecorder'
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const emit = defineEmits<{
  ready: [blob: Blob | null]
  status: [state: string, elapsed: number]
}>()
const r = useAudioRecorder(),
  time = computed(
    () =>
      `${String(Math.floor(r.elapsed.value / 60)).padStart(2, '0')}:${String(r.elapsed.value % 60).padStart(2, '0')}`,
  )
watch(r.blob, (value) => emit('ready', value))
watch([r.state, r.elapsed], () => emit('status', r.state.value, r.elapsed.value), { immediate: true })
async function start() {
  await r.start()
  emit('ready', null)
  return r.state.value === 'RECORDING'
}
defineExpose({
  startRecording: start,
  stopRecording: () => r.stop(),
  pauseRecording: () => r.pause(),
  resumeRecording: () => r.resume(),
  getState: () => r.state.value,
  cancelRecording: () => r.cancel(),
  getError: () => r.error.value,
})
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
    <h2 id="recorder-title">Grabación de audio</h2>
    <p v-if="r.state.value === 'RECORDING' || r.state.value === 'PAUSED'" role="status" class="recording">
      <span aria-hidden="true"></span>{{ r.state.value === 'PAUSED' ? 'Pausado' : 'Grabando' }}
      {{ time }} / 03:00
    </p>
    <p v-if="r.elapsed.value >= MAX_RECORD_SECONDS - 30 && r.state.value !== 'READY'" role="status">
      Quedan {{ MAX_RECORD_SECONDS - r.elapsed.value }} segundos para finalizar automáticamente.
    </p>
    <div
      v-if="r.state.value === 'RECORDING'"
      class="live-waveform"
      role="img"
      aria-label="Actividad real del micrófono"
    >
      <span
        v-for="(level, index) in r.levels.value"
        :key="index"
        :style="{ height: 4 + level * 34 + 'px' }"
      />
    </div>
    <p v-else-if="r.state.value === 'READY'" role="status">
      Audio listo. Se enviará para su interpretación.
    </p>
    <p v-if="r.error.value" role="alert" class="error">{{ r.error.value }}</p>
    <div v-if="!props.compact" class="actions">
      <Button
        v-if="['IDLE', 'DENIED', 'ERROR', 'UNSUPPORTED'].includes(r.state.value)"
        :disabled="!r.supported.value"
        @click="start"
        ><Mic />Grabar</Button
      ><Button v-if="r.state.value === 'RECORDING'" variant="secondary" @click="r.pause"><Pause />Pausar</Button
      ><Button v-if="r.state.value === 'PAUSED'" variant="secondary" @click="r.resume"><Play />Reanudar</Button
      ><Button v-if="['RECORDING', 'PAUSED'].includes(r.state.value)" @click="stop"><Square />Finalizar</Button
      ><Button v-if="['RECORDING', 'PAUSED'].includes(r.state.value)" variant="secondary" @click="cancel"
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
.recorder {
  background: transparent;
  padding: 0;
  border: 0;
}
.recorder h2 {
  font-size: 0.87rem;
  margin: 0 0 0.45rem;
}
.recorder .actions button {
  min-height: 2.75rem;
}
.recorder .recording {
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 0.8rem;
  background: var(--color-primary-soft);
  border-radius: var(--radius-control);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.live-waveform {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 3px;
  min-height: 44px;
  max-width: 38rem;
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
  padding: 5px;
  margin: 0.5rem 0 1rem;
}
.live-waveform span {
  display: block;
  flex: 1;
  max-width: 8px;
  min-width: 2px;
  border-radius: 3px;
  background: var(--color-primary);
  transition: height 70ms linear;
}
@media (prefers-reduced-motion: reduce) {
  .live-waveform span {
    transition: none;
  }
}
</style>
