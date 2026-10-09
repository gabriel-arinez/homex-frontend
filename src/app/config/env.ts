/** Valida la URL pública del backend antes de que un adapter HTTP la use. */
export function getApiBaseUrl(value = import.meta.env.VITE_API_BASE_URL): string {
  if (!value) {
    throw new Error('VITE_API_BASE_URL es obligatoria.')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('VITE_API_BASE_URL debe ser una URL absoluta válida.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('VITE_API_BASE_URL debe usar HTTP o HTTPS.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL no debe incluir credenciales, query ni fragmento.')
  }

  return url.toString().replace(/\/$/, '')
}
