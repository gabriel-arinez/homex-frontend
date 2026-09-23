<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from '@lucide/vue'
import { useFocusTrap } from '@/shared/composables/useFocusTrap'
const props = defineProps<{ open: boolean; title: string; description?: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
useFocusTrap(
  panel,
  computed(() => props.open),
)
</script>
<template>
  <Teleport to="body"
    ><div v-if="open" class="backdrop" @mousedown.self="emit('close')">
      <section
        ref="panel"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        @keydown.esc="emit('close')"
      >
        <header>
          <div>
            <h2 id="modal-title">{{ title }}</h2>
            <p v-if="description">{{ description }}</p>
          </div>
          <button type="button" aria-label="Cerrar" @click="emit('close')"><X /></button>
        </header>
        <div class="modal__content"><slot /></div>
        <footer v-if="$slots.footer"><slot name="footer" /></footer>
      </section></div
  ></Teleport>
</template>
<style scoped>
.backdrop {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  padding: var(--space-4);
  place-items: center;
  background: var(--color-overlay);
}
.modal {
  width: min(36rem, 100%);
  max-height: calc(100dvh - 2rem);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-dialog);
  background: var(--color-surface-raised);
}
.modal header,
.modal footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
}
.modal header {
  border-bottom: 1px solid var(--color-border);
}
.modal footer {
  justify-content: flex-end;
  border-top: 1px solid var(--color-border);
}
.modal h2,
.modal p {
  margin: 0;
}
.modal p {
  color: var(--color-text-secondary);
}
.modal header button {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.modal__content {
  padding: var(--space-5);
}
</style>
