import type { DashboardTiendaResumen, DashboardTiendaSeguimiento } from '@/generated/api'
import { apiRequest } from '@/shared/api'

export interface TiendaDashboardQuery {
  fecha_desde?: string | null
  fecha_hasta?: string | null
  granularidad?: 'diaria' | 'semanal' | 'mensual'
  moneda?: string | null
  categoria?: string | null
  estado_comercial?: string | null
}

export type AgendaCategoriaCodigo =
  | 'PROFORMA_PROXIMA_VENCER'
  | 'PROFORMA_PENDIENTE_REVISION'
  | 'PROFORMA_ENVIADA'
  | 'PEDIDO_LISTO_ENTREGA'
  | 'PEDIDO_SALDO_PENDIENTE'
  | 'ENTREGA_PROXIMA'
  | 'ENTREGA_RETRASADA'

export interface TiendaSeguimientoQuery {
  moneda?: string | null
  categoria?: string | null
  categoria_agenda?: AgendaCategoriaCodigo | null
  page?: number
  page_size?: number
}

function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value))
    }
  }
  const encoded = qs.toString()
  return encoded ? `?${encoded}` : ''
}

export const tiendaDashboardService = {
  getResumen(query: TiendaDashboardQuery, signal?: AbortSignal) {
    return apiRequest<DashboardTiendaResumen>(
      `/api/v1/dashboard/tienda/${buildQuery({ ...query })}`,
      { signal },
    )
  },
  getSeguimiento(query: TiendaSeguimientoQuery, signal?: AbortSignal) {
    return apiRequest<DashboardTiendaSeguimiento>(
      `/api/v1/dashboard/tienda/seguimiento/${buildQuery({ ...query })}`,
      { signal },
    )
  },
}
