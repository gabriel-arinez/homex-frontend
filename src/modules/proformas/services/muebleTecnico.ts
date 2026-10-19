export type AtributoTecnico = { codigo?: string; nombre: string; valor: string }
export type ConjuntoTecnico = { uid: string; nombre: string }
export type ComponenteTecnico = {
  uid?: string
  conjunto_uid?: string
  nombre: string
  cantidad_interna?: number
  material?: string
  espesor?: string
  color?: string
  dimensiones?: string
  acabado?: string
  atributos?: AtributoTecnico[]
  [key: string]: unknown
}
export type DatosTecnicos = {
  caracteristicas_generales?: Record<string, unknown>
  conjuntos?: ConjuntoTecnico[]
  componentes?: ComponenteTecnico[]
  accesorios?: string[]
  advertencias?: string[]
  descripcion_original?: string
  [key: string]: unknown
}
export const LIMITES_PRF03 = { max_conjuntos: 10, max_componentes: 40 }

export function clonarTecnica<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

export function leerDatosTecnicos(valor: unknown): DatosTecnicos {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {}
  return clonarTecnica(valor as DatosTecnicos)
}

export function fusionarDatosTecnicos(base: DatosTecnicos, cambios: Partial<DatosTecnicos>) {
  const resultado = clonarTecnica(base)
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === undefined) continue
    if (
      resultado[clave] &&
      typeof resultado[clave] === 'object' &&
      !Array.isArray(resultado[clave]) &&
      typeof valor === 'object' &&
      !Array.isArray(valor)
    ) {
      resultado[clave] = { ...(resultado[clave] as object), ...valor }
    } else resultado[clave] = clonarTecnica(valor)
  }
  return resultado
}

export function validarDatosTecnicos(datos: DatosTecnicos, limites = LIMITES_PRF03): string[] {
  const errores: string[] = []
  const conjuntos = datos.conjuntos ?? []
  const componentes = datos.componentes ?? []
  if (conjuntos.length > limites.max_conjuntos)
    errores.push(`Máximo ${limites.max_conjuntos} conjuntos.`)
  if (componentes.length > limites.max_componentes)
    errores.push(`Máximo ${limites.max_componentes} componentes.`)
  const ids = new Set(conjuntos.map((item) => item.uid))
  for (const conjunto of conjuntos) {
    if (!conjunto.nombre.trim()) errores.push('Cada conjunto necesita nombre.')
    if (!componentes.some((item) => item.conjunto_uid === conjunto.uid))
      errores.push(`El conjunto ${conjunto.nombre || 'sin nombre'} necesita un componente.`)
  }
  for (const componente of componentes) {
    if (!componente.nombre.trim()) errores.push('Cada componente necesita nombre.')
    if (componente.conjunto_uid && !ids.has(componente.conjunto_uid))
      errores.push('Un componente referencia un conjunto inexistente.')
    if (componente.cantidad_interna != null && componente.cantidad_interna <= 0)
      errores.push('La cantidad por mueble debe ser positiva.')
    const claves = new Set<string>()
    for (const atributo of componente.atributos ?? []) {
      const clave = (atributo.codigo || atributo.nombre).trim().toLocaleLowerCase('es')
      if (!atributo.nombre.trim() || !atributo.valor.trim())
        errores.push('Completa o quita el atributo vacío.')
      if (claves.has(clave)) errores.push(`Atributo duplicado: ${atributo.nombre}.`)
      claves.add(clave)
    }
  }
  return [...new Set(errores)]
}

export function tecnicaIgual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}
