import { getSupabase } from './supabase/client'
import { deIso, sumarDias } from './fechas'
import { numeroDoc, type Factura, type InformeVentas, type Rectificativa, type Ticket } from './types'

type Fila = (string | number | Date | null)[]

const EUR = '#,##0.00 €'

/** Libro de facturas emitidas del periodo (por fecha de expedición), para la gestoría */
async function libroFacturas(desde: string, hasta: string): Promise<{ cabecera: string[]; filas: Fila[]; ivas: number[] }> {
  const supabase = getSupabase()
  const ini = deIso(desde).toISOString()
  const fin = deIso(sumarDias(hasta, 1)).toISOString()
  const [t, f, r] = await Promise.all([
    supabase.from('tickets').select('*').gte('emitido_en', ini).lt('emitido_en', fin).order('emitido_en'),
    supabase.from('facturas').select('*').gte('emitida_en', ini).lt('emitida_en', fin).order('emitida_en'),
    supabase.from('rectificativas').select('*').gte('emitida_en', ini).lt('emitida_en', fin).order('emitida_en'),
  ])
  const tickets = (t.data as Ticket[]) ?? []
  const facturas = (f.data as (Factura & { desglose_iva: Ticket['desglose_iva'] })[]) ?? []
  const rects = (r.data as (Rectificativa & { desglose_iva: Ticket['desglose_iva'] })[]) ?? []

  // Números de ticket referenciados por facturas y rectificativas de fuera del periodo
  const refs = [...facturas, ...rects].map((x) => x.ticket_id).filter((id) => !tickets.some((tk) => tk.id === id))
  const extra = refs.length ? (((await supabase.from('tickets').select('*').in('id', refs)).data as Ticket[]) ?? []) : []
  const ticketPorId = new Map([...tickets, ...extra].map((x) => [x.id, x]))

  const ivas = [...new Set([...tickets, ...facturas, ...rects].flatMap((d) => d.desglose_iva.map((x) => Number(x.iva))))].sort((a, b) => a - b)
  const cabecera = [
    'Tipo',
    'Número',
    'Fecha',
    'Cliente',
    'NIF cliente',
    'Referencia',
    ...ivas.flatMap((i) => [`Base ${i}%`, `IVA ${i}%`]),
    'Base total',
    'IVA total',
    'Total',
  ]

  const desglose = (d: Ticket['desglose_iva']) =>
    ivas.flatMap((i) => {
      const x = d.find((y) => Number(y.iva) === i)
      return x ? [Number(x.base), Number(x.cuota)] : [null, null]
    })

  type Doc = { fecha: string; fila: Fila }
  const docs: Doc[] = [
    ...tickets.map((x) => ({
      fecha: x.emitido_en,
      fila: ['Simplificada', numeroDoc(x), new Date(x.emitido_en), null, null, x.mesa_texto, ...desglose(x.desglose_iva), Number(x.base), Number(x.cuota_iva), Number(x.total)],
    })),
    ...facturas.map((x) => ({
      fecha: x.emitida_en,
      fila: [
        'Factura (sustituye)',
        numeroDoc(x),
        new Date(x.emitida_en),
        x.cliente_nombre,
        x.cliente_nif,
        ticketPorId.get(x.ticket_id) ? `Sustituye a ${numeroDoc(ticketPorId.get(x.ticket_id)!)}` : null,
        ...desglose(x.desglose_iva),
        Number(x.base),
        Number(x.cuota_iva),
        Number(x.total),
      ] as Fila,
    })),
    ...rects.map((x) => ({
      fecha: x.emitida_en,
      fila: [
        'Rectificativa',
        numeroDoc(x),
        new Date(x.emitida_en),
        null,
        null,
        `${ticketPorId.get(x.ticket_id) ? `Rectifica ${numeroDoc(ticketPorId.get(x.ticket_id)!)} · ` : ''}${x.motivo}`,
        ...desglose(x.desglose_iva),
        Number(x.base),
        Number(x.cuota_iva),
        Number(x.total),
      ] as Fila,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  return { cabecera, filas: docs.map((d) => d.fila), ivas }
}

export async function exportarInformeExcel(informe: InformeVentas, desde: string, hasta: string, local: string) {
  const ExcelJS = (await import('exceljs')).default
  const libro = new ExcelJS.Workbook()
  libro.creator = local

  const hoja = (nombre: string, cabecera: string[], filas: Fila[], formatos: Record<number, string> = {}) => {
    const h = libro.addWorksheet(nombre)
    h.addRow(cabecera)
    h.getRow(1).font = { bold: true }
    h.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2D892' } }
    filas.forEach((f) => h.addRow(f))
    h.columns.forEach((c, i) => {
      c.width = Math.max(12, Math.min(40, Math.max(...[cabecera[i], ...filas.map((f) => f[i])].map((v) => String(v ?? '').length)) + 2))
      if (formatos[i]) c.numFmt = formatos[i]
    })
    h.views = [{ state: 'frozen', ySplit: 1 }]
    return h
  }

  const r = informe.resumen
  const margen = r.base - r.coste
  hoja(
    'Resumen',
    ['Concepto', 'Valor'],
    [
      ['Periodo', `${desde} a ${hasta} (día de 06:00 a 06:00)`],
      ['Ventas (IVA incluido)', r.ventas],
      ['Base imponible', r.base],
      ['IVA repercutido', r.iva],
      ['Tickets', r.tickets],
      ['Ticket medio', r.ticket_medio],
      ['Cobrado en efectivo', r.efectivo],
      ['Cobrado con tarjeta', r.tarjeta],
      ['Anulaciones (rectificativas)', r.anulaciones],
      ['Importe anulado', r.importe_anulado],
      ['Coste de lo vendido (escandallos)', r.coste],
      ['Margen bruto (base − coste)', margen],
      ['Shishas vendidas', r.shishas],
      ['Mermas: valor de carta (orientativo)', r.mermas_valor],
      ['Mermas: coste (orientativo)', r.mermas_coste],
    ],
  ).getColumn(2).numFmt = '#,##0.00'

  hoja('Por día', ['Día', 'Ventas', 'Tickets'], informe.por_dia.map((d) => [d.dia, Number(d.ventas), d.tickets]), { 1: EUR })
  hoja('Por hora', ['Hora', 'Ventas', 'Tickets'], informe.por_hora.map((d) => [`${String(d.hora).padStart(2, '0')}:00`, Number(d.ventas), d.tickets]), { 1: EUR })
  hoja('Productos', ['Producto', 'Unidades', 'Importe'], informe.productos.map((p) => [p.nombre, Number(p.unidades), Number(p.importe)]), { 2: EUR })
  hoja('Categorías', ['Categoría', 'Unidades', 'Importe'], informe.categorias.map((p) => [p.nombre, Number(p.unidades), Number(p.importe)]), { 2: EUR })
  hoja('Sabores', ['Sabor', 'Shishas que lo llevan', 'Cargas equivalentes'], informe.sabores.map((s) => [s.nombre, s.shishas, Number(s.cargas)]))
  hoja('Personal', ['Persona', 'Tickets cobrados', 'Importe'], informe.personal.map((p) => [p.nombre, p.tickets, Number(p.ventas)]), { 2: EUR })

  const lf = await libroFacturas(desde, hasta)
  const formatosLibro: Record<number, string> = { 2: 'dd/mm/yyyy hh:mm' }
  for (let i = 6; i < lf.cabecera.length; i++) formatosLibro[i] = EUR
  hoja('Libro de facturas', lf.cabecera, lf.filas, formatosLibro)

  const buffer = await libro.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `informe-${local.replace(/\s+/g, '-').toLowerCase()}-${desde}_${hasta}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
