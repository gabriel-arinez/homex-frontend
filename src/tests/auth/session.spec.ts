import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { apiRequest } from '@/shared/api'
import { server } from '@/tests/msw/server'
import { tokens } from '@/tests/msw/handlers'

describe('sesión, identidad y cliente HTTP', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('carga identidad y capacidades desde /auth/me/ después del login', async () => {
    const session = useSessionStore()
    await session.login('vendedor', 'correcta')

    expect(session.isAuthenticated).toBe(true)
    expect(session.identity).toEqual({
      id: 7,
      username: 'vendedor',
      display_name: 'María Vendedora',
    })
    expect(session.capabilities).toEqual(['comercial.operar'])
    expect(session.can('comercial.operar')).toBe(true)
    expect(session.can('comercial.administrar')).toBe(false)
    expect(sessionStorage.getItem('homex.session.v1')).not.toContain('correcta')

    session.logout()
    expect(session.isAuthenticated).toBe(false)
    expect(session.identity).toBeNull()
    expect(session.capabilities).toEqual([])
    expect(sessionStorage.getItem('homex.session.v1')).toBeNull()
  })

  it('restaura tokens y vuelve a consultar la identidad autoritativa', async () => {
    sessionStorage.setItem('homex.session.v1', JSON.stringify(tokens))
    const session = useSessionStore()

    await session.initialize()

    expect(session.isAuthenticated).toBe(true)
    expect(session.identity?.display_name).toBe('María Vendedora')
    expect(session.capabilities).toEqual(['comercial.operar'])
  })

  it('un usuario autenticado sin capacidades no obtiene acceso comercial', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/auth/me/', () =>
        HttpResponse.json({
          id: 9,
          username: 'sin_rol',
          display_name: 'Usuario sin rol',
          capabilities: [],
        }),
      ),
    )
    const session = useSessionStore()

    await session.login('vendedor', 'correcta')

    expect(session.isAuthenticated).toBe(true)
    expect(session.capabilities).toEqual([])
    expect(session.can('comercial.operar')).toBe(false)
    expect(session.can('comercial.administrar')).toBe(false)
  })

  it('acepta administración sólo cuando backend publica esa capacidad', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/auth/me/', () =>
        HttpResponse.json({
          id: 1,
          username: 'admin',
          display_name: 'Administración HOMEX',
          capabilities: ['comercial.operar', 'comercial.administrar'],
        }),
      ),
    )
    const session = useSessionStore()

    await session.login('vendedor', 'correcta')

    expect(session.can('comercial.operar')).toBe(true)
    expect(session.can('comercial.administrar')).toBe(true)
  })

  it('normaliza un login 401', async () => {
    const session = useSessionStore()
    await expect(session.login('vendedor', 'incorrecta')).rejects.toMatchObject({
      status: 401,
      code: 'http',
    })
  })

  it('limpia la sesión si /auth/me/ no autoriza la identidad', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/auth/me/', () =>
        HttpResponse.json({ detail: 'No autorizado' }, { status: 401 }),
      ),
    )
    const session = useSessionStore()

    await expect(session.login('vendedor', 'correcta')).rejects.toMatchObject({ status: 401 })
    expect(session.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem('homex.session.v1')).toBeNull()
  })

  it('renueva una vez después de 401 y repite la lectura autenticada', async () => {
    const session = useSessionStore()
    await session.login('vendedor', 'correcta')
    let calls = 0
    server.use(
      http.get('http://localhost:8000/protegido', () =>
        ++calls === 1
          ? HttpResponse.json({ detail: 'expired' }, { status: 401 })
          : HttpResponse.json({ ok: true }),
      ),
    )
    await expect(apiRequest<{ ok: boolean }>('/protegido')).resolves.toEqual({ ok: true })
    expect(calls).toBe(2)
  })

  it('distingue un fallo de red', async () => {
    server.use(http.get('http://localhost:8000/falla', () => HttpResponse.error()))
    await expect(apiRequest('/falla', { authenticated: false })).rejects.toEqual(
      expect.objectContaining({ code: 'network', status: null }),
    )
  })

  it('conserva status y errores por campo en respuestas 403', async () => {
    server.use(
      http.get('http://localhost:8000/restringido', () =>
        HttpResponse.json({ detail: 'Sin permiso', campo: ['No permitido'] }, { status: 403 }),
      ),
    )
    await expect(apiRequest('/restringido', { authenticated: false })).rejects.toMatchObject({
      status: 403,
      message: 'Sin permiso',
      fields: { campo: ['No permitido'] },
    })
  })
})
