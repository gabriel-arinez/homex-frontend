import type { Component } from 'vue'
import { Banknote, CreditCard, FileCheck2, Landmark, QrCode, Wallet } from '@lucide/vue'

const ICON_BY_CODE: Record<string, Component> = {
  EFECTIVO: Banknote,
  CHEQUE: FileCheck2,
  QR: QrCode,
  DEPOSITO: Landmark,
  TARJETA: CreditCard,
}

export function tipoPagoIcon(codigo?: string | null, nombre?: string | null): Component {
  const key = (codigo ?? '').trim().toUpperCase()
  if (key && ICON_BY_CODE[key]) return ICON_BY_CODE[key]

  const label = (nombre ?? '').trim().toLowerCase()
  if (label.includes('efectivo')) return Banknote
  if (label.includes('cheque')) return FileCheck2
  if (label.includes('qr')) return QrCode
  if (label.includes('depósito') || label.includes('deposito')) return Landmark
  if (label.includes('tarjeta')) return CreditCard

  return Wallet
}
