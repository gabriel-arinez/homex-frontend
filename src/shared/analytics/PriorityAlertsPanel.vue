<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { AlertTriangle, ArrowRight } from '@lucide/vue'
import Badge from '@/shared/ui/Badge.vue'
import Card from '@/shared/ui/Card.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import type { AlertRowItem } from './AlertListCard.vue'
import { formatInteger } from './formatters'

export interface PriorityAlertCategory {
  key: string
  label: string
  totalCount: number
  items: AlertRowItem[]
  viewAllTo: RouteLocationRaw
  viewAllLabel: string
  emptyTitle?: string
  emptyDescription?: string
  error?: string
  loading?: boolean
}

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    countLabel?: string
    headingLevel?: 'h2' | 'h3'
    categories: PriorityAlertCategory[]
    loading?: boolean
    error?: string
  }>(),
  {
    title: 'Alertas prioritarias',
    description: 'Registros concretos que requieren atención operativa y seguimiento directo.',
    countLabel: 'incidencias',
    headingLevel: 'h3',
    loading: false,
    error: '',
  },
)

const emit = defineEmits<{ retry: []; 'category-change': [key: string] }>()

const selectedKey = ref<string>('')

function selectCategory(key: string) {
  selectedKey.value = key
  emit('category-change', key)
}

const activeCategory = computed<PriorityAlertCategory | null>(() => {
  if (!props.categories.length) return null
  const found = props.categories.find((c) => c.key === selectedKey.value)
  if (found) return found
  return props.categories.find((c) => c.totalCount > 0) ?? props.categories[0] ?? null
})

const totalAlerts = computed(() => props.categories.reduce((sum, cat) => sum + cat.totalCount, 0))

const visibleItems = computed(() => activeCategory.value?.items.slice(0, 5) ?? [])
</script>

<template>
  <Card>
    <div class="priority-alerts__head">
      <div class="priority-alerts__title">
        <AlertTriangle :size="17" class="priority-alerts__icon" aria-hidden="true" />
        <div>
          <component :is="headingLevel" class="priority-alerts__heading">{{ title }}</component>
          <p>{{ description }}</p>
        </div>
      </div>
      <Badge v-if="!loading && !error" :tone="totalAlerts > 0 ? 'warning' : 'neutral'">
        {{ formatInteger(totalAlerts) }} {{ countLabel }}
      </Badge>
      <Badge v-else-if="error" tone="danger">No disponible</Badge>
    </div>

    <LoadingSkeleton v-if="loading && !categories.length" :lines="4" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="emit('retry')">Reintentar</button>
    </ErrorState>

    <template v-else-if="activeCategory">
      <div class="priority-alerts__pills" role="tablist" aria-label="Categorías de alertas">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          role="tab"
          :aria-selected="activeCategory.key === cat.key"
          class="priority-alerts__pill"
          :class="{ 'is-active': activeCategory.key === cat.key }"
          @click="selectCategory(cat.key)"
        >
          <span>{{ cat.label }}</span>
          <Badge :tone="cat.totalCount > 0 ? 'warning' : 'neutral'">
            {{ formatInteger(cat.totalCount) }}
          </Badge>
        </button>
      </div>

      <div class="priority-alerts__body" role="tabpanel">
        <div class="priority-alerts__subhead">
          <span>
            <template v-if="activeCategory.totalCount > visibleItems.length">
              Mostrando {{ formatInteger(visibleItems.length) }} de
              {{ formatInteger(activeCategory.totalCount) }} registros
            </template>
            <template v-else>
              {{ formatInteger(activeCategory.totalCount) }} registros en esta categoría
            </template>
          </span>
          <RouterLink :to="activeCategory.viewAllTo" class="priority-alerts__more">
            {{ activeCategory.viewAllLabel }}
            <ArrowRight :size="14" aria-hidden="true" />
          </RouterLink>
        </div>

        <LoadingSkeleton v-if="activeCategory.loading" :lines="3" />
        <ErrorState v-else-if="activeCategory.error" :description="activeCategory.error">
          <button type="button" @click="emit('retry')">Reintentar</button>
        </ErrorState>
        <EmptyState
          v-else-if="!visibleItems.length"
          :title="activeCategory.emptyTitle ?? 'Sin alertas activas'"
          :description="
            activeCategory.emptyDescription ?? 'No hay registros pendientes en esta categoría.'
          "
        />

        <ul v-else class="priority-alerts__list">
          <li v-for="item in visibleItems" :key="item.id" class="priority-alerts__item">
            <component
              :is="item.to ? RouterLink : 'div'"
              :to="item.to"
              class="priority-alerts__link"
              :class="{ 'priority-alerts__link--interactive': Boolean(item.to) }"
            >
              <div class="priority-alerts__text">
                <strong>{{ item.title }}</strong>
                <small>{{ item.subtitle }}</small>
              </div>
              <Badge :tone="item.tone">{{ item.badge }}</Badge>
            </component>
          </li>
        </ul>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.priority-alerts__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.priority-alerts__title {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.priority-alerts__icon {
  margin-top: 0.15rem;
  color: var(--color-warning);
  flex: none;
}

.priority-alerts__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.priority-alerts__title p {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.priority-alerts__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: var(--space-3);
}

.priority-alerts__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.priority-alerts__pill:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.priority-alerts__pill.is-active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 55%, var(--color-surface));
  color: var(--color-text);
}

.priority-alerts__body {
  display: grid;
  gap: var(--space-2);
}

.priority-alerts__subhead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.priority-alerts__more {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary-accent);
  text-decoration: none;
}

.priority-alerts__more:hover {
  text-decoration: underline;
}

.priority-alerts__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.priority-alerts__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-control);
  border: 1px solid var(--color-border);
  color: inherit;
  text-decoration: none;
  background: var(--color-surface-soft);
}

.priority-alerts__link--interactive:hover {
  border-color: var(--color-primary-accent);
  background: var(--color-surface-hover);
}

.priority-alerts__text {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.priority-alerts__text strong {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.priority-alerts__text small {
  font-size: 0.76rem;
  color: var(--color-text-secondary);
}
</style>
