import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import router from '@/app/router'
import { useSessionStore } from '@/app/stores/useSessionStore'

describe('guards de rutas', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    await router.replace('/login')
  })
  it('redirige una ruta privada al login sin crear un bucle', async () => {
    await router.push('/resumen')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/resumen')
  })
  it('lleva al encargado al catálogo sin otorgar administración comercial', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/auth/me/', () =>
        HttpResponse.json({
          id: 19,
          username: 'encargado',
          display_name: 'Encargado',
          capabilities: ['catalogo.crear_producto'],
        }),
      ),
    )
    const session = useSessionStore()
    await session.login('vendedor', 'correcta')
    await router.push('/resumen')
    expect(router.currentRoute.value.name).toBe('productos')
    expect(session.can('comercial.administrar')).toBe(false)
    expect(session.can('comercial.operar')).toBe(false)
  })
  it('dirige a los tres perfiles definitivos a su panel operativo inicial', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/auth/me/', () =>
        HttpResponse.json({
          id: 21,
          username: 'jefe_taller',
          display_name: 'Jefe Taller',
          capabilities: ['taller.operar'],
        }),
      ),
    )
    const session = useSessionStore()
    await session.login('vendedor', 'correcta')
    expect(session.roleProfile).toBe('JEFE_TALLER')
    expect(session.roleLabel).toBe('Jefe de taller')
    expect(session.defaultRouteName).toBe('resumen')
    await router.push('/resumen')
    expect(router.currentRoute.value.name).toBe('resumen')
    await router.push('/clientes')
    expect(router.currentRoute.value.name).toBe('forbidden')
  })
  it('mantiene logout como sesión anónima', () => {
    const session = useSessionStore()
    session.logout()
    expect(session.isAuthenticated).toBe(false)
  })
})

it('envía a 403 cuando falta una capacidad requerida', async () => {
  const session = useSessionStore()
  await session.login('vendedor', 'correcta')
  const { authGuard } = await import('@/app/router')
  const result = await authGuard(
    {
      meta: { requiresAuth: true, capability: 'comercial.administrar' },
      fullPath: '/clientes',
      name: 'clientes',
    } as never,
    {} as never,
    (() => undefined) as never,
  )
  expect(result).toEqual({ name: 'forbidden' })
})
