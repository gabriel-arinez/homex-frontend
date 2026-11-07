<script setup lang="ts">
import { Mic, RotateCcw } from '@lucide/vue'

defineProps<{
  title: string
  description: string
  icon: 'mic' | 'review'
}>()
</script>

<template>
  <section class="voice-section">
    <div class="voice-section-heading">
      <Mic v-if="icon === 'mic'" :size="19" aria-hidden="true" />
      <RotateCcw v-else :size="19" aria-hidden="true" />
      <div>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.voice-section {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.voice-section + .voice-section {
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
.voice-section-heading {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.voice-section-heading > svg {
  flex: 0 0 auto;
  color: var(--color-primary);
}
.voice-section-heading h2 {
  margin: 0;
  font-size: 1.06rem;
}
.voice-section-heading p {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
