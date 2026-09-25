import { http, HttpResponse } from 'msw'

function jwt(userId = 7) {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ user_id: userId })}.signature`
}

export const tokens = { access: jwt(), refresh: 'refresh-token' }
export const vendedor = {
  id: 7,
  username: 'vendedor',
  display_name: 'María Vendedora',
  capabilities: ['comercial.operar'],
}

export const handlers = [
  http.post('http://localhost:8000/api/v1/auth/token/', async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string }
    return body.username === 'vendedor' && body.password === 'correcta'
      ? HttpResponse.json(tokens)
      : HttpResponse.json(
          { detail: 'No active account found with the given credentials' },
          { status: 401 },
        )
  }),
  http.post('http://localhost:8000/api/v1/auth/token/refresh/', () => HttpResponse.json(tokens)),
  http.get('http://localhost:8000/api/v1/auth/me/', () => HttpResponse.json(vendedor)),
]
