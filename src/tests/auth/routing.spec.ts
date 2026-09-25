import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
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
