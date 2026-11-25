import type {
  DashboardAdminComercial,
  DashboardAdminResumen,
  FinanzasAdmin,
  InventarioAdmin,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'

export interface AdminDashboardQuery {
  fecha_desde?: string | null
  fecha_hasta?: string | null
  granularidad?: 'diaria' | 'semanal' | 'mensual'
  vendedor?: number | null
  moneda?: string | null
  categoria?: string | null
  estado_comercial?: string | null
  estado_fabricacion?: string | null
  page?: number
  page_size?: number
}

function buildQuery(params: AdminDashboardQuery): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value))
    }
  }
  const encoded = qs.toString()
  return encoded ? `?${encoded}` : ''
}

export const adminDashboardService = {
  getResumen(query: AdminDashboardQuery, signal?: AbortSignal) {
    return apiRequest<DashboardAdminResumen>(
      `/api/v1/dashboard/administrador/${buildQuery(query)}`,
      { signal },
    )
  },
  getComercial(query: AdminDashboardQuery, signal?: AbortSignal) {
    return apiRequest<DashboardAdminComercial>(
      `/api/v1/dashboard/administrador/comercial/${buildQuery(query)}`,
      { signal },
    )
  },
  getFinanzas(query: AdminDashboardQuery, signal?: AbortSignal) {
    return apiRequest<FinanzasAdmin>(
      `/api/v1/dashboard/administrador/finanzas/${buildQuery(query)}`,
      { signal },
    )
  },
  getInventario(query: AdminDashboardQuery, signal?: AbortSignal) {
    return apiRequest<InventarioAdmin>(
      `/api/v1/dashboard/administrador/inventario/${buildQuery(query)}`,
      { signal },
    )
  },
}
