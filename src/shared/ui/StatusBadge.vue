<script setup lang="ts">
import Badge from './Badge.vue'

const props = defineProps<{ status: string; label?: string }>()

const tones: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  BORRADOR: 'neutral',
  EN_REVISION: 'warning',
  ENVIADA: 'info',
  APROBADA: 'success',
  CONFIRMADO: 'info',
  EN_PRODUCCION: 'warning',
  LISTO_ENTREGA: 'success',
  ENTREGADO: 'success',
  NO_CONCRETADA: 'danger',
  CANCELADA: 'danger',
  ERROR: 'danger',
  ACTIVO: 'success',
  INACTIVO: 'neutral',
}

const labels: Record<string, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  ENVIADA: 'Enviada',
  APROBADA: 'Aprobada',
  CONFIRMADO: 'Confirmado',
  EN_PRODUCCION: 'En producción',
  LISTO_ENTREGA: 'Listo para entrega',
  ENTREGADO: 'Entregado',
  NO_CONCRETADA: 'No concretada',
  CANCELADA: 'Cancelada',
  ERROR: 'Error',
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
}
</script>

<template>
  <Badge :tone="tones[props.status] ?? 'neutral'" dot>
    {{ props.label ?? labels[props.status] ?? status.replace(/_/g, ' ') }}
  </Badge>
</template>
