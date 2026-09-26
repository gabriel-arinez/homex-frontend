/** Convierte un offset Python (puntos de código Unicode) al índice UTF-16 usado por el DOM. */
export function pythonOffsetToUtf16(text: string, offset: number) {
  return Array.from(text).slice(0, Math.max(0, offset)).join('').length
}
export function pythonSpanToUtf16(text: string, start: number, end: number) {
  return { start: pythonOffsetToUtf16(text, start), end: pythonOffsetToUtf16(text, end) }
}
