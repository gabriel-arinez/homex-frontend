import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { apiRequest } from '@/shared/api'
import { pythonOffsetToUtf16, pythonSpanToUtf16 } from '@/modules/capturas/evidence'
import { server } from '@/tests/msw/server'

describe('AP2 · HTTP mutaciones y evidencia HITL', () => {
  it.each([401, 403])('propaga %s sin mostrar datos protegidos', async (status) => {
    server.use(
      http.get('http://localhost:8000/api/v1/restringido/', () =>
        HttpResponse.json({ detail: 'Acceso no autorizado' }, { status }),
      ),
    )
    await expect(
      apiRequest('/api/v1/restringido/', { authenticated: false }),
    ).rejects.toMatchObject({ status, code: 'http', message: 'Acceso no autorizado' })
  })

  it.each([409, 500])('no reenvía automáticamente una mutación fallida (%s)', async (status) => {
    let requests = 0
    server.use(
      http.post('http://localhost:8000/api/v1/proformas/1/aprobar/', async ({ request }) => {
        requests++
        expect(await request.json()).toEqual({ aceptada: true })
        return HttpResponse.json({ detail: 'No confirmada' }, { status })
      }),
    )

    await expect(
      apiRequest('/api/v1/proformas/1/aprobar/', {
        method: 'POST',
        body: { aceptada: true },
        authenticated: false,
      }),
    ).rejects.toMatchObject({ status, message: 'No confirmada' })
    expect(requests).toBe(1)
  })

  it('preserva offsets Unicode y la evidencia original sin truncar caracteres', () => {
    const original = 'A😀 mesa e\u0301xito 🪑'
    expect(pythonOffsetToUtf16(original, 2)).toBe(3)
    expect(pythonSpanToUtf16(original, 1, 2)).toEqual({ start: 1, end: 3 })
    expect(pythonSpanToUtf16(original, 2, 7)).toEqual({ start: 3, end: 8 })
    expect(original).toBe('A😀 mesa e\u0301xito 🪑')
  })
})
