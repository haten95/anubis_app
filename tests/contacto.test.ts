import { describe, expect, it } from 'vitest'
import { enlaceEmail, telefonoWhatsapp, textoPedido } from '../lib/contacto'

describe('telefonoWhatsapp', () => {
  it('añade el prefijo de España a los móviles sin prefijo', () => {
    expect(telefonoWhatsapp('612 34 56 78')).toBe('34612345678')
  })
  it('respeta prefijos internacionales', () => {
    expect(telefonoWhatsapp('+33 6 12 34 56 78')).toBe('33612345678')
    expect(telefonoWhatsapp('0034612345678')).toBe('34612345678')
  })
  it('rechaza teléfonos no válidos', () => {
    expect(telefonoWhatsapp('123')).toBeNull()
    expect(telefonoWhatsapp(null)).toBeNull()
  })
})

describe('textoPedido', () => {
  it('lista los productos con su cantidad', () => {
    const t = textoPedido({
      local: 'Anubis',
      contacto: 'Laura',
      lineas: [
        { nombre: 'Carbón natural', cantidad: 10, unidad: 'ud' },
        { nombre: 'Tabaco menta', cantidad: 1000, unidad: 'g' },
      ],
      notas: null,
      firma: 'Henry',
    })
    expect(t).toContain('Hola, Laura:')
    expect(t).toContain('- 10 ud de Carbón natural')
    expect(t).toContain('- 1 kg de Tabaco menta')
  })
})

describe('enlaceEmail', () => {
  it('codifica asunto y cuerpo', () => {
    expect(enlaceEmail('a@b.es', 'Pedido 1', 'Hola\nya')).toBe('mailto:a%40b.es?subject=Pedido%201&body=Hola%0Aya')
  })
})
