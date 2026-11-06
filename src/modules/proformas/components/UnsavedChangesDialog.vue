<script setup lang="ts">
import { useId } from 'vue'
import { AlertTriangle, CircleAlert, Save, ArrowLeft, LogOut } from '@lucide/vue'
import Modal from '@/shared/ui/Modal.vue'
import Button from '@/shared/ui/Button.vue'

withDefaults(
  defineProps<{
    open: boolean
    saving?: boolean
    error?: string
    inReview?: boolean
  }>(),
  { saving: false, error: '', inReview: false },
)
const emit = defineEmits<{ cancel: []; discard: []; save: [] }>()
const titleId = useId()
</script>

<template>
  <Modal
    :open="open"
    :title-id="titleId"
    title="Tienes cambios sin guardar"
    priority
    @close="!saving && emit('cancel')"
  >
    <div class="leave-content">
      <div class="warning-icon">
        <AlertTriangle :size="24" aria-hidden="true" />
      </div>
      <div>
        <h3>¿Qué deseas hacer antes de salir?</h3>
        <p>
          Puedes guardar la proforma y continuar después. Si sales sin guardar, se perderán los
          cambios comerciales pendientes.
        </p>
      </div>
    </div>
    <div v-if="error" class="save-error" role="alert">
      <CircleAlert :size="18" aria-hidden="true" />
      <p>{{ error }} Permanecerás en la proforma hasta confirmar cómo continuar.</p>
    </div>
    <template #footer>
      <div class="leave-actions">
        <Button variant="secondary" :disabled="saving" @click="emit('cancel')">
          <ArrowLeft :size="16" aria-hidden="true" /> Seguir editando
        </Button>
        <div class="leave-actions__decisions">
          <Button variant="danger" :disabled="saving" @click="emit('discard')">
            <LogOut :size="16" aria-hidden="true" /> Salir sin guardar
          </Button>
          <Button class="save-action" :processing="saving" @click="emit('save')">
            <Save :size="17" aria-hidden="true" />
            {{ inReview ? 'Guardar cambios y salir' : 'Guardar borrador y salir' }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.leave-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}
.warning-icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  flex: none;
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.leave-content h3 {
  margin: 0 0 var(--space-2);
  font-size: 1.05rem;
}
.leave-content p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.55;
}
.save-error {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin-top: var(--space-4);
  padding: var(--space-3);
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-radius: var(--radius-control);
}
.save-error p {
  margin: 0;
  font-size: 0.85rem;
}
.leave-actions {
  width: 100%;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.leave-actions__decisions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.leave-actions :deep(.button) {
  min-height: 2.75rem;
}
.save-action {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
.save-action:hover:not(:disabled) {
  background: var(--color-primary-hover, var(--color-primary));
}
@media (max-width: 40rem) {
  .leave-actions,
  .leave-actions__decisions {
    flex-direction: column;
    width: 100%;
  }
  .leave-actions :deep(.button) {
    width: 100%;
  }
  .leave-content {
    flex-direction: column;
  }
}
</style>
