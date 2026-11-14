import { describe, expect, it } from 'vitest'
import { diasSemana, fechaLarga, formatoHoras, horasEntre, horasTurno, lunesDe, nombreMes, sumarDias, sumarMeses } from '../lib/fechas'

describe('semanas', () => {
  it('encuentra el lunes de la semana', () => {
    expect(lunesDe('2026-11-14')).toBe('2026-11-09') // sábado
    expect(lunesDe('2026-11-09')).toBe('2026-11-09') // lunes
    expect(lunesDe('2026-11-15')).toBe('2026-11-09') // domingo
  })
  it('cruza meses y años', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02')
    expect(diasSemana('2026-11-30')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'])
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-01')
  })
  it('da nombres en español', () => {
    expect(fechaLarga('2026-11-16')).toBe('Lunes 16 de noviembre')
    expect(fechaLarga('2026-11-16', true)).toBe('lun 16 nov')
    expect(nombreMes('2026-11-01')).toBe('Noviembre 2026')
  })
})

describe('horas', () => {
  it('calcula turnos que cruzan la medianoche', () => {
    expect(horasTurno('18:00:00', '02:00:00')).toBe(8)
    expect(horasTurno('10:00', '14:30')).toBe(4.5)
  })
  it('calcula fichajes', () => {
    expect(horasEntre('2026-11-14T18:00:00Z', '2026-11-15T01:30:00Z')).toBe(7.5)
  })
  it('formatea horas', () => {
    expect(formatoHoras(7.5)).toBe('7 h 30 min')
    expect(formatoHoras(8)).toBe('8 h')
    expect(formatoHoras(0.25)).toBe('15 min')
  })
})

describe('fechas con hora', () => {
  it('acepta fechas con hora (como las devuelve la base de datos)', () => {
    expect(fechaLarga('2026-11-16T00:00:00', true)).toBe('lun 16 nov')
    expect(lunesDe('2026-11-14T00:00:00')).toBe('2026-11-09')
  })
})
