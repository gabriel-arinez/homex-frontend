<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { CheckCircle2, CircleAlert, Info, X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    message: string
    tone?: 'success' | 'danger' | 'info'
    duration?: number
  }>(),
  { tone: 'success', duration: 5000 },
)
const emit = defineEmits<{ close: [] }>()
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => [props.visible, props.message] as const,
  () => {
    if (timer) clearTimeout(timer)
    if (props.visible && props.duration > 0) timer = setTimeout(() => emit('close'), props.duration)
  },
  { immediate: true },
)
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="toast"
      :class="'toast--' + tone"
      :role="tone === 'danger' ? 'alert' : 'status'"
      :aria-live="tone === 'danger' ? 'assertive' : 'polite'"
    >
      <CheckCircle2 v-if="tone === 'success'" :size="20" aria-hidden="true" />
      <CircleAlert v-else-if="tone === 'danger'" :size="20" aria-hidden="true" />
      <Info v-else :size="20" aria-hidden="true" />
      <span>{{ message }}</span>
      <button type="button" aria-label="Cerrar notificación" @click="emit('close')"><X :size="17" aria-hidden="true" /></button>
    </div>
  </Teleport>
</template>
<style scoped>
.toast {
  position: fixed;
  z-index: 120;
  top: var(--space-5);
  right: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: min(28rem, calc(100vw - 2rem));
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-success);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  color: var(--color-text);
  box-shadow: 0 8px 24px var(--color-overlay);
}
.toast span { flex: 1; line-height: 1.5; overflow-wrap: anywhere; }
.toast > svg { flex: 0 0 auto; color: var(--color-success); }
.toast button {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.toast button:hover { background: var(--color-surface-hover); }
.toast--danger { border-left-color: var(--color-danger); }
.toast--danger > svg { color: var(--color-danger); }
.toast--info { border-left-color: var(--color-info); }
.toast--info > svg { color: var(--color-info); }
@media (max-width: 35rem) { .toast { top: var(--space-3); right: var(--space-3); left: var(--space-3); max-width: none; } }
</style>
