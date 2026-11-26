import type { PendienteAsistida, PropuestaConfigurador } from '@/generated/api'

export type EvidenceCategory = 'commercial' | 'dimensions' | 'structure' | 'conflict'

export type VoiceEvidence = {
  label?: string
  start: number
  end: number
  text: string
  decision: 'ACCEPTED' | 'UNRESOLVED' | 'REJECTED'
  reason?: string | null
  category?: EvidenceCategory
  fieldLabel?: string
  candidateId?: string
  resolved?: boolean
}

export type NlpCandidateLike = {
  candidate_id?: string
  label?: string
  start?: number
  end?: number
  text?: string
  decision?: 'ACCEPTED' | 'UNRESOLVED' | 'REJECTED' | string
  reason?: string | null
  normalized_value?: unknown
  component_ref?: string | null
}

export type HumanReviewStatus = {
  field: string
  state: 'suggested' | 'pending' | 'reviewed' | 'edited' | 'discarded'
  reason?: string
}

export function categorizeEvidenceLabel(
  label?: string,
  decision?: VoiceEvidence['decision'],
): EvidenceCategory {
  if (decision === 'UNRESOLVED' || decision === 'REJECTED') return 'conflict'
  const key = (label ?? '').toLowerCase()
  if (
    /precio|costo|cantidad(?!_interna)|unidad|descuento|moneda|nombre|sku|promocion|comercial|titulo|descripcion/.test(
      key,
    )
  ) {
    return 'commercial'
  }
  if (/ancho|alto|profundidad|largo|diametro|espesor_piso|m2|medida|dimension/.test(key)) {
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
      ...(match?.resolved ? { resolved: true } : {}),
    }
  })
}

