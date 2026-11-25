<script setup lang="ts">
import Card from '@/shared/ui/Card.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    loading?: boolean
    error?: string
    isEmpty?: boolean
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    description: '',
    loading: false,
    error: '',
    isEmpty: false,
    emptyTitle: 'Sin registros',
    emptyDescription: 'No hay elementos para los filtros aplicados.',
  },
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <Card>
    <div class="analytics-table-card__head">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description" class="analytics-table-card__desc">{{ description }}</p>
      </div>
      <slot name="actions" />
    </div>

    <LoadingSkeleton v-if="loading" :lines="5" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="emit('retry')">Reintentar</button>
    </ErrorState>
    <EmptyState v-else-if="isEmpty" :title="emptyTitle" :description="emptyDescription" />
    <div v-else class="analytics-table-card__wrap" tabindex="0" role="region" :aria-label="title">
      <slot />
    </div>
  </Card>
</template>

<style scoped>
.analytics-table-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.analytics-table-card__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.analytics-table-card__desc {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.analytics-table-card__wrap {
  overflow-x: auto;
}
</style>
