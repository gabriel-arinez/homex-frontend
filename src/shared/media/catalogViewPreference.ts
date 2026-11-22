/** Preferencia de visualización (cuadrícula o lista) en el catálogo de productos. */
export type CatalogViewMode = 'grid' | 'lista'

const KEY = 'homex.catalogo.vista-preferida.v1'

export function readCatalogViewMode(): CatalogViewMode {
  try {
    return localStorage.getItem(KEY) === 'grid' ? 'grid' : 'lista'
  } catch {
    return 'lista'
  }
}

export function writeCatalogViewMode(view: CatalogViewMode): void {
  try {
    localStorage.setItem(KEY, view)
  } catch {
    // La preferencia es opcional cuando el navegador bloquea el almacenamiento.
  }
}
