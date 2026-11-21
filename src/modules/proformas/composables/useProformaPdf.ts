import { usePdfDocument } from '@/shared/pdf/usePdfDocument'
import { proformasService } from '../services/proformasService'

/** Un mismo Blob PDF para visualizar, descargar e imprimir la versión guardada. */
export function useProformaPdf() {
  return usePdfDocument((id) => proformasService.documentPdf(id))
}
