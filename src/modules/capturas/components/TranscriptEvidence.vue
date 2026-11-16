<script setup lang="ts">
import { computed } from 'vue'
import { evidenceSegments, type VoiceEvidence } from '../voiceEvidence'
const props = defineProps<{ text: string; evidence: VoiceEvidence[] }>()
const parts = computed(() => evidenceSegments(props.text, props.evidence))
const labels = { ACCEPTED: 'Reconocido', UNRESOLVED: 'Pendiente', REJECTED: 'Descartado' }
</script>
<template>
  <section aria-label="Evidencias de interpretación">
    <p class="legend">Reconocido · Pendiente · Descartado</p>
    <p class="transcript">
      <template v-for="(part, index) in parts" :key="index"
        ><mark
          v-if="part.decision"
          :class="part.decision"
          :title="`${labels[part.decision]}${part.reason ? ': ' + part.reason : ''}`"
          >{{ part.text }}</mark
        ><template v-else>{{ part.text }}</template></template
      >
    </p>
  </section>
</template>
<style scoped>
.transcript {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
}
mark {
  color: inherit;
  background: transparent;
  border-radius: 2px;
}
.ACCEPTED {
  border-bottom: 2px solid var(--color-success, #23784c);
}
.UNRESOLVED {
  background: var(--color-warning-soft, #fff0bd);
  border-bottom: 2px dashed #947000;
}
.REJECTED {
  text-decoration: line-through;
  opacity: 0.7;
}
.legend {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
</style>
