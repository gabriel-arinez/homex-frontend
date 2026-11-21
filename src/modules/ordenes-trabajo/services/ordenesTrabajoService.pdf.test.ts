import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/shared/api'
import { ordenesTrabajoService } from './ordenesTrabajoService'

vi.mock('@/shared/api', () => ({ apiRequest: vi.fn<() => Promise<Blob>>() }))

describe('authenticated work order PDF request', () => {
  it('requests work order PDF bypassing browser caches', () => {
    ordenesTrabajoService.documentPdf(40)
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/ordenes-trabajo/40/documento-pdf/', {
      responseType: 'blob',
      cache: 'no-store',
    })
  })
})
