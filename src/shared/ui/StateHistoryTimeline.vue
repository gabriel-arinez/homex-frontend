<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  FileEdit,
  Hammer,
  PackageCheck,
  RotateCcw,
  Send,
  UserCheck,
  XCircle,
} from '@lucide/vue'
import Badge from './Badge.vue'
import StatusBadge from './StatusBadge.vue'
import { formatearFechaHora } from '@/shared/date/presentacionFecha'

export interface StateHistoryEntry {
  id: number
  estado_anterior_info?: { codigo: string; nombre: string } | null
  estado_nuevo_info: { codigo: string; nombre: string }
  cambiado_por_resumen?: { display_name?: string | null } | null
  es_automatico?: boolean
  origen?: string
  fecha: string
  observaciones?: string | null
}

const props = withDefaults(
  defineProps<{
    entries: StateHistoryEntry[]
    currentStatusCode?: string | null
    incomplete?: boolean
    title?: string
    testId?: string
  }>(),
  {
    currentStatusCode: null,
    incomplete: false,
    title: 'Historial de estados',
    testId: 'state-timeline',
  },
)

const sortedEntries = computed(() =>
  [...(props.entries ?? [])].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id - a.id,
  ),
)

type Tone = 'info' | 'warning' | 'success' | 'danger'

function statusTone(code: string): Tone {
  const upper = code.toUpperCase()
  if (['APROBADA', 'CONFIRMADO', 'TERMINADA', 'ENTREGADO', 'LISTO_ENTREGA'].includes(upper)) {
    return 'success'
  }
  if (['EN_REVISION', 'EN_PROCESO', 'EN_PRODUCCION', 'ENVIADA'].includes(upper)) {
    return 'warning'
  }
  if (['ANULADA', 'CANCELADA', 'CANCELADO', 'VENCIDA', 'NO_CONCRETADA'].includes(upper)) {
    return 'danger'
  }
  return 'info'
}

function statusIcon(code: string) {
  const upper = code.toUpperCase()
  if (upper === 'BORRADOR') return FileEdit
  if (upper === 'EN_REVISION' || upper === 'ENVIADA') return Send
  if (upper === 'APROBADA' || upper === 'CONFIRMADO' || upper === 'TERMINADA') return CheckCircle2
  if (upper === 'EN_PROCESO' || upper === 'EN_PRODUCCION') return Hammer
  if (upper === 'LISTO_ENTREGA' || upper === 'ENTREGADO') return PackageCheck
  if (upper === 'VENCIDA') return AlertTriangle
  if (upper === 'NO_CONCRETADA') return RotateCcw
  if (['ANULADA', 'CANCELADA', 'CANCELADO'].includes(upper)) return XCircle
  return Clock3
}

function automaticLabel(entry: StateHistoryEntry): string {
  if (entry.origen === 'CELERY') return 'Sistema automático (vigencia)'
  if (entry.origen === 'IMPORTACION') return 'Importación'
  return 'Sistema automático'
}
</script>

