import type { ObjectDirective } from 'vue'
export type FieldVoiceReview = {
  field: string
  state: 'suggested' | 'pending' | 'reviewed' | 'edited' | 'discarded'
  reason: string
  critical: boolean
  confirmable?: boolean
}
type Binding = { fields: FieldVoiceReview[]; resolve: (field: string, edited: boolean) => void }
type VoiceControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
const cleanup = new WeakMap<HTMLElement, () => void>()
const rendered = new WeakMap<
  HTMLElement,
  {
    signature: string
    resolve: Binding['resolve']
    controls: Array<VoiceControl | undefined>
    notes: HTMLElement[]
  }
>()
function render(root: HTMLElement, value: Binding) {
  const candidates = Array.from(
    root.querySelectorAll<VoiceControl>(
      'input[name], input[id], select[name], select[id], textarea[name], textarea[id], button[name], button[id], [role="button"][id]',
    ),
  )
  const controls = value.fields.map((review) =>
    candidates.find((el) => el.name === review.field || el.id === review.field),
  )
  const signature = JSON.stringify(value.fields)
  const previous = rendered.get(root)
  // A blur/change update can run between pointerdown and click. Replacing equivalent
  // review buttons there swallows the native click and loses keyboard focus.
  if (
    previous?.signature === signature &&
    previous.resolve === value.resolve &&
    previous.controls.length === controls.length &&
    controls.every((control, index) => control === previous.controls[index]) &&
    previous.notes.every((note) => root.contains(note))
  )
    return
  cleanup.get(root)?.()
  const elements: HTMLElement[] = []
  const marked: HTMLElement[] = []
  for (const [index, review] of value.fields.entries()) {
    const input = controls[index]
    if (!input) continue
    input.dataset.voiceState = review.state
    input.style.outline =
      review.state === 'pending'
        ? '2px dashed var(--color-warning, #947000)'
        : ['suggested', 'reviewed', 'edited'].includes(review.state)
          ? '2px solid var(--color-success, #16a34a)'
          : ''
    input.style.outlineOffset = '2px'
    marked.push(input)
    const note = document.createElement('span')
    note.className = 'voice-field-status'
    note.id = `voice-status-${review.field}`
    const toneColor =
      review.state === 'pending'
        ? 'var(--color-warning, #b45309)'
        : ['suggested', 'reviewed', 'edited'].includes(review.state)
          ? 'var(--color-success, #16a34a)'
          : 'var(--color-text-secondary)'
    note.style.cssText = `display:inline-flex;align-items:center;flex-wrap:wrap;gap:.45rem;font-size:.78rem;font-weight:600;margin-top:.35rem;color:${toneColor};`
    const label = {
      suggested: '✓ Completado por voz',
      pending: 'Requiere revisión',
      reviewed: '✓ Validado',
      edited: '✓ Corregido',
      discarded: 'Descartado',
    }[review.state]
    const text = document.createElement('span')
    text.textContent =
      label +
      (review.reason && ['pending', 'suggested'].includes(review.state) ? ': ' + review.reason : '')
    note.append(text)
    if (
      input.matches('input,select,textarea') &&
      review.confirmable !== false &&
      review.state === 'pending'
    ) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = 'Validar valor'
      button.style.cssText =
        'padding:.2rem .55rem;border:1px solid var(--color-warning, #d97706);border-radius:999px;background:var(--color-warning-soft, rgba(234,179,8,0.12));color:var(--color-text);font:inherit;font-size:.75rem;font-weight:650;cursor:pointer;'
      button.addEventListener('click', () => {
        if (input.value.trim() && input.checkValidity()) value.resolve(review.field, false)
        else input.focus()
      })
      note.append(button)
    }
    const described = input.getAttribute('aria-describedby') ?? ''
    input.setAttribute('aria-describedby', [described, note.id].filter(Boolean).join(' '))
    // Keep review controls outside the label: descriptions must not change its accessible name.
    const anchor = input.closest('label') ?? input
    anchor.insertAdjacentElement('afterend', note)
    elements.push(note)
  }
  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement
    const field = target.name || target.id
    if (field && value.fields.some((f) => f.field === field)) value.resolve(field, true)
  }
  rendered.set(root, { signature, resolve: value.resolve, controls, notes: elements })
  root.addEventListener('input', onInput)
  root.addEventListener('change', onInput)
  cleanup.set(root, () => {
    root.removeEventListener('input', onInput)
    root.removeEventListener('change', onInput)
    elements.forEach((el) => el.remove())
    marked.forEach((el) => {
      const ids = (el.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter((id) => !id.startsWith('voice-status-'))
        .join(' ')
      if (ids) el.setAttribute('aria-describedby', ids)
      else el.removeAttribute('aria-describedby')
      delete el.dataset.voiceState
      el.style.outline = ''
      el.style.outlineOffset = ''
    })
  })
}
export const vVoiceFields: ObjectDirective<HTMLElement, Binding> = {
  mounted: (el, binding) => render(el, binding.value),
  updated: (el, binding) => render(el, binding.value),
  beforeUnmount: (el) => {
    cleanup.get(el)?.()
    cleanup.delete(el)
    rendered.delete(el)
  },
}

