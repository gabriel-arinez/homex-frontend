export type VoiceEvidence = {
  label?: string
  start: number
  end: number
  text: string
  decision: 'ACCEPTED' | 'UNRESOLVED' | 'REJECTED'
  reason?: string | null
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
    }
  })
}
