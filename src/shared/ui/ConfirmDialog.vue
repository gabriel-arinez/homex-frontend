<script setup lang="ts">
import { useId } from 'vue'
import { AlertTriangle, ArrowLeft, Trash2, Check } from '@lucide/vue'
import Modal from './Modal.vue'
import Button from './Button.vue'
defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  variant?: 'danger' | 'success' | 'info' | 'primary'
}>()
const emit = defineEmits<{ close: []; confirm: [] }>()
const titleId = useId()
</script>

<template>
  <Modal :open :title :title-id="titleId" priority @close="emit('close')">
    <div class="confirm-body">
      <span class="confirm-icon"><AlertTriangle :size="24" aria-hidden="true" /></span>
      <p>{{ description }}</p>
    </div>
    <template #footer>
      <div class="confirm-actions">
        <Button variant="secondary" @click="emit('close')">
          <ArrowLeft :size="16" aria-hidden="true" />
          {{ title === 'Descartar línea' ? 'Seguir editando' : 'Cancelar' }}
        </Button>
        <Button
          :variant="
            variant ??
            (danger ||
            title.toLowerCase().startsWith('descartar') ||
            title.toLowerCase().startsWith('salir') ||
            title.toLowerCase().startsWith('eliminar') ||
            title.toLowerCase().startsWith('anular') ||
            title.toLowerCase().startsWith('cancelar')
              ? 'danger'
              : 'success')
          "
          @click="emit('confirm')"
        >
          <Trash2
            v-if="
              (variant === 'danger' ||
                (!variant &&
                  (danger ||
                    title.toLowerCase().startsWith('descartar') ||
                    title.toLowerCase().startsWith('salir') ||
                    title.toLowerCase().startsWith('eliminar') ||
                    title.toLowerCase().startsWith('anular') ||
                    title.toLowerCase().startsWith('cancelar'))))
            "
            :size="16"
            aria-hidden="true"
          />
          <Check v-else :size="16" aria-hidden="true" />
          {{ confirmLabel ?? 'Confirmar' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.confirm-body {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}
.confirm-body p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.confirm-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.85rem;
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.6rem;
  width: 100%;
}
.confirm-actions :deep(.button) {
  min-height: 2.75rem;
}
@media (max-width: 36rem) {
  .confirm-actions {
    flex-direction: column;
  }
  .confirm-actions :deep(.button) {
    width: 100%;
  }
}
</style>
