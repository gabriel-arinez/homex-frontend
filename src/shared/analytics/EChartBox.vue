<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { EChartsType } from 'echarts/core'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import { readChartThemeTokens, type ChartThemeTokens, type HomexChartOption } from './themeTokens'

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
const chartFinished = ref(false)
const seriesCount = ref(0)
const renderError = ref('')

let chartInstance: EChartsType | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
let destroyed = false
let renderSeq = 0

const isEmpty = computed(() => props.optionBuilder(readChartThemeTokens()) === null)

function cleanupChart() {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  chartReady.value = false
  chartFinished.value = false
  seriesCount.value = 0
}

function attachResizeObserver(el: HTMLElement) {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect && rect.width > 0 && rect.height > 0) {
      if (!chartInstance) {
        void renderChart()
      } else {
        chartInstance.resize()
      }
    }
  })
  resizeObserver.observe(el)
}

async function renderChart() {
  const seq = ++renderSeq
  if (destroyed || props.loading || !containerRef.value) return
  renderError.value = ''

  let option: HomexChartOption | null = null
  try {
    const tokens = readChartThemeTokens()
    option = props.optionBuilder(tokens)
  } catch (err) {
    renderError.value = err instanceof Error ? err.message : 'No se pudo construir el gráfico.'
    cleanupChart()
    return
  }

  if (!option) {
    cleanupChart()
    return
  }

  const probe = document.createElement('canvas')
  if (typeof probe.getContext !== 'function' || !probe.getContext('2d')) {
    return
  }

  try {
    const { getECharts } = await import('./echarts')
    const echarts = getECharts()
    if (destroyed || seq !== renderSeq || props.loading || !containerRef.value) return

    if (chartInstance && chartInstance.getDom() !== containerRef.value) {
      chartInstance.dispose()
      chartInstance = null
    }
    if (!chartInstance) {
      chartInstance = echarts.init(containerRef.value, undefined, { renderer: 'canvas' })
      chartInstance.on('finished', () => {
        if (!destroyed) chartFinished.value = true
      })
    }

    chartFinished.value = false
    const rawSeries = Array.isArray(option.series)
      ? option.series
      : option.series
        ? [option.series]
        : []
    seriesCount.value = rawSeries.length
    chartInstance.setOption(
      {
        animationDuration: 240,
        ...option,
      },
      { notMerge: true },
    )
    chartInstance.resize()
    chartReady.value = true
  } catch (err) {
    if (seq === renderSeq && !destroyed) {
      renderError.value = err instanceof Error ? err.message : 'No se pudo renderizar el gráfico.'
      cleanupChart()
    }
  }
}

watch(
  containerRef,
  (el) => {
    if (!el) {
      cleanupChart()
      return
    }
    attachResizeObserver(el)
    void renderChart()
  },
  { flush: 'post' },
)

watch(
  () => [props.loading, props.optionBuilder],
  () => {
    if (props.loading) {
      cleanupChart()
      return
    }
    void renderChart()
  },
  { flush: 'post' },
)

onMounted(() => {
  if (containerRef.value) {
    attachResizeObserver(containerRef.value)
    void renderChart()
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

onBeforeUnmount(() => {
  destroyed = true
  themeObserver?.disconnect()
  themeObserver = null
  cleanupChart()
})
</script>

<template>
  <div class="echart-box">
    <div
      v-if="$slots.accessible && !loading && !isEmpty && !renderError"
      class="echart-box__toolbar"
    >
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
    <ErrorState v-else-if="renderError" :description="renderError">
      <button type="button" @click="renderChart()">Reintentar</button>
    </ErrorState>
    <EmptyState v-else-if="isEmpty" :title="emptyTitle" :description="emptyDescription" />
    <template v-else>
      <div
        ref="containerRef"
        class="echart-box__canvas"
        :style="{ height: `${height}px` }"
        role="img"
        :aria-label="chartLabel"
        :data-rendered="chartReady ? 'true' : 'false'"
        :data-finished="chartFinished ? 'true' : 'false'"
        :data-series-count="seriesCount"
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
