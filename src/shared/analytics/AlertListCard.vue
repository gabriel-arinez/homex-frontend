<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import Badge from '@/shared/ui/Badge.vue'
import Card from '@/shared/ui/Card.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { formatInteger } from './formatters'

export interface AlertRowItem {
  id: string | number
  title: string
  subtitle: string
  badge: string
  tone: 'danger' | 'warning' | 'info' | 'neutral'
  to?: RouteLocationRaw
}

withDefaults(
  defineProps<{
    title: string
    totalCount: number
    items: AlertRowItem[]
    emptyTitle?: string
    emptyDescription?: string
    viewAllTo?: RouteLocationRaw
    viewAllLabel?: string
  }>(),
  {
    emptyTitle: 'Sin alertas activas',
    emptyDescription: 'No hay registros pendientes en esta categoría.',
    viewAllTo: undefined,
    viewAllLabel: 'Ver módulo',
  },
)
</script>

<template>
  <Card>
    <div class="alert-card__head">
      <div class="alert-card__title">
        <h3>{{ title }}</h3>
        <Badge :tone="totalCount > 0 ? 'warning' : 'neutral'">
          Total: {{ formatInteger(totalCount) }}
        </Badge>
      </div>
      <RouterLink v-if="viewAllTo" :to="viewAllTo" class="alert-card__more">
        {{ viewAllLabel }}
      </RouterLink>
    </div>

    <p v-if="totalCount > items.length" class="alert-card__sample">
      Mostrando {{ formatInteger(items.length) }} de {{ formatInteger(totalCount) }} registros.
    </p>

    <EmptyState v-if="!items.length" :title="emptyTitle" :description="emptyDescription" />
    <ul v-else class="alert-card__list">
      <li v-for="item in items" :key="item.id" class="alert-card__item">
        <component
          :is="item.to ? RouterLink : 'div'"
          :to="item.to"
          class="alert-card__link"
          :class="{ 'alert-card__link--interactive': Boolean(item.to) }"
        >
          <div class="alert-card__text">
            <strong>{{ item.title }}</strong>
            <small>{{ item.subtitle }}</small>
          </div>
          <Badge :tone="item.tone">{{ item.badge }}</Badge>
        </component>
      </li>
    </ul>
  </Card>
</template>

<style scoped>
.alert-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.alert-card__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.alert-card__title h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.alert-card__more {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary-accent);
  text-decoration: none;
}

.alert-card__more:hover {
  text-decoration: underline;
}

.alert-card__sample {
  margin: 0 0 var(--space-2);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.alert-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.alert-card__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: inherit;
  text-decoration: none;
}

.alert-card__link--interactive:hover {
  border-color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}

.alert-card__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.alert-card__text strong {
  font-size: 0.85rem;
  color: var(--color-text);
}

.alert-card__text small {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
