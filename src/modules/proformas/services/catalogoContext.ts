/** Contexto visual recuperable sin credenciales ni escritura de la proforma. */
export type CatalogoContextState = {
  category: string
  search: string
  family: string
  filters: Record<string, string>
  view: 'grid' | 'lista'
  page: number
}
