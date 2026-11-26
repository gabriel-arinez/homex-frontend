import type { DashboardTallerPlanificacion, DashboardTallerResumen } from '@/generated/api'
import { apiRequest } from '@/shared/api'

export interface TallerDashboardQuery {
  fecha_desde?: string | null
  fecha_hasta?: string | null
  granularidad?: 'diaria' | 'semanal' | 'mensual'
  estado_fabricacion?: string | null
  tipo_mueble?: string | null
  entrega_desde?: string | null
  entrega_hasta?: string | null
  page?: number
  page_size?: number
}

function buildQuery(params: TallerDashboardQuery): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value))
    }
  }
  const encoded = qs.toString()
  return encoded ? `?${encoded}` : ''
}

export const tallerDashboardService = {
  getResumen(query: TallerDashboardQuery, signal?: AbortSignal) {
    return apiRequest<DashboardTallerResumen>(`/api/v1/dashboard/taller/${buildQuery(query)}`, {
      signal,
    })
  },
  getPlanificacion(query: TallerDashboardQuery, signal?: AbortSignal) {
    return apiRequest<DashboardTallerPlanificacion>(
      `/api/v1/dashboard/taller/planificacion/${buildQuery(query)}`,
      { signal },
    )
  },
}
