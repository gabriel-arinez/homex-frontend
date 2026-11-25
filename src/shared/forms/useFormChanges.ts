import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'

export interface FormFieldChange {
  key: string
  label: string
  before: string
  after: string
}

export interface FieldComparator<T> {
  key: string
  label: string
  get: (state: T) => unknown
  format?: (value: unknown, state: T) => string
}

function canonicalValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Sin valor'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  const text = typeof value === 'string' ? value.trim() : canonicalValue(value)
  if (!text) return 'Sin valor'
  return text.length > 72 ? `${text.slice(0, 69)}…` : text
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function diffFormFields<T>(
  original: T,
  current: T,
  descriptors: FieldComparator<T>[],
): FormFieldChange[] {
  const result: FormFieldChange[] = []
  for (const descriptor of descriptors) {
    const rawBefore = descriptor.get(original)
    const rawAfter = descriptor.get(current)
    if (canonicalValue(rawBefore) === canonicalValue(rawAfter)) continue
    result.push({
      key: descriptor.key,
      label: descriptor.label,
      before: descriptor.format
        ? descriptor.format(rawBefore, original)
        : formatChangeValue(rawBefore),
      after: descriptor.format ? descriptor.format(rawAfter, current) : formatChangeValue(rawAfter),
    })
  }
  return result
}

export function useFormChanges<T>(
  getCurrentState: () => T,
  descriptors: MaybeRefOrGetter<FieldComparator<T>[]>,
): {
  captureOriginal: (state?: T) => void
  reset: () => void
  changes: ComputedRef<FormFieldChange[]>
  hasChanges: ComputedRef<boolean>
} {
  const originalSnapshot = ref<T | null>(null)

  function captureOriginal(state?: T) {
    originalSnapshot.value = cloneSnapshot(state ?? getCurrentState())
  }

  function reset() {
    originalSnapshot.value = null
  }

  const changes = computed<FormFieldChange[]>(() => {
    if (originalSnapshot.value === null) return []
    return diffFormFields(originalSnapshot.value as T, getCurrentState(), toValue(descriptors))
  })

  const hasChanges = computed(() => changes.value.length > 0)

  return {
    captureOriginal,
    reset,
    changes,
    hasChanges,
  }
}
