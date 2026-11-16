<script setup lang="ts">
import type { ResultadoAsistida, ResultadoCatalogo } from '@/generated/api'
import StagedVoiceCapture from '@/modules/capturas/components/StagedVoiceCapture.vue'
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
function apply(result: ResultadoAsistida | ResultadoCatalogo) {
  if (!('propuesta_configurador' in result) || !result.propuesta_configurador) return
  // The single parent event follows explicit human confirmation in the drawer.
  if (props.reviewBeforeApply) emit('proposed', result)
  else emit('applied', result)
}
</script>
<template>
  <StagedVoiceCapture
    mode="furniture"
    :dirty="dirty"
    :sesion="sesion"
    :moneda="moneda"
    :proforma="proforma"
    @applied="apply"
    @processing="emit('processing', $event)"
    @recording-state="(active, paused, elapsed) => emit('recording-state', active, paused, elapsed)"
  />
</template>
