import type { PendienteAsistida, PropuestaConfigurador } from '@/generated/api'

export type EvidenceCategory =
  | 'commercial'
  | 'dimensions'
  | 'structure'
  | 'pending'
  | 'unidentified'

export type VoiceEvidence = {
  label?: string
  start: number
  end: number
  text: string
  decision: 'ACCEPTED' | 'UNRESOLVED' | 'REJECTED'
  reason?: string | null
  category?: EvidenceCategory
  fieldLabel?: string
}

export function categorizeEvidenceLabel(
  label?: string,
  decision?: VoiceEvidence['decision'],
): EvidenceCategory {
  if (decision === 'UNRESOLVED') return 'pending'
  if (decision === 'REJECTED') return 'unidentified'
  const key = (label ?? '').toLowerCase()
  if (
    /precio|costo|cantidad|unidad|descuento|moneda|nombre|sku|promocion|comercial/.test(key)
  ) {
    return 'commercial'
  }
  if (/ancho|alto|profundidad|largo|espesor_piso|m2|medida|dimension/.test(key)) {
    return 'dimensions'
  }
  return 'structure'
}

/** NLP offsets count Unicode code points, not JavaScript UTF-16 units. */
export function evidenceSegments(text: string, evidence: VoiceEvidence[]) {
  const characters = Array.from(text)
  const valid = evidence.filter(
    (e) =>
      Number.isInteger(e.start) &&
      Number.isInteger(e.end) &&
      e.start >= 0 &&
      e.end > e.start &&
      e.end <= characters.length &&
      characters.slice(e.start, e.end).join('') === e.text,
  )
  const boundaries = [
    ...new Set([0, characters.length, ...valid.flatMap((e) => [e.start, e.end])]),
  ].sort((a, b) => a - b)
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!
    const matches = valid.filter((e) => e.start <= start && e.end >= end)
    const match =
      matches.find((e) => e.decision === 'UNRESOLVED') ??
      matches.find((e) => e.decision === 'REJECTED') ??
      matches[0]
    return {
      text: characters.slice(start, end).join(''),
      decision: match?.decision,
      reason: match?.reason ?? '',
      ...(match?.category ? { category: match.category } : {}),
      ...(match?.fieldLabel || match?.label
        ? { fieldLabel: match?.fieldLabel ?? match?.label }
        : {}),
    }
  })
}

const STOPWORDS = new Set([
  'para',
  'con',
  'sin',
  'sobre',
  'entre',
  'hasta',
  'desde',
  'como',
  'pero',
  'porque',
  'este',
  'esta',
  'estos',
  'estas',
  'unos',
  'unas',
  'unos',
  'todo',
  'toda',
  'todos',
  'todas',
  'cada',
  'otro',
  'otra',
  'otros',
  'otras',
  'color',
  'medida',
  'medidas',
  'precio',
  'cantidad',
  'espesor',
  'material',
  'mueble',
  'tiene',
  'tener',
  'quiero',
  'necesito',
  'favor',
  'cotizar',
  'cotizacion',
  'cotización',
  'bolivianos',
  'dolares',
  'dólares',
])

