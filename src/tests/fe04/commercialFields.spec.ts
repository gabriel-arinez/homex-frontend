import { describe, expect, it } from 'vitest'
import {
  cleanInput,
  validateClient,
  validateQuoteConditions,
} from '@/shared/validation/commercialFields'

const validClient = {
  nombres: "María José",
  apellidos: "O’Connor-Pérez",
  empresa: '',
  celular: '70123456',
  direccion: 'Calle 10, N.º 5',
  observaciones: 'Entrega en zona central.',
}

describe('validación compartida de clientes', () => {
  it('conserva caracteres de nombres reales y elimina números de nombres', () => {
    expect(cleanInput("María-José O’Connor 423", 'name').trim()).toBe("María-José O’Connor")
    expect(cleanInput("Pérez", 'name')).toBe('Pérez')
  })

  it('conserva cifras y símbolos en búsqueda comercial', () => {
    expect(cleanInput('Diseños & Muebles 360', 'search', 60)).toBe('Diseños & Muebles 360')
    expect(cleanInput('Ana\nPérez', 'search')).toBe('AnaPérez')
  })

  it('limita celular a 8 dígitos sin interferir con nombres', () => {
    expect(cleanInput('(+591) 70123456', 'digits', 8)).toBe('59170123')
    expect(validateClient({ ...validClient, celular: '7012345' }, false).celular).toMatch(/8 dígitos/)
  })

  it('exige contacto y razón social únicamente cuando corresponde', () => {
    expect(validateClient(validClient, false)).toEqual({})
    expect(validateClient(validClient, true).empresa).toMatch(/razón social/)
    expect(validateClient({ ...validClient, empresa: 'HOMEX 360 & Co.' }, true)).toEqual({})
  })

  it('controla longitudes sin modificar información', () => {
    expect(validateClient({ ...validClient, apellidos: 'a'.repeat(51) }, false).apellidos).toMatch(/50/)
    expect(validateClient({ ...validClient, empresa: 'a'.repeat(101) }, true).empresa).toMatch(/100/)
  })
})

describe('condiciones comerciales', () => {
  const base = { titulo: 'Proforma', plazo_entrega: '', porcentaje_adelanto: '', validez_oferta: '', observaciones: '' }
  it('permite adelanto cero, decimales válidos y valores opcionales', () => {
    expect(validateQuoteConditions({ ...base, porcentaje_adelanto: '0' })).toEqual({})
    expect(validateQuoteConditions({ ...base, porcentaje_adelanto: '99.99', validez_oferta: '99' })).toEqual({})
  })
  it('rechaza adelantos fuera de rango y validez fuera de 1-99', () => {
    expect(validateQuoteConditions({ ...base, porcentaje_adelanto: '101' }).porcentaje_adelanto).toBeTruthy()
    expect(validateQuoteConditions({ ...base, porcentaje_adelanto: '1.234' }).porcentaje_adelanto).toBeTruthy()
    expect(validateQuoteConditions({ ...base, validez_oferta: '0' }).validez_oferta).toBeTruthy()
    expect(validateQuoteConditions({ ...base, validez_oferta: '100' }).validez_oferta).toBeTruthy()
  })
  it('valida longitud de plazo y observaciones', () => {
    const errors = validateQuoteConditions({ ...base, plazo_entrega: 'x'.repeat(46), observaciones: 'o'.repeat(251) })
    expect(errors.plazo_entrega).toBeTruthy()
    expect(errors.observaciones).toBeTruthy()
  })
})
