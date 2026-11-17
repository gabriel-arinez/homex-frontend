<script setup lang="ts">
import type {
  CamposCatalogo,
  CategoriaEnum,
  ResultadoCatalogo,
  ResultadoAsistida,
  ValorCatalogoPublico,
} from '@/generated/api'
import type { VoiceFieldReview } from '@/modules/capturas/fieldVoiceReview'
import StagedVoiceCapture from '@/modules/capturas/components/StagedVoiceCapture.vue'
const props = defineProps<{
  categoria: CategoriaEnum
  opciones?: Record<string, ValorCatalogoPublico[]>
}>()
const emit = defineEmits<{
  applied: [
    payload: {
      capture_id: number
      field_reviews: VoiceFieldReview[]
      fields: CamposCatalogo
      text: string
      warnings: string[]
      evidence: NonNullable<ResultadoCatalogo['propuesta']>['evidence']
    },
  ]
  'recording-state': [active: boolean, paused: boolean, elapsed: number]
  'processing-state': [active: boolean]
}>()
const session = crypto.randomUUID()
function apply(result: ResultadoCatalogo | ResultadoAsistida) {
  if (!('propuesta' in result) || !result.propuesta) return
  emit('applied', {
    capture_id: result.id,
    field_reviews:
      (result.propuesta as typeof result.propuesta & { field_reviews?: VoiceFieldReview[] })
        .field_reviews ?? [],
    fields: result.propuesta.fields,
    text: result.texto_transcrito_original ?? '',
    warnings: result.propuesta.warnings,
    evidence: result.propuesta.evidence,
  })
}
</script>
<template>
  <StagedVoiceCapture
    mode="catalog"
    :categoria="props.categoria"
    :options="props.opciones"
    :sesion="session"
    @applied="apply"
    @recording-state="(active, paused, elapsed) => emit('recording-state', active, paused, elapsed)"
    @processing="emit('processing-state', $event)"
  />
</template>