function toCodePointOffset(text: string, utf16Index: number): number {
  return Array.from(text.slice(0, utf16Index)).length
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildFurnitureTranscriptEvidence(
  transcript: string,
  proposal?: PropuestaConfigurador | null,
  pendientes: PendienteAsistida[] = [],
): VoiceEvidence[] {
  const cleanText = transcript.trim()
  if (!cleanText) return []
  const chars = Array.from(transcript)
  const ranges: Array<{
    start: number
    end: number
    decision: VoiceEvidence['decision']
    category: EvidenceCategory
    fieldLabel: string
    reason?: string
  }> = []

  const overlaps = (start: number, end: number) =>
    ranges.some((r) => Math.max(r.start, start) < Math.min(r.end, end))

  const claimPattern = (
    rawTerm: string,
    category: EvidenceCategory,
    fieldLabel: string,
    decision: VoiceEvidence['decision'] = 'ACCEPTED',
    reason?: string,
  ) => {
    const term = rawTerm.trim()
    if (!term || term.length < 2) return
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, 'giu')
    let match: RegExpExecArray | null
    while ((match = regex.exec(transcript)) !== null) {
      const start = toCodePointOffset(transcript, match.index)
      const end = toCodePointOffset(transcript, match.index + match[0].length)
      if (!overlaps(start, end)) {
        ranges.push({ start, end, decision, category, fieldLabel, reason })
      }
    }
  }

  // 1. Pendientes primero para que tengan prioridad visual
  for (const p of pendientes) {
    const val = p.resolucion?.valor?.trim()
    if (val) claimPattern(val, 'pending', p.resolucion?.clave || 'Pendiente', 'UNRESOLVED', p.mensaje)
  }

  // 2. Campos comerciales
  if (proposal?.comercial) {
    const c = proposal.comercial
    if (c.nombre) claimPattern(String(c.nombre), 'commercial', 'Nombre comercial')
    if (c.cantidad != null) {
      const qty = String(c.cantidad).replace(/\.0+$/, '')
      claimPattern(qty, 'commercial', 'Cantidad')
    }
    if (c.precio_unitario != null) {
      const price = String(c.precio_unitario).replace(/\.0+$/, '')
      claimPattern(price, 'commercial', 'Precio unitario')
    }
    if (c.descuento != null && Number(c.descuento) > 0) {
      claimPattern(String(c.descuento).replace(/\.0+$/, ''), 'commercial', 'Descuento')
    }
  }

  // 3. Dimensiones y datos técnicos
  const tech = (proposal?.especificacion?.datos_tecnicos ?? {}) as Record<string, unknown>
  const general = tech.caracteristicas_generales as
    | {
        dimensiones?: Record<string, { valor?: unknown; unidad?: string } | unknown>
        atributos?: Record<string, { valor?: unknown } | unknown>
      }
    | undefined

  for (const [key, entry] of Object.entries(general?.dimensiones ?? {})) {
    const val =
      entry && typeof entry === 'object' && 'valor' in entry ? (entry as { valor: unknown }).valor : entry
    const unit =
      entry && typeof entry === 'object' && 'unidad' in entry
        ? String((entry as { unidad?: string }).unidad ?? '')
        : ''
    if (val != null && String(val).trim()) {
      const numStr = String(val).replace(/\.0+$/, '')
      if (unit) claimPattern(`${numStr} ${unit}`, 'dimensions', `Dimensión: ${key}`)
      claimPattern(numStr, 'dimensions', `Dimensión: ${key}`)
    }
  }

  for (const [key, entry] of Object.entries(general?.atributos ?? {})) {
    const val =
      entry && typeof entry === 'object' && 'valor' in entry ? (entry as { valor: unknown }).valor : entry
    if (val != null && String(val).trim()) {
      claimPattern(String(val), 'structure', `Atributo: ${key}`)
    }
  }

  if (Array.isArray(tech.componentes)) {
    for (const comp of tech.componentes) {
      if (!comp || typeof comp !== 'object') continue
      const c = comp as Record<string, unknown>
      if (c.nombre) claimPattern(String(c.nombre), 'structure', `Componente: ${c.nombre}`)
      if (c.material) claimPattern(String(c.material), 'structure', 'Material')
      if (c.color) claimPattern(String(c.color), 'structure', 'Color')
      if (c.espesor != null) {
        const esp = String(c.espesor).replace(/\.0+$/, '')
        claimPattern(`${esp} mm`, 'structure', 'Espesor')
        claimPattern(`${esp} milímetros`, 'structure', 'Espesor')
        claimPattern(esp, 'structure', 'Espesor')
      }
    }
  }

  // 4. Palabras significativas / números no identificados
  const tokenRegex = /[\p{L}\p{N}]+(?:[.,][\p{N}]+)?/gu
  let tokenMatch: RegExpExecArray | null
  while ((tokenMatch = tokenRegex.exec(transcript)) !== null) {
    const word = tokenMatch[0]
    const lower = word.toLowerCase()
    const isNumber = /^\d+([.,]\d+)?$/.test(word)
    if (!isNumber && (lower.length < 4 || STOPWORDS.has(lower))) continue
    const start = toCodePointOffset(transcript, tokenMatch.index)
    const end = toCodePointOffset(transcript, tokenMatch.index + word.length)
    if (!overlaps(start, end)) {
      ranges.push({
        start,
        end,
        decision: 'REJECTED',
        category: 'unidentified',
        fieldLabel: 'No identificado',
        reason: 'Término no asignado automáticamente a un campo',
      })
    }
  }

  return ranges
    .sort((a, b) => a.start - b.start)
    .map((r) => ({
      start: r.start,
      end: r.end,
      text: chars.slice(r.start, r.end).join(''),
      decision: r.decision,
      category: r.category,
      fieldLabel: r.fieldLabel,
      label: r.fieldLabel,
      reason: r.reason ?? null,
    }))
}
