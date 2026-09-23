<script setup lang="ts">
import Badge from './Badge.vue'
const props = defineProps<{ status: string }>()
const tones: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  BORRADOR: 'neutral',
  ENVIADA: 'info',
  APROBADA: 'success',
  CONFIRMADO: 'info',
  EN_PRODUCCION: 'warning',
  LISTO_ENTREGA: 'success',
  ENTREGADO: 'success',
  CANCELADA: 'danger',
  ERROR: 'danger',
}
</script>
<template>
  <Badge :tone="tones[props.status] ?? 'neutral'">{{ status.replaceAll('_', ' ') }}</Badge>
</template>
