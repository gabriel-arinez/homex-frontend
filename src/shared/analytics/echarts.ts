import type { ComposeOption } from 'echarts/core'
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts'
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'

export type HomexChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>

let echartsPromise: Promise<typeof import('echarts/core')> | null = null

export async function loadECharts() {
  if (!echartsPromise) {
    echartsPromise = (async () => {
      const [
        echarts,
        { BarChart, LineChart, PieChart },
        { GridComponent, LegendComponent, TooltipComponent },
        { CanvasRenderer },
      ] = await Promise.all([
        import('echarts/core'),
        import('echarts/charts'),
        import('echarts/components'),
        import('echarts/renderers'),
      ])
      echarts.use([
        BarChart,
        LineChart,
        PieChart,
        GridComponent,
        LegendComponent,
        TooltipComponent,
        CanvasRenderer,
      ])
      return echarts
    })()
  }
  return echartsPromise
}

export interface ChartThemeTokens {
  text: string
  textSecondary: string
  border: string
  surface: string
  primary: string
  info: string
  success: string
  warning: string
  danger: string
  neutral: string
}

export function readChartThemeTokens(): ChartThemeTokens {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      text: '#282522',
      textSecondary: '#625e59',
      border: '#dedad5',
      surface: '#ffffff',
      primary: '#b20a0a',
      info: '#175cd3',
      success: '#18794e',
      warning: '#d97706',
      danger: '#b42318',
      neutral: '#85807a',
    }
  }
  const cs = getComputedStyle(document.documentElement)
  const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    text: pick('--color-text', '#282522'),
    textSecondary: pick('--color-text-secondary', '#625e59'),
    border: pick('--color-border', '#dedad5'),
    surface: pick('--color-surface', '#ffffff'),
    primary: pick('--color-primary-accent', '#b20a0a'),
    info: pick('--color-info', '#175cd3'),
    success: pick('--color-success', '#18794e'),
    warning: pick('--badge-warning-dot', '#d97706'),
    danger: pick('--color-danger', '#b42318'),
    neutral: pick('--color-text-muted', '#85807a'),
  }
}
