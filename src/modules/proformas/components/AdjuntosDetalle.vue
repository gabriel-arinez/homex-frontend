<script setup lang="ts">
import ImageGallery from '@/shared/media/ImageGallery.vue'
defineProps<{ proformaId: number; detalleId: number; editable: boolean }>()
</script>
<template>
  <ImageGallery
    :endpoint="`/api/v1/proformas/${proformaId}/detalles/${detalleId}/archivos/`"
    :editable="editable"
    title="Imágenes de referencia"
  />
</template>
