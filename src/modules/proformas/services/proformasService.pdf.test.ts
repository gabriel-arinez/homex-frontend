import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/shared/api'
import { proformasService } from './proformasService'

vi.mock('@/shared/api', () => ({ apiRequest: vi.fn<() => Promise<Blob>>() }))

describe('authenticated proforma PDF request', () => {
  it('bypasses browser caches without submitting a signer identity', () => {
    proformasService.documentPdf(578)
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/proformas/578/documento-pdf/', {
      responseType: 'blob',
      cache: 'no-store',
    })
  })
})
