import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/shared/api'
import { notasEntregaService } from './notasEntregaService'

vi.mock('@/shared/api', () => ({ apiRequest: vi.fn<() => Promise<Blob>>() }))

describe('authenticated delivery note PDF request', () => {
  it('requests delivery note PDF bypassing browser caches', () => {
    notasEntregaService.documentPdf(88)
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/notas-entrega/88/documento-pdf/', {
      responseType: 'blob',
      cache: 'no-store',
    })
  })
})
