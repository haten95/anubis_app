import { describe, expect, it } from 'vitest'
import { parseImporte } from '../lib/format'

describe('parseImporte', () => {
  it('acepta coma y punto decimal', () => {
    expect(parseImporte('4,50')).toBe(4.5)
    expect(parseImporte('12.5')).toBe(12.5)
    expect(parseImporte(' 18 ')).toBe(18)
  })

  it('rechaza valores no válidos', () => {
    expect(parseImporte('')).toBeNull()
    expect(parseImporte('-3')).toBeNull()
    expect(parseImporte('4,555')).toBeNull()
    expect(parseImporte('abc')).toBeNull()
  })
})

import { cantidadStock, cantidadSugerida, parseCantidad } from '../lib/format'

describe('stock', () => {
  it('formatea cantidades con su unidad', () => {
    expect(cantidadStock(250, 'g')).toBe('250 g')
    expect(cantidadStock(1500, 'g')).toBe('1,5 kg')
    expect(cantidadStock(12, 'ud')).toBe('12 ud')
    expect(cantidadStock(700, 'ml')).toBe('700 ml')
  })
  it('lee cantidades con hasta 3 decimales', () => {
    expect(parseCantidad('1,5')).toBe(1.5)
    expect(parseCantidad('0.125')).toBe(0.125)
    expect(parseCantidad('-1')).toBeNull()
  })
  it('sugiere reponer hasta el doble del mínimo', () => {
    expect(cantidadSugerida(2, 10)).toBe(18)
    expect(cantidadSugerida(0, 0)).toBe(1)
    expect(cantidadSugerida(9.5, 5)).toBe(1)
  })
})
