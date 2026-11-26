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
  PENDIENTE: 'info',
  EN_PROCESO: 'warning',
  TERMINADA: 'success',
  NO_CONCRETADA: 'danger',
  CANCELADA: 'danger',
  CANCELADO: 'danger',
  ANULADA: 'danger',
  VENCIDA: 'danger',
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
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  TERMINADA: 'Terminada',
  NO_CONCRETADA: 'No concretada',
  CANCELADA: 'Cancelada',
  CANCELADO: 'Cancelado',
  ANULADA: 'Anulada',
  VENCIDA: 'Vencida',
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
