import { cantidadStock } from './format'
import type { Unidad } from './types'

/** Teléfono en formato internacional para WhatsApp (solo dígitos). Asume España si no lleva prefijo. */
export function telefonoWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null
  let d = telefono.replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (/^[6789]\d{8}$/.test(d)) d = '34' + d
  return /^\d{8,15}$/.test(d) ? d : null
}

export interface LineaTextoPedido {
  nombre: string
  cantidad: number
  unidad: Unidad
}

export function textoPedido(opts: {
  local: string
  contacto: string | null
  lineas: LineaTextoPedido[]
  notas: string | null
  firma: string
}): string {
  const saludo = opts.contacto ? `Hola, ${opts.contacto}:` : 'Hola:'
  const lineas = opts.lineas.map((l) => `- ${cantidadStock(l.cantidad, l.unidad)} de ${l.nombre}`).join('\n')
  return [
    saludo,
    '',
    `Os hacemos el siguiente pedido para ${opts.local}:`,
    '',
    lineas,
    ...(opts.notas ? ['', opts.notas] : []),
    '',
    '¿Nos confirmáis disponibilidad y fecha de entrega?',
    '',
    'Gracias,',
    opts.firma,
  ].join('\n')
}

export function enlaceEmail(email: string, asunto: string, cuerpo: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}

export function enlaceWhatsapp(telefono: string, texto: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`
}
