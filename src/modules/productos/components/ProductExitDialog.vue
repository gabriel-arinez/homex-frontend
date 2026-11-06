<script setup lang="ts">
import { useId } from 'vue'
import { AlertTriangle, ArrowLeft, CircleAlert, LogOut, Save } from '@lucide/vue'
import Modal from '@/shared/ui/Modal.vue'
import Button from '@/shared/ui/Button.vue'

withDefaults(
  defineProps<{
    open: boolean
    saving?: boolean
    existingProductId?: number | null
    error?: string
  }>(),
  { saving: false, existingProductId: null, error: '' },
)
const emit = defineEmits<{ stay: []; discard: []; save: [] }>()
const titleId = useId()
</script>

<template>
  <Modal
    :open="open"
    :title-id="titleId"
    :title="existingProductId ? 'Producto ya registrado' : '¿Deseas salir del producto?'"
    priority
    @close="!saving && emit('stay')"
  >
    <div class="exit-overview">
      <div class="exit-icon">
        <AlertTriangle :size="24" aria-hidden="true" />
      </div>
      <div>
        <h3>
          {{ existingProductId ? 'El registro ya existe' : 'Tienes información sin guardar' }}
        </h3>
        <p v-if="existingProductId">
          El producto #{{ existingProductId }} está registrado. Salir no lo elimina. Puedes
          completar las imágenes pendientes o abrir su ficha.
        </p>
        <p v-else>
          Puedes guardar el producto y continuar después. Si descartas los cambios, la información
          introducida se perderá.
        </p>
      </div>
    </div>
    <p v-if="error" class="exit-error" role="alert">
      <CircleAlert :size="18" aria-hidden="true" /> {{ error }}
    </p>
    <template #footer>
      <div class="exit-actions">
        <Button variant="secondary" :disabled="saving" @click="emit('stay')">
          <ArrowLeft :size="17" aria-hidden="true" /> Seguir editando
        </Button>
        <div class="exit-actions__decisions">
          <Button
            variant="danger"
            class="exit-discard"
            :disabled="saving"
            @click="emit('discard')"
          >
            <LogOut :size="17" aria-hidden="true" />
            {{ existingProductId ? 'Ir a la ficha' : 'Descartar y salir' }}
          </Button>
          <Button variant="success" class="exit-save" :processing="saving" @click="emit('save')">
            <Save :size="17" aria-hidden="true" />
            {{ existingProductId ? 'Completar y salir' : 'Guardar producto y salir' }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.exit-overview {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}
.exit-icon {
  display: grid;
  place-items: center;
  flex: 0 0 3.25rem;
  height: 3.25rem;
  border-radius: var(--radius-card);
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.exit-overview h3 {
  margin: 0 0 var(--space-2);
  font-size: 1rem;
}
.exit-overview p {
  margin: 0;
  line-height: 1.55;
  color: var(--color-text-secondary);
}
.exit-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--color-danger-text);
  background: var(--color-danger-soft);
  border-radius: var(--radius-control);
  padding: var(--space-3);
  margin: var(--space-4) 0 0;
}
.exit-error svg {
  flex: none;
}
.exit-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  width: 100%;
}
.exit-actions__decisions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.exit-actions :deep(.button) {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
@media (max-width: 40rem) {
  .exit-actions,
  .exit-actions__decisions {
    flex-direction: column;
    width: 100%;
  }
  .exit-actions :deep(.button) {
    width: 100%;
  }
}
</style>
