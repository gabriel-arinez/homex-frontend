import { describe, expect, it } from 'vitest'
import { retornoAProformas } from './navegacionProformas'

describe('Retorno al listado de proformas', () => {
  it('preserva filtros y página del listado', () => {
    expect(retornoAProformas('/proformas?estado=BORRADOR&pagina=2')).toBe(
      '/proformas?estado=BORRADOR&pagina=2',
    )
  })

  it.each([null, undefined, ['proformas'], 'https://otro-sitio.test/', '//evil.test', '/pedidos', '/proformas/1', '/proformas-malicioso'])(
    'rechaza destinos fuera de la bandeja (%s)',
    (value) => {
      expect(retornoAProformas(value)).toBe('/proformas')
    },
  )
})
