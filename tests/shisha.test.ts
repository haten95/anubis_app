import { describe, expect, it } from 'vitest'
import {
  divisionesMovibles,
  fijarPorcentaje,
  moverDivision,
  posicionDesdePunto,
  repartoIgual,
  suma,
  type Porcion,
} from '../lib/shisha'
import { sugerenciasEfectivo } from '../lib/format'

const p = (...v: number[]): Porcion[] => v.map((porcentaje, i) => ({ saborId: i + 1, porcentaje }))

describe('repartoIgual', () => {
  it('reparte en múltiplos de 5 y suma 100', () => {
    expect(repartoIgual(1)).toEqual([100])
    expect(repartoIgual(2)).toEqual([50, 50])
    expect(repartoIgual(3)).toEqual([35, 35, 30])
    expect(repartoIgual(4)).toEqual([25, 25, 25, 25])
  })
})

describe('fijarPorcentaje', () => {
  it('no deja pasar del 100 % ni bajar del 5 %', () => {
    expect(suma(fijarPorcentaje(p(50, 30), 1, 90))).toBe(100)
    expect(fijarPorcentaje(p(50, 30), 1, 0)[1].porcentaje).toBe(5)
  })
})

describe('moverDivision', () => {
  it('lo que gana un sabor lo pierde el siguiente', () => {
    const r = moverDivision(p(50, 50), 1, 70)
    expect(r.map((x) => x.porcentaje)).toEqual([70, 30])
  })

  it('no deja un sabor por debajo del 5 %', () => {
    const r = moverDivision(p(50, 30, 20), 2, 99)
    expect(r.map((x) => x.porcentaje)).toEqual([50, 45, 5])
  })

  it('la última división amplía el último sabor si falta para el 100 %', () => {
    const r = moverDivision(p(40, 20), 2, 100)
    expect(r.map((x) => x.porcentaje)).toEqual([40, 60])
  })
})

describe('divisionesMovibles', () => {
  it('incluye el final solo si no se llega al 100 %', () => {
    expect(divisionesMovibles(p(50, 50))).toEqual([1])
    expect(divisionesMovibles(p(50, 20))).toEqual([1, 2])
  })
})

describe('posicionDesdePunto', () => {
  it('arriba es 0, derecha 25, abajo 50, izquierda 75', () => {
    expect(posicionDesdePunto(0, -1)).toBeCloseTo(0)
    expect(posicionDesdePunto(1, 0)).toBeCloseTo(25)
    expect(posicionDesdePunto(0, 1)).toBeCloseTo(50)
    expect(posicionDesdePunto(-1, 0)).toBeCloseTo(75)
  })
})

describe('sugerenciasEfectivo', () => {
  it('propone el importe exacto y redondeos', () => {
    expect(sugerenciasEfectivo(17.5)).toEqual([17.5, 18, 20, 50, 100])
    expect(sugerenciasEfectivo(20)).toEqual([20, 50, 100])
  })
})
