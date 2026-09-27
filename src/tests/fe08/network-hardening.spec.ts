import { describe, expect, it } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { apiRequest } from '@/shared/api'
import { server } from '@/tests/msw/server'

describe('FE08 matriz transversal del cliente HTTP', () => {
  it.each([
    [404, 'Recurso inexistente'],
    [409, 'Conflicto comercial'],
    [500, 'Error interno controlado'],
  ])('conserva el estado %s y el mensaje seguro', async (status, detail) => {
    server.use(
      http.get('http://localhost:8000/matriz', () => HttpResponse.json({ detail }, { status })),
    )
    await expect(apiRequest('/matriz', { authenticated: false })).rejects.toMatchObject({
      status,
      message: detail,
      code: 'http',
    })
  })

  it('conserva errores comerciales DRF publicados como texto por campo', async () => {
    server.use(
      http.post('http://localhost:8000/cancelar', () =>
        HttpResponse.json(
          { cancelacion: 'No se puede cancelar un pedido con recibos emitidos' },
          { status: 400 },
        ),
      ),
    )
    await expect(
      apiRequest('/cancelar', { method: 'POST', authenticated: false }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'No se puede cancelar un pedido con recibos emitidos',
      fields: { cancelacion: ['No se puede cancelar un pedido con recibos emitidos'] },
    })
  })

  it('distingue timeout de caída de red', async () => {
    server.use(
      http.get('http://localhost:8000/lento', async () => {
        await delay(100)
        return HttpResponse.json({ ok: true })
      }),
    )
    await expect(
      apiRequest('/lento', { authenticated: false, timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: 'timeout', status: null })
  })

  it('rechaza JSON inválido aunque la respuesta sea 200', async () => {
    server.use(
      http.get(
        'http://localhost:8000/invalido',
        () => new HttpResponse('<html>no-json</html>', { status: 200 }),
      ),
    )
    await expect(apiRequest('/invalido', { authenticated: false })).rejects.toMatchObject({
      code: 'invalid_response',
      status: 200,
    })
  })
})
