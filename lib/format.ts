const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

export function euros(valor: number): string {
  return eur.format(valor)
}

/** Convierte "4,50" o "4.5" a número. Devuelve null si no es un importe válido. */
export function parseImporte(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  return Number(limpio)
}

/** Redondea a céntimos evitando errores de coma flotante */
export function centimos(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** "hace 5 min", "hace 1 h 20 min" */
export function haceCuanto(fechaIso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.floor((ahora - new Date(fechaIso).getTime()) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto ? `${h} h ${resto} min` : `${h} h`
}

const fechaHora = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function fechaCorta(fechaIso: string): string {
  return fechaHora.format(new Date(fechaIso))
}

/** Billetes habituales para cobrar en efectivo: exacto y los siguientes redondeos útiles */
export function sugerenciasEfectivo(total: number): number[] {
  const opciones = new Set<number>([centimos(total)])
  for (const paso of [1, 5, 10, 20, 50, 100]) {
    const v = Math.ceil(total / paso) * paso
    if (v > total) opciones.add(v)
  }
  return [...opciones].sort((a, b) => a - b).slice(0, 5)
}

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 })

/** "1,5 kg", "250 g", "12 ud", "1,2 l" */
export function cantidadStock(valor: number, unidad: 'ud' | 'g' | 'ml'): string {
  const abs = Math.abs(valor)
  if (unidad === 'g' && abs >= 1000) return `${numero.format(valor / 1000)} kg`
  if (unidad === 'ml' && abs >= 1000) return `${numero.format(valor / 1000)} l`
  return `${numero.format(valor)} ${unidad}`
}

/** Convierte "1,5" o "2" en número (admite hasta 3 decimales). null si no es válido. */
export function parseCantidad(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,3})?$/.test(limpio)) return null
  return Number(limpio)
}

/** Cantidad sugerida para pedir: reponer hasta el doble del mínimo */
export function cantidadSugerida(stock: number, minimo: number): number {
  const objetivo = Math.max(minimo * 2, minimo + 1)
  return Math.max(Math.ceil(objetivo - stock), 1)
}
