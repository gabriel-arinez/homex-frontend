import { getApiBaseUrl } from '@/app/config/env'
import { ApiError, normalizeApiError } from './errors'
type AuthHooks = {
  accessToken: () => string | null
  refresh: () => Promise<string | null>
  unauthorized: () => void
}
let authHooks: AuthHooks | null = null
export function configureApiAuth(hooks: AuthHooks) {
  authHooks = hooks
}
export type ApiRequest = Omit<RequestInit, 'body'> & {
  body?: unknown
  authenticated?: boolean
  retryAfterRefresh?: boolean
  timeoutMs?: number
}
export async function apiRequest<T>(path: string, options: ApiRequest = {}): Promise<T> {
  const {
    body,
    authenticated = true,
    retryAfterRefresh = true,
    timeoutMs = 15_000,
    ...init
  } = options
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const token = authenticated ? authHooks?.accessToken() : null
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new ApiError('El servidor tardó demasiado en responder.', null, 'timeout')
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('No se pudo conectar con el servidor.', null, 'network')
  }
  if (response.status === 401 && authenticated && retryAfterRefresh && authHooks) {
    const refreshed = await authHooks.refresh()
    if (refreshed) return apiRequest<T>(path, { ...options, retryAfterRefresh: false })
    authHooks.unauthorized()
  }
  if (!response.ok)
    throw normalizeApiError(response.status, await response.json().catch(() => null))
  if (response.status === 204) return undefined as T
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(
      'El servidor devolvió una respuesta inválida.',
      response.status,
      'invalid_response',
    )
  }
}
