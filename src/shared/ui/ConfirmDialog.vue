<script setup lang="ts">
import Modal from './Modal.vue'
import Button from './Button.vue'
defineProps<{ open: boolean; title: string; description: string; confirmLabel?: string }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
</script>
<template>
  <Modal :open :title :description @close="emit('close')"
    ><template #footer
      ><Button variant="secondary" @click="emit('close')">Cancelar</Button
      ><Button variant="danger" @click="emit('confirm')">{{
        confirmLabel ?? 'Confirmar'
      }}</Button></template
    ></Modal
  >
</template>
