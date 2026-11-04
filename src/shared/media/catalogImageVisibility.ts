/** Preferencia visual compartida entre catálogos; no altera los datos ni la API. */
const KEY = 'homex.catalogo.imagenes-visibles.v1'
export function readCatalogImagesVisible(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false'
  } catch {
    return true
  }
}
export function writeCatalogImagesVisible(visible: boolean): void {
  try {
    localStorage.setItem(KEY, String(visible))
  } catch {
    // La preferencia es opcional cuando el navegador bloquea el almacenamiento.
  }
}
