const TIME_ZONE = 'America/La_Paz'
const LOCALE = 'es-BO'
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface PresentacionCreacion {
  principal: string
  hora: string | null
  fecha: string
  mostrarFechaSeparada: boolean
  reciente: boolean
  historica: boolean
}

function componentesFecha(date: Date) {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('day')} de ${get('month').replace(/\.$/, '')} de ${get('year')}`
}

function horaBolivia(date: Date) {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00'
  const h = Number(get('hour'))
  return `${String(h % 12 || 12).padStart(2, '0')}:${get('minute')} ${h >= 12 ? 'p. m.' : 'a. m.'}`
}

function fechaComercial(fecha: string) {
  // Una fecha sin hora no se debe interpretar como instante de creación.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Fecha no disponible'
  const date = new Date(`${fecha}T12:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fecha
    ? 'Fecha no disponible'
    : componentesFecha(date)
}

/**
 * La hora se muestra SOLO cuando el backend entrega un instante con zona
 * explícita. Los registros históricos sin marca temporal muestran fecha,
 * pero nunca una hora ni una antigüedad inventada.
 */
export function presentarCreacion(
  creadoEn: string | null | undefined,
  fecha: string,
  ahora: number = Date.now(),
): PresentacionCreacion {
  const valida =
    typeof creadoEn === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(creadoEn)
  const instante = valida ? new Date(creadoEn) : null
  if (!instante || Number.isNaN(instante.getTime())) {
    const texto = fechaComercial(fecha)
    return {
      principal: texto,
      hora: null,
      fecha: texto,
      mostrarFechaSeparada: false,
      reciente: false,
      historica: true,
    }
  }

  const fechaExacta = componentesFecha(instante)
  const ms = ahora - instante.getTime()
  // No convertir futuros relojes desincronizados en «Hace un momento».
  if (!Number.isFinite(ms) || ms < -MINUTE) {
    return {
      principal: fechaExacta,
      hora: horaBolivia(instante),
      fecha: fechaExacta,
      mostrarFechaSeparada: false,
      reciente: false,
      historica: false,
    }
  }
  const diferencia = Math.max(0, ms)
  let principal = fechaExacta
  if (diferencia < MINUTE) principal = 'Hace un momento'
  else if (diferencia < HOUR) {
    const m = Math.floor(diferencia / MINUTE)
    principal = `Hace ${m} minuto${m === 1 ? '' : 's'}`
  } else if (diferencia < DAY) {
    const h = Math.floor(diferencia / HOUR)
    principal = `Hace ${h} hora${h === 1 ? '' : 's'}`
  } else if (diferencia < 7 * DAY) {
    const dias = Math.floor(diferencia / DAY)
    principal = `Hace ${dias} día${dias === 1 ? '' : 's'}`
  }

  return {
    principal,
    hora: horaBolivia(instante),
    fecha: fechaExacta,
    mostrarFechaSeparada: principal !== fechaExacta,
    reciente: diferencia < HOUR,
    historica: false,
  }
}
