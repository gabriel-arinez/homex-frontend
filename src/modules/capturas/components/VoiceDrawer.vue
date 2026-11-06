<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { X } from '@lucide/vue'
import { useFocusTrap } from '@/shared/composables/useFocusTrap'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    closeLabel?: string
  }>(),
  { closeLabel: 'Minimizar asistente de voz' },
)
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
const labelId = useId()
useFocusTrap(panel, computed(() => props.open))
</script>

<template>
  <Teleport to="body">
    <div v-show="open" class="voice-backdrop" @mousedown.self="emit('close')">
      <aside
        ref="panel"
        class="voice-drawer"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="labelId"
        @keydown.esc.stop="emit('close')"
      >
        <header class="drawer-header">
          <div>
            <p class="eyebrow">ASISTENCIA COMERCIAL</p>
            <h2 :id="labelId">{{ title }}</h2>
            <p class="muted">{{ description }}</p>
          </div>
          <button type="button" class="drawer-close" :aria-label="closeLabel" @click="emit('close')">
            <X :size="20" aria-hidden="true" />
          </button>
        </header>
        <slot />
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.voice-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  justify-content: flex-end;
  background: var(--color-overlay);
}
.voice-drawer {
  display: flex;
  flex-direction: column;
  width: min(44rem, 100%);
  height: 100dvh;
  overflow-y: auto;
  background: var(--color-surface-raised);
  border-left: 1px solid var(--color-border);
}
.drawer-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}
.drawer-header h2 {
  margin: 0.2rem 0;
  font-size: 1.45rem;
}
.drawer-header p {
  margin: 0;
  font-size: 0.85rem;
}
.drawer-header .eyebrow {
  color: var(--color-primary-accent);
  font-size: 0.73rem;
  font-weight: 750;
  letter-spacing: 0.06em;
}
.drawer-header .muted { color: var(--color-text-secondary); }
.drawer-close {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
}
.drawer-close:focus-visible { outline: 2px solid var(--color-primary-accent); outline-offset: 2px; }
@media (max-width: 42rem) {
  .voice-drawer { width: 100%; }
}
</style>
