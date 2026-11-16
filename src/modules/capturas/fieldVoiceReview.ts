import type { ObjectDirective } from 'vue'
export type FieldVoiceReview = {
  field: string
  state: 'suggested' | 'pending' | 'reviewed' | 'edited'
  reason: string
  critical: boolean
}
type Binding = { fields: FieldVoiceReview[]; resolve: (field: string, edited: boolean) => void }
const cleanup = new WeakMap<HTMLElement, () => void>()
function render(root: HTMLElement, value: Binding) {
  cleanup.get(root)?.()
  const elements: HTMLElement[] = []
  const marked: HTMLElement[] = []
  for (const review of value.fields) {
    const input = Array.from(
      root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        '[name], [id]',
      ),
    ).find((el) => el.name === review.field || el.id === review.field)
    if (!input) continue
    input.dataset.voiceState = review.state
    input.style.outline =
      review.state === 'pending'
        ? '2px dashed var(--color-warning, #947000)'
        : review.state === 'suggested'
          ? '1px solid var(--color-primary)'
          : ''
    input.style.outlineOffset = '2px'
    marked.push(input)
    const note = document.createElement('span')
    note.className = 'voice-field-status'
    note.id = `voice-status-${review.field}`
    note.style.cssText = 'display:block;font-size:.8rem;font-weight:400;margin-top:.35rem;'
    const label = {
      suggested: 'Sugerido por voz',
      pending: 'Requiere revisión',
      reviewed: 'Confirmado',
      edited: 'Modificado',
    }[review.state]
    const text = document.createElement('span')
    text.textContent =
      label +
      (review.reason && ['pending', 'suggested'].includes(review.state) ? ': ' + review.reason : '')
    note.append(text)
    if (['suggested', 'pending'].includes(review.state)) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = 'Confirmar campo'
      button.style.cssText =
        'margin-inline-start:.5rem;padding:.2rem .5rem;border:1px solid var(--color-border-strong);border-radius:var(--radius-control);background:var(--color-surface);color:var(--color-text);font:inherit;cursor:pointer;'
      button.addEventListener('click', () => {
        if (input.value.trim()) value.resolve(review.field, false)
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
    if (field && target.value?.trim() && value.fields.some((f) => f.field === field))
      value.resolve(field, true)
  }
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
  },
}
