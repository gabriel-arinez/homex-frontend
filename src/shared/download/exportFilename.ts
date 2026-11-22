export function slugSegment(value: string | number | null | undefined, maxLen = 40): string {
  if (value === null || value === undefined) return ''
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized.slice(0, maxLen).replace(/-+$/g, '')
}

export function buildExportFilename(
  prefix: string,
  segments: Array<string | number | null | undefined>,
  extension: string,
): string {
  const cleanSegments = segments.map((segment) => slugSegment(segment)).filter(Boolean)
  const base = [slugSegment(prefix) || 'documento', ...cleanSegments].join('_')
  const cleanExt = extension.replace(/^\.+/, '').toLowerCase()
  return `${base}.${cleanExt}`
}
