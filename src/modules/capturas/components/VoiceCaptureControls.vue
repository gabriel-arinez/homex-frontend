<script setup lang="ts">
import { FileAudio, Mic, Pause, Play, Square, X } from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'

withDefaults(
  defineProps<{
    recording: boolean
    paused: boolean
    disabled?: boolean
    hint?: string
  }>(),
  { disabled: false, hint: '' },
)
const emit = defineEmits<{
  record: []
  upload: []
  pause: []
  resume: []
  finish: []
  cancel: []
}>()
</script>

<template>
  <div v-if="!recording" class="voice-source-actions" role="group" aria-label="Origen del audio">
    <Button
      class="source-action source-record voice-record"
      :disabled="disabled"
      @click="emit('record')"
    >
      <Mic :size="28" aria-hidden="true" />
      <strong>Grabar descripción</strong>
      <small>Máximo 3 minutos</small>
    </Button>
    <Button
      variant="secondary"
      class="source-action voice-upload"
      :disabled="disabled"
      @click="emit('upload')"
    >
      <FileAudio :size="28" aria-hidden="true" />
      <strong>Seleccionar archivo</strong>
      <small>Hasta 20 MB y 5 minutos</small>
    </Button>
    <p v-if="hint" class="hint">{{ hint }}</p>
  </div>

  <div v-else class="voice-live">
    <slot name="recorder" />
    <div class="recording-toolbar" role="group" aria-label="Controles de grabación">
      <Button v-if="!paused" variant="secondary" @click="emit('pause')">
        <Pause :size="17" aria-hidden="true" /> Pausar
      </Button>
      <Button v-else variant="secondary" @click="emit('resume')">
        <Play :size="17" aria-hidden="true" /> Reanudar
      </Button>
      <Button aria-label="Finalizar grabación" @click="emit('finish')">
        <Square :size="17" aria-hidden="true" /> Finalizar
      </Button>
      <Button variant="danger" aria-label="Cancelar grabación" @click="emit('cancel')">
        <X :size="17" aria-hidden="true" /> Cancelar
      </Button>
    </div>
  </div>
</template>

<style scoped>
.voice-source-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
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
  opacity: 1;
}
.hint {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.voice-live {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-soft);
}
.recording-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
@media (max-width: 36rem) {
  .voice-source-actions {
    grid-template-columns: 1fr;
  }
  .voice-source-actions :deep(.source-action) {
    min-height: 7rem;
    padding: 0.65rem;
  }
}
</style>
