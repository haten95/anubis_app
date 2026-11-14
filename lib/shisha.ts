/**
 * Lógica pura del montaje de una shisha: reparto de porcentajes entre sabores
 * y geometría de la cazoleta (sectores y divisiones arrastrables).
 */

export const PASO = 5
export const MAX_SABORES = 4

export interface Porcion {
  saborId: number
  porcentaje: number
}

export function suma(porciones: Porcion[]): number {
  return porciones.reduce((t, p) => t + p.porcentaje, 0)
}

/** Reparto a partes iguales en múltiplos de 5 que suma exactamente 100 (p. ej. 35/35/30) */
export function repartoIgual(n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(100 / n / PASO) * PASO
  const valores = Array.from({ length: n }, () => base)
  let resto = 100 - base * n
  for (let i = 0; resto > 0; i = (i + 1) % n) {
    valores[i] += PASO
    resto -= PASO
  }
  return valores
}

/** Límite superior que puede tomar la porción i sin pasar del 100 % */
export function maximoPara(porciones: Porcion[], i: number): number {
  return 100 - (suma(porciones) - porciones[i].porcentaje)
}

/** Cambia el % de una porción respetando el mínimo (5) y el máximo disponible */
export function fijarPorcentaje(porciones: Porcion[], i: number, valor: number): Porcion[] {
  const max = maximoPara(porciones, i)
  const v = Math.min(Math.max(redondear(valor), PASO), max)
  return porciones.map((p, k) => (k === i ? { ...p, porcentaje: v } : p))
}

function redondear(v: number) {
  return Math.round(v / PASO) * PASO
}

/** Límites acumulados: [0, p1, p1+p2, …] */
export function limites(porciones: Porcion[]): number[] {
  const res = [0]
  for (const p of porciones) res.push(res[res.length - 1] + p.porcentaje)
  return res
}

/**
 * Mueve la división número `d` (1..n) a la posición `pos` (0-100, sentido horario desde arriba).
 * La división d separa la porción d-1 de la d. La última (d = n) es el final del último sabor
 * y solo se puede mover si aún no se ha llegado al 100 %.
 */
export function moverDivision(porciones: Porcion[], d: number, pos: number): Porcion[] {
  const n = porciones.length
  if (d < 1 || d > n) return porciones
  const lim = limites(porciones)
  const p = redondear(pos)

  if (d === n) {
    // Final del último sabor: cambia solo su tamaño
    const nuevo = Math.min(Math.max(p, lim[n - 1] + PASO), 100)
    return porciones.map((x, k) => (k === n - 1 ? { ...x, porcentaje: nuevo - lim[n - 1] } : x))
  }

  // División interior: lo que gana un sabor lo pierde el siguiente
  const nuevo = Math.min(Math.max(p, lim[d - 1] + PASO), lim[d + 1] - PASO)
  return porciones.map((x, k) => {
    if (k === d - 1) return { ...x, porcentaje: nuevo - lim[d - 1] }
    if (k === d) return { ...x, porcentaje: lim[d + 1] - nuevo }
    return x
  })
}

/** Divisiones que se pueden arrastrar */
export function divisionesMovibles(porciones: Porcion[]): number[] {
  const n = porciones.length
  const res: number[] = []
  for (let d = 1; d < n; d++) res.push(d)
  if (n > 0 && suma(porciones) < 100) res.push(n)
  return res
}

/** Convierte un punto (relativo al centro) en posición 0-100 en sentido horario desde las 12 */
export function posicionDesdePunto(dx: number, dy: number): number {
  const ang = Math.atan2(dx, -dy) // 0 arriba, positivo en sentido horario
  const vuelta = ang < 0 ? ang + Math.PI * 2 : ang
  return (vuelta / (Math.PI * 2)) * 100
}

/** Punto en la circunferencia para una posición 0-100 */
export function punto(cx: number, cy: number, r: number, pos: number): [number, number] {
  const ang = (pos / 100) * Math.PI * 2
  return [cx + Math.sin(ang) * r, cy - Math.cos(ang) * r]
}

/** Trazado SVG de un sector de corona circular entre dos posiciones (0-100) */
export function trazoSector(cx: number, cy: number, rIn: number, rOut: number, desde: number, hasta: number): string {
  const ancho = hasta - desde
  if (ancho <= 0) return ''
  if (ancho >= 100) {
    // Anillo completo: dos medias coronas
    return trazoSector(cx, cy, rIn, rOut, 0, 50) + ' ' + trazoSector(cx, cy, rIn, rOut, 50, 100)
  }
  const grande = ancho > 50 ? 1 : 0
  const [x1, y1] = punto(cx, cy, rOut, desde)
  const [x2, y2] = punto(cx, cy, rOut, hasta)
  const [x3, y3] = punto(cx, cy, rIn, hasta)
  const [x4, y4] = punto(cx, cy, rIn, desde)
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${grande} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ')
}
