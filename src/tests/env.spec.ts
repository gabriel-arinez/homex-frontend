import { describe, expect, it } from 'vitest'

import { getApiBaseUrl } from '@/app/config/env'

describe('getApiBaseUrl', () => {
  it('normaliza una URL HTTP(S) válida', () => {
    expect(getApiBaseUrl('https://api.homex.test/')).toBe('https://api.homex.test')
  })

  it('rechaza valores ausentes o no HTTP(S)', () => {
    expect(() => getApiBaseUrl('')).toThrow('VITE_API_BASE_URL')
    expect(() => getApiBaseUrl('ftp://api.homex.test')).toThrow('HTTP o HTTPS')
  })

  it('rechaza credenciales, query y fragmentos en la configuración pública', () => {
    expect(() => getApiBaseUrl('https://usuario:secreto@homex.test')).toThrow('credenciales')
    expect(() => getApiBaseUrl('https://homex.test?token=secreto')).toThrow('query')
    expect(() => getApiBaseUrl('https://homex.test#privado')).toThrow('fragmento')
  })
})
