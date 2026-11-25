import { CheckCircle2, ClipboardList, Clock3, Hammer, PackageCheck } from '@lucide/vue'

export type WorkOrderTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

export function workOrderTone(code: string): WorkOrderTone {
  const normalized = code.toUpperCase()
  if (normalized.includes('CANCEL') || normalized.includes('ANUL')) return 'danger'
  if (
    normalized.includes('TERMINAD') ||
    normalized.includes('ENTREGAD') ||
    normalized.includes('FINALIZAD') ||
    normalized.includes('LISTO')
  ) {
    return 'success'
  }
  if (
    normalized.includes('PROCESO') ||
    normalized.includes('PRODUCCION') ||
    normalized.includes('TALLER')
  ) {
    return 'warning'
  }
  if (normalized.includes('PENDIENTE')) return 'info'
  return 'neutral'
}

export function workOrderStatusIcon(code: string) {
  const normalized = code.toUpperCase()
  if (normalized.includes('PENDIENTE')) return Clock3
  if (
    normalized.includes('PRODUCCION') ||
    normalized.includes('TALLER') ||
    normalized.includes('PROCESO')
  ) {
    return Hammer
  }
  if (
    normalized.includes('LISTO') ||
    normalized.includes('TERMINAD') ||
    normalized.includes('FINALIZAD')
  ) {
    return PackageCheck
  }
  if (normalized.includes('ENTREGAD') || normalized.includes('COMPLETAD')) return CheckCircle2
  return ClipboardList
}
