import type {
  Cliente,
  PaginatedClienteList,
  PatchedClienteWritable,
  V1ClientesListData,
} from '@/generated/api'
import { apiRequest } from '@/shared/api'

type ClienteListQuery = NonNullable<V1ClientesListData['query']>

function queryString(query: ClienteListQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const clientesService = {
  list: (query: ClienteListQuery = {}) =>
    apiRequest<PaginatedClienteList>(`/api/v1/clientes/${queryString(query)}`),
  get: (id: number) => apiRequest<Cliente>(`/api/v1/clientes/${id}/`),
  update: (id: number, body: PatchedClienteWritable) =>
    apiRequest<Cliente>(`/api/v1/clientes/${id}/`, { method: 'PATCH', body }),
}

export function nombreCliente(cliente: Cliente) {
  return (
    cliente.empresa?.trim() ||
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ').trim() ||
    `Cliente #${cliente.id}`
  )
}
