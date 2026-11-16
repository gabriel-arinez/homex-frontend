<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import Button from '@/shared/ui/Button.vue'
const props = defineProps<{ audio: Blob; disabled?: boolean }>()
const emit = defineEmits<{ transcribe: []; discard: [] }>()
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
    const context = new AudioContext()
    try {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer())
      let peak = 0
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const samples = decoded.getChannelData(channel)
        for (let index = 0; index < samples.length; index++)
          peak = Math.max(peak, Math.abs(samples[index]!))
      }
      if (current === generation && peak < 0.001)
        warning.value =
          'Es posible que no haya voz audible. Escucha el audio; puedes enviarlo si se entiende.'
    } catch {
      // The server performs authoritative decoded-audio validation.
    } finally {
      await context.close().catch(() => undefined)
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
  <section aria-label="Revisar audio antes de transcribir">
    <audio :src="url" controls aria-label="Escuchar audio capturado" />
    <p v-if="warning" role="status">{{ warning }}</p>
    <div class="actions">
      <Button :disabled="disabled" @click="emit('transcribe')">Transcribir audio</Button>
      <Button variant="secondary" :disabled="disabled" @click="emit('discard')"
        >Descartar y repetir</Button
      >
    </div>
  </section>
</template>
<style scoped>
audio {
  width: 100%;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
