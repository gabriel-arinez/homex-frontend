import type {
  AprobarProformaRespuesta,
  ArchivoAdjunto,
  CrearProformaWritable,
  DetalleProforma,
  DetalleProformaWritable,
  EspecificacionMueble,
  EspecificacionMuebleWritable,
  PaginatedProformaListadoList,
  PatchedDetalleProformaWritable,
  PatchedProformaWritable,
  Proforma,
  V1CatalogoOpcionesListData,
  V1ProformasListData,
  ValorCatalogoPublico,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'
type Query = NonNullable<V1ProformasListData['query']>
type Concepto = V1CatalogoOpcionesListData['query']['concepto']
const qs = (q: Record<string, unknown>) => {
  const p = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)))
  return p.size ? `?${p}` : ''
}
export const proformasService = {
  list: (q: Query = {}) => apiRequest<PaginatedProformaListadoList>(`/api/v1/proformas/${qs(q)}`),
  get: (id: number) => apiRequest<Proforma>(`/api/v1/proformas/${id}/`),
  create: (body: CrearProformaWritable) =>
    apiRequest<Proforma>('/api/v1/proformas/', { method: 'POST', body }),
  update: (id: number, body: PatchedProformaWritable) =>
    apiRequest<Proforma>(`/api/v1/proformas/${id}/`, { method: 'PATCH', body }),
  send: (id: number) => apiRequest<Proforma>(`/api/v1/proformas/${id}/enviar/`, { method: 'POST' }),
  approve: (id: number) =>
    apiRequest<AprobarProformaRespuesta>(`/api/v1/proformas/${id}/aprobar/`, { method: 'POST' }),
  addDetail: (id: number, body: DetalleProformaWritable) =>
    apiRequest<DetalleProforma>(`/api/v1/proformas/${id}/detalles/`, { method: 'POST', body }),
  updateDetail: (id: number, body: PatchedDetalleProformaWritable) =>
    apiRequest<DetalleProforma>(`/api/v1/proformas-detalle/${id}/`, { method: 'PATCH', body }),
  addSpec: (id: number, body: EspecificacionMuebleWritable) =>
    apiRequest<EspecificacionMueble>(`/api/v1/proformas-detalle/${id}/especificacion/`, {
      method: 'POST',
      body,
    }),
  options: (concepto: Concepto) =>
    apiRequest<ValorCatalogoPublico[]>(`/api/v1/catalogo/opciones/${qs({ concepto })}`),
  attachments: (p: number, d: number) =>
    apiRequest<ArchivoAdjunto[]>(`/api/v1/proformas/${p}/detalles/${d}/archivos/`),
  upload: (p: number, d: number, file: File) => {
    const body = new FormData()
    body.append('archivo', file)
    return apiRequest<ArchivoAdjunto>(`/api/v1/proformas/${p}/detalles/${d}/archivos/`, {
      method: 'POST',
      body,
    })
  },
  removeAttachment: (p: number, d: number, a: number) =>
    apiRequest<void>(`/api/v1/proformas/${p}/detalles/${d}/archivos/${a}/`, { method: 'DELETE' }),
  document: (id: number) =>
    apiRequest<Blob>(`/api/v1/proformas/${id}/documento/`, { responseType: 'blob' }),
}
