import type { IdentidadActual, TokenObtainPair, TokenRefresh } from '@/generated/api'
import { apiRequest } from '@/shared/api'

export type LoginInput = Pick<TokenObtainPair, 'username' | 'password'>
export type RefreshInput = Pick<TokenRefresh, 'refresh'>

export const authService = {
  login: (body: LoginInput) =>
    apiRequest<TokenObtainPair>('/api/v1/auth/token/', {
      method: 'POST',
      body,
      authenticated: false,
    }),
  refresh: (body: RefreshInput) =>
    apiRequest<TokenRefresh>('/api/v1/auth/token/refresh/', {
      method: 'POST',
      body,
      authenticated: false,
      retryAfterRefresh: false,
    }),
  me: () => apiRequest<IdentidadActual>('/api/v1/auth/me/'),
}
