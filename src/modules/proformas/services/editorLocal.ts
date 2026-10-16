/** El editor solo guarda datos JSON; JSON.stringify desenvuelve proxies reactivos de Vue. */
export function cloneEditorData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export type LocalIdentity = { id?: number; localId: string }
export function duplicateLocalLine<T extends LocalIdentity>(line: T, localId: string): T {
  const copy = cloneEditorData(line)
  delete copy.id
  copy.localId = localId
  return copy
}
export function removeLocalLine<T>(lines: T[], index: number) {
  const next = [...lines]
  const [line] = next.splice(index, 1)
  return {
    lines: next,
    removed: line === undefined ? null : { line: cloneEditorData(line), index },
  }
}
export function restoreLocalLine<T>(lines: T[], removed: { line: T; index: number }) {
  const next = [...lines]
  next.splice(removed.index, 0, cloneEditorData(removed.line))
  return next
}
export function saveEditorDraft(token: string, value: unknown) {
  sessionStorage.setItem(`homex:ap5:draft:${token}`, JSON.stringify(value))
}
export function consumeEditorDraft<T>(token: string): T | null {
  const key = `homex:ap5:draft:${token}`
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  sessionStorage.removeItem(key)
  return JSON.parse(raw) as T
}
