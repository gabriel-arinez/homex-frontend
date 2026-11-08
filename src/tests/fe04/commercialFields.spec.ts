import { describe, expect, it } from 'vitest'
import {
  cleanInput,
  validateClient,
  validateQuoteConditions,
} from '@/shared/validation/commercialFields'

const validClient = {
  nombres: 'María José',
  apellidos: 'O’Connor-Pérez',
  empresa: '',
  celular: '70123456',
  direccion: 'Calle 10, N.º 5',
  observaciones: 'Entrega en zona central.',
}

describe('validación compartida de clientes', () => {
  it('conserva caracteres de nombres reales y elimina números de nombres', () => {
    expect(cleanInput('María-José O’Connor 423', 'name').trim()).toBe('María-José O’Connor')
    expect(cleanInput('Pérez', 'name')).toBe('Pérez')
  })

  it('conserva cifras y símbolos en búsqueda comercial', () => {
    expect(cleanInput('Diseños & Muebles 360', 'search', 60)).toBe('Diseños & Muebles 360')
    expect(cleanInput('Ana\nPérez', 'search')).toBe('AnaPérez')
  })

  it('limita celular a 8 dígitos sin interferir con nombres', () => {
    expect(cleanInput('(+591) 70123456', 'digits', 8)).toBe('59170123')
    expect(validateClient({ ...validClient, celular: '7012345' }, false).celular).toMatch(
      /8 dígitos/,
    )
  })

  it('exige contacto y razón social únicamente cuando corresponde', () => {
    expect(validateClient(validClient, false)).toEqual({})
    expect(validateClient(validClient, true).empresa).toMatch(/razón social/)
    expect(validateClient({ ...validClient, empresa: 'HOMEX 360 & Co.' }, true)).toEqual({})
  })

  it('controla longitudes sin modificar información', () => {
    expect(validateClient({ ...validClient, apellidos: 'a'.repeat(51) }, false).apellidos).toMatch(
      /50/,
    )
    expect(validateClient({ ...validClient, empresa: 'a'.repeat(101) }, true).empresa).toMatch(
      /100/,
    )
  })
})

describe('condiciones comerciales', () => {
  const base = {
    titulo: 'Proforma',
    plazo_entrega: '',
    porcentaje_adelanto: '',
    validez_oferta: '',
    observaciones: '',
  }
  it('limpia símbolos en plazo de entrega con regla delivery', () => {
    expect(cleanInput('15 días hábiles! #1', 'delivery', 45)).toBe('15 días hábiles 1')
    expect(cleanInput("D'Alessandro 48h", 'delivery', 45)).toBe("D'Alessandro 48h")
  })
  it('permite adelanto cero, enteros de hasta 3 dígitos y valores opcionales en borrador', () => {
    expect(validateQuoteConditions({ ...base, porcentaje_adelanto: '0' })).toEqual({})
    expect(
      validateQuoteConditions({
        ...base,
        porcentaje_adelanto: '100',
        validez_oferta: '100',
        plazo_entrega: '15 días hábiles',
      }),
    ).toEqual({})
  })
  it('rechaza adelantos fuera de rango, decimales y validez fuera de 1-100', () => {
    expect(
      validateQuoteConditions({ ...base, porcentaje_adelanto: '101' }).porcentaje_adelanto,
    ).toBeTruthy()
    expect(
      validateQuoteConditions({ ...base, porcentaje_adelanto: '99.99' }).porcentaje_adelanto,
    ).toBeTruthy()
    expect(validateQuoteConditions({ ...base, validez_oferta: '0' }).validez_oferta).toBeTruthy()
    expect(validateQuoteConditions({ ...base, validez_oferta: '101' }).validez_oferta).toBeTruthy()
  })
  it('valida longitud máxima de título (180), plazo (45) y observaciones (250)', () => {
    const errors = validateQuoteConditions({
      ...base,
      titulo: 't'.repeat(181),
      plazo_entrega: 'x'.repeat(46),
      observaciones: 'o'.repeat(251),
    })
    expect(errors.titulo).toBeTruthy()
    expect(errors.plazo_entrega).toBeTruthy()
    expect(errors.observaciones).toBeTruthy()
  })
  it('rechaza símbolos en plazo de entrega', () => {
    expect(
      validateQuoteConditions({ ...base, plazo_entrega: '15 días!' }).plazo_entrega,
    ).toBeTruthy()
    expect(
      validateQuoteConditions({ ...base, plazo_entrega: '10# días$' }).plazo_entrega,
    ).toBeTruthy()
  })
  it('exige adelanto, plazo y validez para emisión a revisión manteniendo título opcional', () => {
    const emissionErrors = validateQuoteConditions(
      {
        titulo: '',
        plazo_entrega: '',
        porcentaje_adelanto: '',
        validez_oferta: '',
        observaciones: '',
      },
      { forEmission: true },
    )
    expect(emissionErrors.titulo).toBeUndefined()
    expect(emissionErrors.observaciones).toBeUndefined()
    expect(emissionErrors.porcentaje_adelanto).toBeTruthy()
    expect(emissionErrors.plazo_entrega).toBeTruthy()
    expect(emissionErrors.validez_oferta).toBeTruthy()
  })
})
