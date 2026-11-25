<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { EChartsType } from 'echarts/core'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import {
  loadECharts,
  readChartThemeTokens,
  type ChartThemeTokens,
  type HomexChartOption,
} from './echarts'

const props = withDefaults(
  defineProps<{
    chartLabel: string
    optionBuilder: (tokens: ChartThemeTokens) => HomexChartOption | null
    height?: number
    loading?: boolean
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    height: 280,
    loading: false,
    emptyTitle: 'Sin datos para graficar',
    emptyDescription: 'Ajusta el período o los filtros activos para consultar registros.',
  },
)

const containerRef = ref<HTMLElement | null>(null)
const showTable = ref(false)
const chartReady = ref(false)
let chartInstance: EChartsType | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let destroyed = false

const isEmpty = computed(() => props.optionBuilder(readChartThemeTokens()) === null)

async function renderChart() {
  if (destroyed || props.loading || !containerRef.value) return
  const tokens = readChartThemeTokens()
  const option = props.optionBuilder(tokens)
  if (!option) {
    chartInstance?.clear()
    return
  }
  const probe = document.createElement('canvas')
  if (typeof probe.getContext !== 'function' || !probe.getContext('2d')) {
    return
  }
  const echarts = await loadECharts()
  if (destroyed || !containerRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(containerRef.value, undefined, { renderer: 'canvas' })
    chartReady.value = true
  }
  chartInstance.setOption(option, { notMerge: true })
}

onMounted(() => {
  void renderChart()
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize()
    })
    resizeObserver.observe(containerRef.value)
  }
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      void renderChart()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  }
})

watch(
  () => [props.loading, props.optionBuilder],
  () => {
    void renderChart()
  },
)

onBeforeUnmount(() => {
  destroyed = true
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div class="echart-box">
    <div v-if="$slots.accessible && !loading && !isEmpty" class="echart-box__toolbar">
      <button
        type="button"
        class="echart-box__toggle"
        :aria-expanded="showTable"
        @click="showTable = !showTable"
      >
        {{ showTable ? 'Ocultar tabla de datos' : 'Ver tabla de datos' }}
      </button>
    </div>

    <LoadingSkeleton v-if="loading" :lines="5" />
    <EmptyState v-else-if="isEmpty" :title="emptyTitle" :description="emptyDescription" />
    <template v-else>
      <div
        ref="containerRef"
        class="echart-box__canvas"
        :style="{ height: `${height}px` }"
        role="img"
        :aria-label="chartLabel"
      />
      <div v-if="$slots.accessible" :class="showTable ? 'echart-box__table' : 'sr-only'">
        <slot name="accessible" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.echart-box {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.echart-box__toolbar {
  display: flex;
  justify-content: flex-end;
}

.echart-box__toggle {
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  border-radius: var(--radius-control);
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
}

.echart-box__toggle:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.echart-box__canvas {
  width: 100%;
  min-width: 0;
}

.echart-box__table {
  overflow-x: auto;
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
