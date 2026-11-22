const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const ESPECIALES = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
]
const VEINTIS = [
  'veinte',
  'veintiún',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
]
const DECENAS = [
  '',
  '',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
]
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
]

function convertirMenorAMil(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'

  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c]!)

  if (resto >= 10 && resto <= 19) {
    partes.push(ESPECIALES[resto - 10]!)
  } else if (resto >= 20 && resto <= 29) {
    partes.push(VEINTIS[resto - 20]!)
  } else {
    const d = Math.floor(resto / 10)
    const u = resto % 10
    if (d > 0 && u > 0) partes.push(`${DECENAS[d]!} y ${UNIDADES[u]!}`)
    else if (d > 0) partes.push(DECENAS[d]!)
    else if (u > 0) partes.push(UNIDADES[u]!)
  }
  return partes.join(' ')
}

function enteroALetras(n: number): string {
  if (n === 0) return 'cero'
  if (n < 1000) return convertirMenorAMil(n)

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const unidades = n % 1000
  const partes: string[] = []

  if (millones === 1) partes.push('un millón')
  else if (millones > 1) partes.push(`${convertirMenorAMil(millones)} millones`)

  if (miles === 1) partes.push('mil')
  else if (miles > 1) partes.push(`${convertirMenorAMil(miles)} mil`)

  if (unidades > 0) partes.push(convertirMenorAMil(unidades))
  return partes.join(' ')
}

function etiquetaMoneda(codigo: string, esUno: boolean): string {
  const upper = codigo.trim().toUpperCase()
  if (upper === 'USD') return esUno ? 'Dólar' : 'Dólares'
  if (upper === 'BOB' || !upper) return esUno ? 'Boliviano' : 'Bolivianos'
  return upper
}

export function montoEnLetras(valor: number | string, monedaCodigo = 'BOB'): string {
  const texto = String(valor ?? '')
    .trim()
    .replace(',', '.')
  if (!texto) return ''
  const num = Number(texto)
  if (!Number.isFinite(num) || num <= 0) return ''

  const redondeado = Math.round(num * 100)
  const entero = Math.floor(redondeado / 100)
  const centavos = String(redondeado % 100).padStart(2, '0')
  const letras = enteroALetras(entero)
  const capitalizado = letras.charAt(0).toUpperCase() + letras.slice(1)
  const moneda = etiquetaMoneda(monedaCodigo, entero === 1 && centavos === '00')
  return `${capitalizado} ${centavos}/100 ${moneda}`
}
