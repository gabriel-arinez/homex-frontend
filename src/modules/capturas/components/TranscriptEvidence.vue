<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, Layers3, Ruler, Wallet } from '@lucide/vue'
import {
  categorizeEvidenceLabel,
  evidenceSegments,
  type EvidenceCategory,
  type VoiceEvidence,
} from '../voiceEvidence'

const props = defineProps<{ text: string; evidence: VoiceEvidence[] }>()
const parts = computed(() =>
  evidenceSegments(props.text, props.evidence).map((part) => {
    const category = part.decision
      ? (part.category ?? categorizeEvidenceLabel(part.fieldLabel, part.decision))
      : undefined
    return { ...part, category }
  }),
)

const categoryMeta: Record<
  EvidenceCategory,
  { label: string; short: string; icon: typeof Wallet }
> = {
  commercial: { label: 'Comercial y precio', short: 'Comercial', icon: Wallet },
  dimensions: { label: 'Dimensiones', short: 'Medidas', icon: Ruler },
  structure: {
    label: 'Materiales, componentes y características',
    short: 'Material / Comp.',
    icon: Layers3,
  },
  conflict: {
    label: 'Conflicto o requiere revisión',
    short: 'Conflicto / Revisión',
    icon: AlertCircle,
  },
}

const activeCategories = computed(() => {
  const seen = new Set<EvidenceCategory>()
  for (const part of parts.value) {
    if (part.decision && part.category) seen.add(part.category)
  }
  const order: EvidenceCategory[] = ['commercial', 'dimensions', 'structure', 'conflict']
  return order.filter((cat) => seen.has(cat))
})
</script>

<template>
  <section class="evidence-box" aria-label="Evidencias de interpretación">
    <div v-if="activeCategories.length" class="legend" aria-label="Código de colores">
      <span
        v-for="cat in activeCategories"
        :key="cat"
        class="legend-pill"
        :class="`legend-pill--${cat}`"
      >
        <component :is="categoryMeta[cat].icon" :size="12" aria-hidden="true" />
        {{ categoryMeta[cat].short }}
      </span>
    </div>
    <p v-else class="legend-empty">
      Transcripción original del dictado (sin etiquetas destacadas).
    </p>
    <p class="transcript">
      <template v-for="(part, index) in parts" :key="index">
        <mark
          v-if="part.decision"
          :class="[
            part.decision,
            part.category ? `cat--${part.category}` : '',
            part.resolved ? 'is-resolved' : '',
          ]"
          :title="`${part.fieldLabel || categoryMeta[part.category ?? 'structure'].label}${part.reason ? ': ' + part.reason : ''}`"
          >{{ part.text }}</mark
        ><template v-else>{{ part.text }}</template>
      </template>
    </p>
  </section>
</template>

<style scoped>
.evidence-box {
  display: grid;
  gap: 0.65rem;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.legend-empty {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
.legend-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 650;
  border: 1px solid transparent;
}
.legend-pill--commercial {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.12);
  border-color: rgba(22, 163, 74, 0.35);
}
.legend-pill--dimensions {
  color: #0284c7;
  background: rgba(56, 189, 248, 0.14);
  border-color: rgba(56, 189, 248, 0.4);
}
.legend-pill--structure {
  color: #8b5cf6;
  background: rgba(167, 139, 250, 0.14);
  border-color: rgba(167, 139, 250, 0.35);
}
.legend-pill--conflict {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.38);
}
.transcript {
  margin: 0;
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.9;
  font-size: 0.86rem;
  color: var(--color-text);
}
mark {
  color: inherit;
  background: transparent;
  border-radius: 4px;
  padding: 0.08rem 0.22rem;
}
mark.cat--commercial {
  background: rgba(22, 163, 74, 0.14);
  border-bottom: 2px solid #16a34a;
}
mark.cat--dimensions {
  background: rgba(56, 189, 248, 0.16);
  border-bottom: 2px solid #0284c7;
}
mark.cat--structure {
  background: rgba(167, 139, 250, 0.16);
  border-bottom: 2px solid #8b5cf6;
}
mark.cat--conflict,
mark.UNRESOLVED,
mark.REJECTED {
  background: rgba(239, 68, 68, 0.14);
  border-bottom: 2px dashed #dc2626;
}
mark.is-resolved {
  border-bottom-style: solid;
}
</style>
