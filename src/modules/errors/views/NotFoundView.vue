<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ErrorState from '@/shared/ui/ErrorState.vue'
</script>
<template>
  <ErrorState title="Página no encontrada" description="La dirección solicitada no existe."
    ><RouterLink to="/resumen">Volver al resumen</RouterLink></ErrorState
  >
</template>
