<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EChartBox from './EChartBox.vue'
import type { ChartThemeTokens, HomexChartOption } from './themeTokens'

export interface BarSeriesInput {
  name: string
  data: number[]
  colorKey?: 'primary' | 'info' | 'success' | 'warning' | 'neutral'
}

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    labels: string[]
    series: BarSeriesInput[]
    horizontal?: boolean
    height?: number
    loading?: boolean
    error?: string
    valueFormatter?: (value: number) => string
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    description: '',
    horizontal: false,
    height: 280,
    loading: false,
    error: '',
    valueFormatter: (v: number) => String(v),
    emptyTitle: 'Sin datos para graficar',
    emptyDescription: 'No hay registros en el período o filtros seleccionados.',
  },
)

const emit = defineEmits<{ retry: [] }>()

const optionBuilder = computed(() => {
  const { labels, series, horizontal, valueFormatter } = props
  return (tokens: ChartThemeTokens): HomexChartOption | null => {
    if (!labels.length || !series.length || series.every((s) => s.data.length === 0)) {
      return null
    }
    const palette: Record<string, string> = {
      primary: tokens.primary,
      info: tokens.info,
      success: tokens.success,
      warning: tokens.warning,
      neutral: tokens.neutral,
    }
    const categoryAxis = {
      type: 'category' as const,
      data: labels,
      axisLine: { lineStyle: { color: tokens.border } },
      axisLabel: { color: tokens.textSecondary, fontSize: 11 },
    }
    const valueAxis = {
      type: 'value' as const,
      splitLine: { lineStyle: { color: tokens.border, type: 'dashed' as const } },
      axisLabel: {
        color: tokens.textSecondary,
        fontSize: 11,
        formatter: (val: number) => valueFormatter(val),
      },
    }
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tokens.surface,
        borderColor: tokens.border,
        textStyle: { color: tokens.text },
      },
      legend:
        series.length > 1
          ? { top: 0, textStyle: { color: tokens.textSecondary, fontSize: 12 } }
          : undefined,
      grid: {
        left: horizontal ? 12 : 12,
        right: 16,
        top: series.length > 1 ? 34 : 16,
        bottom: 12,
        containLabel: true,
      },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: series.map((s) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        barMaxWidth: 28,
        itemStyle: {
          color: palette[s.colorKey ?? 'primary'] ?? tokens.primary,
          borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
      })),
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
              <th scope="col">Categoría</th>
              <th v-for="s in series" :key="s.name" scope="col">{{ s.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(label, idx) in labels" :key="label">
              <td>{{ label }}</td>
              <td v-for="s in series" :key="s.name">{{ valueFormatter(s.data[idx] ?? 0) }}</td>
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