function toCodePointOffset(text: string, utf16Index: number): number {
  return Array.from(text.slice(0, utf16Index)).length
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const NUMBER_WORDS: Record<string, string[]> = {
  '0': ['cero'],
  '1': ['uno', 'una', 'un'],
  '2': ['dos'],
  '3': ['tres'],
  '4': ['cuatro'],
  '5': ['cinco'],
  '6': ['seis'],
  '7': ['siete'],
  '8': ['ocho'],
  '9': ['nueve'],
  '10': ['diez'],
  '11': ['once'],
  '12': ['doce'],
  '15': ['quince'],
  '18': ['dieciocho'],
  '20': ['veinte'],
  '24': ['veinticuatro'],
  '25': ['veinticinco'],
  '30': ['treinta'],
  '40': ['cuarenta'],
  '50': ['cincuenta'],
  '60': ['sesenta'],
  '70': ['setenta'],
  '80': ['ochenta'],
  '90': ['noventa'],
  '100': ['cien', 'ciento'],
  '120': ['ciento veinte'],
  '150': ['ciento cincuenta'],
  '180': ['ciento ochenta'],
  '200': ['doscientos', 'doscientas'],
  '300': ['trescientos', 'trescientas'],
  '400': ['cuatrocientos', 'cuatrocientas'],
  '500': ['quinientos', 'quinientas'],
  '1000': ['mil'],
}

const UNIT_ALIASES: Record<string, string[]> = {
  mm: ['mm', 'milimetro', 'milimetros', 'milímetro', 'milímetros'],
  cm: ['cm', 'centimetro', 'centimetros', 'centímetro', 'centímetros'],
  m: ['m', 'metro', 'metros'],
  m2: ['m2', 'm²', 'metros cuadrados', 'metro cuadrado'],
  und: ['und', 'unidad', 'unidades', 'u', 'pieza', 'piezas', 'pza', 'pzas'],
  caja: ['caja', 'cajas'],
}

function numberVariants(raw: string): string[] {
  const clean = raw.trim().replace(/\.0+$/, '')
  const variants = new Set<string>([clean])
  if (clean.includes('.')) {
    variants.add(clean.replace('.', ','))
  } else if (clean.includes(',')) {
    variants.add(clean.replace(',', '.'))
  }
  const num = Number(clean.replace(',', '.'))
  if (Number.isFinite(num)) {
    // Handle normalized mm <-> cm <-> m equivalents
    if (num >= 100 && Number.isInteger(num)) {
      const meters = (num / 1000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
      const metersTwo = (num / 1000).toFixed(2)
      const cm = (num / 10).toString()
      variants.add(meters)
      variants.add(meters.replace('.', ','))
      variants.add(metersTwo)
      variants.add(metersTwo.replace('.', ','))
      variants.add(cm)
    }
    const words = NUMBER_WORDS[String(num)]
    if (words) {
      for (const word of words) variants.add(word)
    }
  }
  return Array.from(variants).filter(Boolean)
}

function unitVariants(rawUnit: string): string[] {
  const lower = rawUnit.trim().toLowerCase()
  for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
    if (canonical === lower || aliases.includes(lower)) {
      return aliases
    }
  }
  return lower ? [lower] : []
}

function humanizeFieldLabel(label?: string): string {
  const key = (label ?? '').trim()
  if (!key) return 'Dato extraído'
  const map: Record<string, string> = {
    NOMBRE: 'Nombre comercial',
    CANTIDAD: 'Cantidad',
    PRECIO_UNITARIO: 'Precio unitario',
    DESCUENTO: 'Descuento',
    ANCHO: 'Dimensión: ancho',
    ALTO: 'Dimensión: alto',
    LARGO: 'Dimensión: largo',
    PROFUNDIDAD: 'Dimensión: profundidad',
    DIAMETRO: 'Dimensión: diámetro',
    ESPESOR: 'Espesor',
    MATERIAL: 'Material',
    COLOR: 'Color',
    ACABADO: 'Acabado',
    COMPONENTE: 'Componente',
    CANTIDAD_INTERNA: 'Cantidad de componente',
    ACCESORIO: 'Accesorio',
    TIPO_MUEBLE: 'Tipo de mueble',
  }
  return map[key.toUpperCase()] ?? key.replace(/_/g, ' ')
}

function mapPendingKeyToField(p: PendienteAsistida): string | null {
  if (p.resolucion?.tipo === 'DIMENSION' && p.resolucion.clave) {
    return p.codigo === 'MISSING_UNIT' ? `unidad-${p.resolucion.clave}` : p.resolucion.clave
  }
  if (p.resolucion?.tipo === 'COMPONENTE') {
    return p.resolucion.campo ?? null
  }
  if (p.codigo === 'NO_QUANTITY' || p.codigo === 'INVALID_QUANTITY') return 'mueble-cantidad'
  if (p.codigo === 'TOTAL_NEGOCIADO' || p.codigo === 'INVALID_PRICE') return 'mueble-precio'
  if (p.codigo === 'TIPO_NO_RESUELTO') return 'tipo-mueble'
  return p.resolucion?.clave ?? null
}

export function buildFurnitureTranscriptEvidence(
  transcript: string,
  proposal?: PropuestaConfigurador | null,
  pendientes: PendienteAsistida[] = [],
  candidatos: NlpCandidateLike[] = [],
  humanReviews: HumanReviewStatus[] = [],
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
    reason?: string | null
    candidateId?: string
    resolved?: boolean
  }> = []

  const overlaps = (start: number, end: number) =>
    ranges.some((r) => Math.max(r.start, start) < Math.min(r.end, end))

  const reviewByField = new Map(humanReviews.map((r) => [r.field, r]))

  const resolveHumanOutcome = (
    fieldKey: string | null,
    defaultCategory: EvidenceCategory,
    defaultDecision: VoiceEvidence['decision'],
    defaultReason?: string | null,
  ): {
    skip?: boolean
    decision: VoiceEvidence['decision']
    category: EvidenceCategory
    reason?: string | null
    resolved?: boolean
  } => {
    if (!fieldKey) {
      return { decision: defaultDecision, category: defaultCategory, reason: defaultReason }
    }
    const review = reviewByField.get(fieldKey)
    if (!review) {
      return { decision: defaultDecision, category: defaultCategory, reason: defaultReason }
    }
    if (review.state === 'discarded') {
      return { skip: true, decision: 'REJECTED', category: 'conflict' }
    }
    if (review.state === 'reviewed' || review.state === 'edited') {
      const resolvedCat =
        defaultCategory === 'conflict'
          ? categorizeEvidenceLabel(fieldKey, 'ACCEPTED')
          : defaultCategory
      return {
        decision: 'ACCEPTED',
        category: resolvedCat,
        reason:
          review.state === 'edited'
            ? 'Corregido en revisión humana'
            : 'Validado en revisión humana',
        resolved: true,
      }
    }
    return { decision: defaultDecision, category: defaultCategory, reason: defaultReason }
  }

  // 1. Priorizar evidencias y posiciones originales proporcionadas por NLP cuando estén disponibles.
  for (const cand of candidatos) {
    if (!cand || typeof cand !== 'object') continue
    const start = cand.start
    const end = cand.end
    const rawDecision =
      cand.decision === 'UNRESOLVED' || cand.decision === 'REJECTED' ? cand.decision : 'ACCEPTED'
    // Solo destacar conflictos/errores respaldados por evidencia real
    if (rawDecision === 'REJECTED' && !cand.reason) continue
    if (
      typeof start === 'number' &&
      typeof end === 'number' &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      end <= chars.length &&
      (!cand.text || chars.slice(start, end).join('') === cand.text) &&
      !overlaps(start, end)
    ) {
      const baseCategory = categorizeEvidenceLabel(cand.label, rawDecision)
      const outcome = resolveHumanOutcome(
        cand.label?.toLowerCase() ?? null,
        baseCategory,
        rawDecision,
        cand.reason ?? null,
      )
      if (outcome.skip) continue
      ranges.push({
        start,
        end,
        decision: outcome.decision,
        category: outcome.category,
        fieldLabel: humanizeFieldLabel(cand.label),
        reason: outcome.reason,
        candidateId: cand.candidate_id,
        resolved: outcome.resolved,
      })
    }
  }

  const claimExact = (
    rawTerm: string,
    category: EvidenceCategory,
    fieldLabel: string,
    decision: VoiceEvidence['decision'] = 'ACCEPTED',
    reason?: string | null,
    contextHints?: RegExp,
    onlyFirst = false,
  ): boolean => {
    const term = rawTerm.trim()
    if (!term) return false
    if (term.length < 2 && !/^\d+$/.test(term)) return false
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, 'giu')
    const matches: Array<{ start: number; end: number; score: number }> = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(transcript)) !== null) {
      const start = toCodePointOffset(transcript, match.index)
      const end = toCodePointOffset(transcript, match.index + match[0].length)
      if (overlaps(start, end)) continue
      const windowStart = Math.max(0, match.index - 28)
      const windowEnd = Math.min(transcript.length, match.index + match[0].length + 28)
      const windowText = transcript.slice(windowStart, windowEnd)
      const score = contextHints ? (contextHints.test(windowText) ? 2 : 0) : 1
      matches.push({ start, end, score })
    }
    if (!matches.length) return false
    if (contextHints) {
      const contextual = matches.filter((m) => m.score > 0)
      if (contextual.length) {
        const chosen = onlyFirst ? [contextual[0]!] : contextual
        for (const m of chosen) {
          if (!overlaps(m.start, m.end)) {
            ranges.push({ start: m.start, end: m.end, decision, category, fieldLabel, reason })
          }
        }
        return true
      }
      // Si es un número ambiguo sin contexto coincidente cuando hay múltiples ocurrencias, evitar falso positivo.
      if (/^\d+([.,]\d+)?$/.test(term) && matches.length > 1) return false
    }
    const chosen = onlyFirst || /^\d+([.,]\d+)?$/.test(term) ? [matches[0]!] : matches
    for (const m of chosen) {
      if (!overlaps(m.start, m.end)) {
        ranges.push({ start: m.start, end: m.end, decision, category, fieldLabel, reason })
      }
    }
    return true
  }

  const claimNumericWithContext = (
    rawVal: unknown,
    rawUnit: string,
    category: EvidenceCategory,
    fieldLabel: string,
    contextHints: RegExp,
    decision: VoiceEvidence['decision'] = 'ACCEPTED',
    reason?: string | null,
  ) => {
    if (rawVal == null || !String(rawVal).trim()) return
    const numVariants = numberVariants(String(rawVal))
    const units = unitVariants(rawUnit)
    for (const num of numVariants) {
      for (const unit of units) {
        if (claimExact(`${num} ${unit}`, category, fieldLabel, decision, reason, undefined, true)) {
          return
        }
        if (claimExact(`${num}${unit}`, category, fieldLabel, decision, reason, undefined, true)) {
          return
        }
      }
    }
    for (const num of numVariants) {
      if (claimExact(num, category, fieldLabel, decision, reason, contextHints, true)) {
        return
      }
    }
  }

  // 2. Pendientes / conflictos con actualización según revisión humana
  for (const p of pendientes) {
    const val = p.resolucion?.valor?.trim()
    if (!val) continue
    const fieldKey = mapPendingKeyToField(p)
    const outcome = resolveHumanOutcome(fieldKey, 'conflict', 'UNRESOLVED', p.mensaje)
    if (outcome.skip) continue
    claimExact(
      val,
      outcome.category,
      p.resolucion?.clave ? humanizeFieldLabel(p.resolucion.clave) : 'Requiere revisión',
      outcome.decision,
      outcome.reason,
      undefined,
      true,
    )
  }

  // 3. Campos comerciales (respaldo contextual cuando NLP no dio posiciones exactas)
  if (proposal?.comercial) {
    const c = proposal.comercial
    if (c.nombre) claimExact(String(c.nombre), 'commercial', 'Nombre comercial')
    if (c.cantidad != null) {
      claimNumericWithContext(
        c.cantidad,
        c.unidad_codigo ?? '',
        'commercial',
        'Cantidad',
        /\b(cantidad|unidades?|uds?|piezas?|pzas?|cajas?|muebles?|escritorios?|sillas?|mesas?|estantes?)\b/i,
      )
    }
    if (c.precio_unitario != null) {
      claimNumericWithContext(
        c.precio_unitario,
        'bs',
        'commercial',
        'Precio unitario',
        /\b(precio|costo|cuesta|vale|bs|bolivianos?|usd|d[oó]lares?|c\/u|cada\s+uno|total)\b/i,
      )
    }
    if (c.descuento != null && Number(c.descuento) > 0) {
      claimNumericWithContext(
        c.descuento,
        '%',
        'commercial',
        'Descuento',
        /\b(descuento|rebaja|%|por\s*ciento)\b/i,
      )
    }
  }

  // 4. Dimensiones y datos técnicos
  const tech = (proposal?.especificacion?.datos_tecnicos ?? {}) as Record<string, unknown>
  const general = tech.caracteristicas_generales as
    | {
        dimensiones?: Record<string, { valor?: unknown; unidad?: string } | unknown>
        atributos?:
          Array<{ nombre?: string; valor?: unknown; unidad?: string }> | Record<string, unknown>
      }
    | undefined

  for (const [key, entry] of Object.entries(general?.dimensiones ?? {})) {
    const val =
      entry && typeof entry === 'object' && 'valor' in entry
        ? (entry as { valor: unknown }).valor
        : entry
    const unit =
      entry && typeof entry === 'object' && 'unidad' in entry
        ? String((entry as { unidad?: string }).unidad ?? '')
        : ''
    claimNumericWithContext(
      val,
      unit,
      'dimensions',
      `Dimensión: ${key}`,
      new RegExp(
        `\\b(${escapeRegex(key)}|mm|cm|m|metros?|cent[ií]metros?|mil[ií]metros?|de\\s+largo|de\\s+ancho|de\\s+alto|profundidad)\\b`,
        'i',
      ),
    )
  }

  if (Array.isArray(general?.atributos)) {
    for (const attr of general.atributos) {
      if (attr && typeof attr === 'object' && attr.valor != null && String(attr.valor).trim()) {
        claimExact(String(attr.valor), 'structure', attr.nombre || 'Característica')
      }
    }
  } else if (general?.atributos && typeof general.atributos === 'object') {
    for (const [key, entry] of Object.entries(general.atributos)) {
      const val =
        entry && typeof entry === 'object' && 'valor' in entry
          ? (entry as { valor: unknown }).valor
          : entry
      if (val != null && String(val).trim()) {
        claimExact(String(val), 'structure', `Atributo: ${key}`)
      }
    }
  }

  if (Array.isArray(tech.componentes)) {
    for (const comp of tech.componentes) {
      if (!comp || typeof comp !== 'object') continue
      const c = comp as Record<string, unknown>
      if (c.nombre) claimExact(String(c.nombre), 'structure', `Componente: ${c.nombre}`)
      if (c.material) claimExact(String(c.material), 'structure', 'Material')
      if (c.color) claimExact(String(c.color), 'structure', 'Color')
      if (c.acabado) claimExact(String(c.acabado), 'structure', 'Acabado')
      if (c.espesor != null) {
        claimNumericWithContext(
          c.espesor,
          'mm',
          'structure',
          'Espesor',
          /\b(espesor|grosor|mm|mil[ií]metros?|melamina|mdf|tablero)\b/i,
        )
      }
      if (c.cantidad_interna != null) {
        claimNumericWithContext(
          c.cantidad_interna,
          'und',
          'structure',
          'Cantidad de componente',
          /\b(puertas?|cajones?|repisas?|estantes?|patas?|piezas?|divisiones?)\b/i,
        )
      }
    }
  }

  if (Array.isArray(tech.accesorios)) {
    for (const acc of tech.accesorios) {
      if (typeof acc === 'string' && acc.trim()) {
        claimExact(acc.trim(), 'structure', 'Accesorio')
      }
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
      ...(r.candidateId ? { candidateId: r.candidateId } : {}),
      ...(r.resolved ? { resolved: true } : {}),
    }))
}
