'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSupabase } from '@/lib/supabase/client'
import { euros, fechaCorta } from '@/lib/format'
import { NOMBRE_METODO, numeroDoc, type AjustesLocal, type Factura, type Pago, type Rectificativa, type Ticket } from '@/lib/types'

export interface DatosTicket {
  ticket: Ticket
  pagos: Pago[]
  ajustes: AjustesLocal | null
  /** Si se imprime como factura completa o como rectificativa en lugar del ticket */
  factura?: Factura | null
  rectificativa?: Rectificativa | null
}

/** Carga un ticket con sus pagos y los datos del local */
export async function cargarTicket(id: number): Promise<DatosTicket | null> {
  const supabase = getSupabase()
  const [t, p, a] = await Promise.all([
    supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
    supabase.from('pagos').select('*').eq('ticket_id', id).order('id'),
    supabase.from('ajustes_local').select('*').maybeSingle(),
  ])
  if (!t.data) return null
  const num = (x: unknown) => Number(x)
  const ticket = t.data as Ticket
  return {
    ticket: { ...ticket, total: num(ticket.total), base: num(ticket.base), cuota_iva: num(ticket.cuota_iva) },
    pagos: ((p.data as Pago[]) ?? []).map((x) => ({
      ...x,
      importe: num(x.importe),
      entregado: x.entregado === null ? null : num(x.entregado),
      cambio: num(x.cambio),
    })),
    ajustes: (a.data as AjustesLocal | null) ?? null,
  }
}

export function numeroTicket(t: Ticket) {
  return `${t.serie}-${String(t.numero).padStart(5, '0')}`
}

/** Factura simplificada en formato de ticket de 80 mm */
export function TicketPapel({ datos }: { datos: DatosTicket }) {
  const { ticket: t, pagos, ajustes, factura, rectificativa } = datos
  const signo = rectificativa ? -1 : 1
  return (
    <div className="ticket-papel mx-auto w-[300px] bg-white p-4 font-mono text-[12px] leading-snug text-black">
      <div className="text-center">
        <p className="text-[15px] font-bold">{ajustes?.nombre_comercial ?? 'Anubis'}</p>
        {ajustes?.razon_social && <p>{ajustes.razon_social}</p>}
        {ajustes?.nif && <p>NIF: {ajustes.nif}</p>}
        {ajustes?.direccion && <p>{ajustes.direccion}</p>}
        {ajustes?.telefono && <p>Tel. {ajustes.telefono}</p>}
      </div>
      <hr className="my-2 border-dashed border-black" />
      {rectificativa ? (
        <>
          <p className="font-bold">FACTURA RECTIFICATIVA {numeroDoc(rectificativa)}</p>
          <p>{fechaCorta(rectificativa.emitida_en)}</p>
          <p>Rectifica a {numeroTicket(t)} del {fechaCorta(t.emitido_en)}</p>
          <p>Motivo: {rectificativa.motivo}</p>
        </>
      ) : factura ? (
        <>
          <p className="font-bold">FACTURA {numeroDoc(factura)}</p>
          <p>{fechaCorta(factura.emitida_en)}</p>
          <p className="mt-1 font-bold">Cliente</p>
          <p>{factura.cliente_nombre}</p>
          <p>NIF: {factura.cliente_nif}</p>
          <p>{factura.cliente_direccion}</p>
          <p className="mt-1 text-[10px]">Sustituye a la factura simplificada {numeroTicket(t)} del {fechaCorta(t.emitido_en)}</p>
        </>
      ) : (
        <>
          <p className="font-bold">FACTURA SIMPLIFICADA {numeroTicket(t)}</p>
          <p>{fechaCorta(t.emitido_en)}</p>
          <p>{t.mesa_texto}</p>
        </>
      )}
      <hr className="my-2 border-dashed border-black" />
      <table className="w-full">
        <tbody>
          {t.lineas.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="pr-1">{l.cantidad}</td>
              <td className="w-full">
                {l.nombre}
                {l.sabores && l.sabores.length > 0 && (
                  <span className="block text-[10px]">{l.sabores.map((s) => `${s.nombre} ${s.porcentaje}%`).join(' · ')}</span>
                )}
              </td>
              <td className="whitespace-nowrap pl-1 text-right">{euros(signo * Number(l.importe))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-2 border-dashed border-black" />
      <div className="flex justify-between text-[15px] font-bold">
        <span>TOTAL</span>
        <span>{euros(signo * t.total)}</span>
      </div>
      <table className="mt-2 w-full text-[11px]">
        <thead>
          <tr>
            <th className="text-left font-normal">IVA</th>
            <th className="text-right font-normal">Base</th>
            <th className="text-right font-normal">Cuota</th>
          </tr>
        </thead>
        <tbody>
          {t.desglose_iva.map((d) => (
            <tr key={d.iva}>
              <td>{Number(d.iva)}%</td>
              <td className="text-right">{euros(signo * Number(d.base))}</td>
              <td className="text-right">{euros(signo * Number(d.cuota))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-2 border-dashed border-black" />
      {rectificativa ? (
        <div className="flex justify-between">
          <span>Devuelto ({NOMBRE_METODO[rectificativa.metodo_devolucion].toLowerCase()})</span>
          <span>{euros(rectificativa.total)}</span>
        </div>
      ) : pagos.map((p) => (
        <div key={p.id}>
          <div className="flex justify-between">
            <span>{NOMBRE_METODO[p.metodo]}</span>
            <span>{euros(p.importe)}</span>
          </div>
          {p.metodo === 'efectivo' && p.entregado !== null && p.cambio > 0 && (
            <>
              <div className="flex justify-between text-[11px]">
                <span>Entregado</span>
                <span>{euros(p.entregado)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Cambio</span>
                <span>{euros(p.cambio)}</span>
              </div>
            </>
          )}
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center">{ajustes?.pie_ticket ?? 'Gracias por su visita'}</p>
      <p className="mt-1 text-center text-[10px]">IVA incluido</p>
    </div>
  )
}

/** Imprime el ticket (en una impresora de tickets o en PDF desde el diálogo del navegador) */
export function useImprimirTicket() {
  const [datos, setDatos] = useState<DatosTicket | null>(null)

  useEffect(() => {
    if (!datos) return
    const t = setTimeout(() => {
      window.print()
      setDatos(null)
    }, 50)
    return () => clearTimeout(t)
  }, [datos])

  const portal =
    datos && typeof document !== 'undefined'
      ? createPortal(
          <div className="zona-impresion">
            <TicketPapel datos={datos} />
          </div>,
          document.body,
        )
      : null

  return { imprimir: setDatos, portal }
}