<template>
  <section class="state-timeline" :aria-label="title" :data-testid="testId">
    <div class="state-timeline__header">
      <div class="state-timeline__title-row">
        <Clock3 :size="16" aria-hidden="true" />
        <h3>{{ title }}</h3>
      </div>
      <Badge v-if="incomplete" tone="warning" :dot="false">Historial incompleto</Badge>
    </div>
    <p v-if="incomplete" class="state-timeline__notice" role="status">
      Historial previo incompleto: se muestran únicamente los acontecimientos verificables.
    </p>
    <p v-if="!sortedEntries.length" class="state-timeline__empty">
      Sin acontecimientos registrados.
    </p>
    <ol v-else class="state-timeline__list">
      <li
        v-for="(entry, index) in sortedEntries"
        :key="entry.id"
        class="state-timeline__item"
        :class="{
          'state-timeline__item--current':
            index === 0 &&
            currentStatusCode &&
            entry.estado_nuevo_info.codigo === currentStatusCode,
        }"
      >
        <span
          class="state-timeline__marker"
          :class="`state-timeline__marker--${statusTone(entry.estado_nuevo_info.codigo)}`"
          aria-hidden="true"
        >
          <component
            :is="statusIcon(entry.estado_nuevo_info.codigo)"
            :size="14"
            aria-hidden="true"
          />
        </span>
        <div class="state-timeline__content">
          <div class="state-timeline__title">
            <StatusBadge
              :status="entry.estado_nuevo_info.codigo"
              :label="entry.estado_nuevo_info.nombre"
            />
            <Badge
              v-if="
                index === 0 &&
                currentStatusCode &&
                entry.estado_nuevo_info.codigo === currentStatusCode
              "
              :tone="statusTone(entry.estado_nuevo_info.codigo)"
              :dot="false"
            >
              Estado actual
            </Badge>
            <span v-if="entry.estado_anterior_info" class="state-timeline__prev">
              desde {{ entry.estado_anterior_info.nombre }}
            </span>
          </div>
          <div class="state-timeline__meta">
            <span>{{ formatearFechaHora(entry.fecha) }}</span>
            <span v-if="entry.cambiado_por_resumen?.display_name" class="state-timeline__actor">
              · <UserCheck :size="13" aria-hidden="true" />
              {{ entry.cambiado_por_resumen.display_name }}
            </span>
            <span v-else-if="entry.es_automatico" class="state-timeline__actor">
              · <Bot :size="13" aria-hidden="true" />
              {{ automaticLabel(entry) }}
            </span>
          </div>
          <p v-if="entry.observaciones" class="state-timeline__obs">
            {{ entry.observaciones }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.state-timeline {
  background: var(--color-surface, var(--surface));
  border: 1px solid var(--color-border, var(--border));
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-4, 1rem);
  margin-bottom: var(--space-4, 1rem);
}
.state-timeline__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2, 0.5rem);
  margin-bottom: var(--space-3, 0.75rem);
  color: var(--color-text, var(--ink));
}
.state-timeline__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}
.state-timeline__header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}
.state-timeline__notice,
.state-timeline__empty {
  margin: 0 0 var(--space-3, 0.75rem);
  font-size: 0.82rem;
  color: var(--color-text-secondary, var(--ink-muted));
}
.state-timeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}
.state-timeline__item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 0.75rem);
  padding-bottom: var(--space-4, 1rem);
}
.state-timeline__item:last-child {
  padding-bottom: 0;
}
.state-timeline__item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 0.9rem;
  top: 2rem;
  bottom: 0.25rem;
  width: 2px;
  background: var(--color-border, var(--border));
}
.state-timeline__marker {
  position: relative;
  z-index: 1;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid var(--color-border, var(--border));
  background: var(--color-surface, var(--surface));
  color: var(--color-text-secondary, var(--ink-muted));
}
.state-timeline__marker--info {
  background: var(--color-info-soft);
  color: var(--badge-info-text);
  border-color: color-mix(in srgb, var(--color-info) 35%, transparent);
}
.state-timeline__marker--warning {
  background: var(--color-warning-soft);
  color: var(--badge-warning-text);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
}
.state-timeline__marker--success {
  background: var(--color-success-soft);
  color: var(--badge-success-text);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}
.state-timeline__marker--danger {
  background: var(--color-danger-soft);
  color: var(--badge-danger-text);
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
}
.state-timeline__content {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  padding-top: 0.1rem;
}
.state-timeline__title {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  flex-wrap: wrap;
}
.state-timeline__prev,
.state-timeline__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  color: var(--color-text-secondary, var(--ink-muted));
  font-size: 0.82rem;
}
.state-timeline__actor {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.state-timeline__obs {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text, var(--ink));
  line-height: 1.45;
  overflow-wrap: anywhere;
}
</style>
