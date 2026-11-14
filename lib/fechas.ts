/**
 * Fechas "de calendario" como texto YYYY-MM-DD (sin zonas horarias),
 * que es como se guardan los turnos y las tareas.
 */

export function isoDia(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

export function deIso(iso: string): Date {
  // Admite "2026-11-08" y también "2026-11-08T00:00:00" (se ignora la hora)
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function hoyIso(): string {
  return isoDia(new Date())
}

export function sumarDias(iso: string, n: number): string {
  const d = deIso(iso)
  d.setDate(d.getDate() + n)
  return isoDia(d)
}

/** Lunes de la semana de una fecha */
export function lunesDe(iso: string): string {
  const d = deIso(iso)
  const dow = (d.getDay() + 6) % 7 // 0 = lunes
  return sumarDias(iso, -dow)
}

export function diasSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreDia(iso: string, corto = false): string {
  const n = DIAS[deIso(iso).getDay()]
  return corto ? n.slice(0, 3) : n
}

/** "lun 17 nov" o "Lunes 17 de noviembre" */
export function fechaLarga(iso: string, corta = false): string {
  const d = deIso(iso)
  if (corta) return `${nombreDia(iso, true).toLowerCase()} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`
  return `${nombreDia(iso)} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

export function nombreMes(iso: string): string {
  const d = deIso(iso)
  const m = MESES[d.getMonth()]
  return `${m[0].toUpperCase()}${m.slice(1)} ${d.getFullYear()}`
}

export function primerDiaMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function sumarMeses(iso: string, n: number): string {
  const d = deIso(primerDiaMes(iso))
  d.setMonth(d.getMonth() + n)
  return isoDia(d)
}

/** "18:00:00" → minutos desde medianoche */
function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Duración de un turno en horas; si acaba antes de empezar, cruza la medianoche */
export function horasTurno(inicio: string, fin: string): number {
  let dif = minutos(fin) - minutos(inicio)
  if (dif <= 0) dif += 24 * 60
  return Math.round((dif / 60) * 100) / 100
}

/** "18:00:00" → "18:00" */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5)
}

/** Horas entre dos instantes (fichajes), con la salida abierta contando hasta ahora */
export function horasEntre(entrada: string, salida: string | null, ahora = Date.now()): number {
  const fin = salida ? new Date(salida).getTime() : ahora
  return Math.max(0, Math.round(((fin - new Date(entrada).getTime()) / 3_600_000) * 100) / 100)
}

/** 7.5 → "7 h 30 min" */
export function formatoHoras(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  if (hh === 0) return `${mm} min`
  return mm ? `${hh} h ${mm} min` : `${hh} h`
}

const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
export function horaDe(instante: string): string {
  return hora.format(new Date(instante))
}

/** Valor para <input type="datetime-local"> desde un instante ISO, en hora local */
export function aInputLocal(instante: string): string {
  const d = new Date(instante)
  return `${isoDia(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
