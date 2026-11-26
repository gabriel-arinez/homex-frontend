<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { AlertTriangle, RotateCcw, Trash2, Volume2 } from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
const props = defineProps<{ audio: Blob; disabled?: boolean; retry?: boolean }>()
const emit = defineEmits<{ retry: []; discard: []; duration: [seconds: number] }>()
const url = ref('')
const warning = ref('')
let generation = 0
watch(
  () => props.audio,
  async (blob) => {
    const current = ++generation
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = URL.createObjectURL(blob)
    warning.value = ''
    // Silence is advisory: low-volume speech must never be blocked.
    if (!window.AudioContext) return
    let context: AudioContext | undefined
    try {
      context = new AudioContext()
      const decoded = await context.decodeAudioData(await blob.arrayBuffer())
      if (current === generation && Number.isFinite(decoded.duration) && decoded.duration > 0) {
        emit('duration', decoded.duration)
      }
      let peak = 0
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const samples = decoded.getChannelData(channel)
        for (let index = 0; index < samples.length; index++)
          peak = Math.max(peak, Math.abs(samples[index]!))
      }
      if (current === generation && peak < 0.001)
        warning.value =
          'Es posible que no haya voz audible. Escucha el audio; puedes repetirlo si no se entiende.'
    } catch {
      // The server performs authoritative decoded-audio validation.
    } finally {
      await context?.close().catch(() => undefined)
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>
<template>
  <section class="audio-review-card" aria-label="Audio capturado">
    <header class="audio-review-card__head">
      <span class="audio-review-card__icon" aria-hidden="true">
        <Volume2 :size="17" />
      </span>
      <div>
        <strong>Pista de audio grabada</strong>
        <small>Puedes escucharla antes de procesar o volver a grabarla.</small>
      </div>
    </header>
    <audio
      :src="url"
      controls
      aria-label="Escuchar audio capturado"
      @loadedmetadata="
        (e) => {
          const d = (e.target as HTMLAudioElement).duration
          if (Number.isFinite(d) && d > 0) emit('duration', d)
        }
      "
    />
    <p v-if="warning" class="audio-review-card__warning" role="status">
      <AlertTriangle :size="15" aria-hidden="true" />
      <span>{{ warning }}</span>
    </p>
    <div class="actions">
      <Button v-if="retry" variant="primary" :disabled="disabled" @click="emit('retry')">
        <RotateCcw :size="15" aria-hidden="true" />
        Reintentar transcripción
      </Button>
      <Button variant="danger" :disabled="disabled" @click="emit('discard')">
        <Trash2 :size="15" aria-hidden="true" />
        Descartar y repetir
      </Button>
    </div>
  </section>
</template>
<style scoped>
.audio-review-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.audio-review-card__head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.audio-review-card__icon {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  flex: none;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--color-info-soft);
  color: var(--color-info);
  border: 1px solid color-mix(in srgb, var(--color-info) 28%, transparent);
}
.audio-review-card__head strong {
  display: block;
  font-size: 0.88rem;
}
.audio-review-card__head small {
  display: block;
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}
audio {
  width: 100%;
  height: 2.4rem;
}
.audio-review-card__warning {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-control);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: 0.8rem;
  font-weight: 600;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