export type VoiceFieldReview = {
  review_id: string
  code: string
  severity: 'INFO' | 'REVIEW' | 'CRITICAL'
  message: string
  field: string
  evidence_ids: string[]
}
export type HumanVoiceDecision = {
  decision_id: string
  review_id: string
  field: string
  evidence_ids: string[]
  estado: 'confirmado' | 'corregido' | 'descartado'
  valor_original: unknown
  valor_final: unknown
  motivo?: string
}
/** Canonical payloads survive JSONB key ordering and browser reloads. */
function auditKey(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  )
}
function fingerprint(key: string): string {
  let hash = 2166136261
  let second = 5381
  for (const char of key) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    second = Math.imul(second, 33) ^ char.charCodeAt(0)
  }
  return `${(hash >>> 0).toString(16)}-${(second >>> 0).toString(16)}`
}
/** Payload identity is stable; appendVoiceAudit adds the preceding transition identity. */
export function humanVoiceDecision(
  captureId: number,
  value: Omit<HumanVoiceDecision, 'decision_id'>,
): HumanVoiceDecision {
  return { decision_id: `voice-${captureId}-${fingerprint(auditKey(value))}`, ...value }
}
function decisionPayload(decision: HumanVoiceDecision): string {
  const { decision_id: _id, ...payload } = decision
  return auditKey(payload)
}
export function appendVoiceAudit(history: unknown, snapshot: Record<string, unknown>): unknown[] {
  const previous = Array.isArray(history) ? [...history] : history === undefined ? [] : [history]
  if (Array.isArray(snapshot.decisiones)) {
    const latest = new Map<string, HumanVoiceDecision>()
    const key = (decision: HumanVoiceDecision) => auditKey([decision.review_id, decision.field])
    for (const entry of previous) {
      if (!entry || typeof entry !== 'object') continue
      const stored = entry as { captura_asistida_id?: unknown; decisiones?: HumanVoiceDecision[] }
      if (stored.captura_asistida_id !== snapshot.captura_asistida_id) continue
      for (const decision of Array.isArray(stored.decisiones) ? stored.decisiones : [])
        latest.set(key(decision), decision)
    }
    const fresh: HumanVoiceDecision[] = []
    for (const decision of snapshot.decisiones as HumanVoiceDecision[]) {
      const preceding = latest.get(key(decision))
      if (preceding && decisionPayload(preceding) === decisionPayload(decision)) continue
      // B→C→B is a new transition, unlike an unchanged B→B save/retry.
      const transition = preceding
        ? {
            ...decision,
            decision_id: `${decision.decision_id}-${fingerprint(preceding.decision_id)}`,
          }
        : decision
      fresh.push(transition)
      latest.set(key(decision), transition)
    }
    if (!fresh.length) return previous
    snapshot = { ...snapshot, decisiones: fresh }
  }
  if (!previous.some((entry) => auditKey(entry) === auditKey(snapshot))) previous.push(snapshot)
  return previous
}
