<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EChartBox from './EChartBox.vue'
import type { ChartThemeTokens, HomexChartOption } from './themeTokens'

export interface DonutSlice {
  name: string
  value: number
  colorKey?: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'
}

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    slices: DonutSlice[]
    height?: number
    loading?: boolean
    error?: string
    valueFormatter?: (value: number) => string
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    description: '',
    height: 260,
    loading: false,
    error: '',
    valueFormatter: (v: number) => String(v),
    emptyTitle: 'Sin composición disponible',
    emptyDescription: 'No hay importes registrados para el filtro seleccionado.',
  },
)

const emit = defineEmits<{ retry: [] }>()

const optionBuilder = computed(() => {
  const { slices, valueFormatter } = props
  return (tokens: ChartThemeTokens): HomexChartOption | null => {
    const total = slices.reduce((sum, s) => sum + s.value, 0)
    if (!slices.length || total <= 0) return null
    const palette: Record<string, string> = {
      primary: tokens.primary,
      info: tokens.info,
      success: tokens.success,
      warning: tokens.warning,
      danger: tokens.danger,
      neutral: tokens.neutral,
    }
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: tokens.surface,
        borderColor: tokens.border,
        textStyle: { color: tokens.text },
        formatter: (params: unknown) => {
          const item = params as { name: string; value: number; percent: number }
          return `${item.name}: <strong>${valueFormatter(item.value)}</strong> (${item.percent}%)`
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: tokens.textSecondary, fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '74%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderColor: tokens.surface, borderWidth: 2 },
          data: slices.map((s) => ({
            name: s.name,
            value: s.value,
            itemStyle: { color: palette[s.colorKey ?? 'info'] ?? tokens.info },
          })),
        },
      ],
    }
  }
})
</script>

<template>
  <Card>
    <div class="chart-card__head">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description" class="chart-card__desc">{{ description }}</p>
      </div>
      <slot name="controls" />
    </div>

    <ErrorState v-if="error" :description="error">
      <button type="button" @click="emit('retry')">Reintentar</button>
    </ErrorState>

    <EChartBox
      v-else
      :chart-label="title"
      :option-builder="optionBuilder"
      :height="height"
      :loading="loading"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
    >
      <template #accessible>
        <table class="chart-a11y-table">
          <caption>
            {{
              title
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in slices" :key="s.name">
              <td>{{ s.name }}</td>
              <td>{{ valueFormatter(s.value) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </EChartBox>
  </Card>
</template>

<style scoped>
.chart-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.chart-card__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.chart-card__desc {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.chart-a11y-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.chart-a11y-table th,
.chart-a11y-table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
</style>
