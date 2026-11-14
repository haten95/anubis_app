'use client'

import clsx from 'clsx'
import { Banknote, CheckCircle2, CreditCard, Printer, Split, Square, SquareCheckBig } from 'lucide-react'
import { useEffect, useState } from 'react'
import { rpc } from '@/lib/use-servicio'
import { centimos, euros, parseImporte, sugerenciasEfectivo } from '@/lib/format'
import type { MetodoPago, Ticket } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Modal } from './ui'
import { cargarTicket, numeroTicket, TicketPapel, useImprimirTicket, type DatosTicket } from './ticket'

type Modo = 'efectivo' | 'tarjeta' | 'mixto'

export function CobroModal({
  abierto,
  comandaId,
  total,
  mesaTexto,
  onCerrar,
  onCobrado,
}: {
  abierto: boolean
  comandaId: number
  total: number
  mesaTexto: string
  onCerrar: () => void
  onCobrado: (ticketId: number) => void
}) {
  const [modo, setModo] = useState<Modo>('efectivo')
  const [entregado, setEntregado] = useState('')
  const [parteEfectivo, setParteEfectivo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (abierto) {
      setModo('efectivo')
      setEntregado('')
      setParteEfectivo('')
      setError('')
    }
  }, [abierto])

  // Importe que se paga en efectivo según el modo
  const efectivo = modo === 'efectivo' ? total : modo === 'mixto' ? (parseImporte(parteEfectivo) ?? 0) : 0
  const tarjeta = centimos(total - efectivo)
  const entregadoNum = entregado.trim() === '' ? efectivo : parseImporte(entregado)
  const cambio = entregadoNum !== null ? centimos(entregadoNum - efectivo) : null

  const problema =
    modo === 'mixto' && (efectivo <= 0 || efectivo >= total)
      ? 'En el pago mixto, la parte en efectivo tiene que ser mayor que 0 y menor que el total.'
      : efectivo > 0 && (entregadoNum === null || cambio === null || cambio < 0)
        ? 'El efectivo entregado no llega.'
        : ''

  async function cobrar() {
    if (problema) return setError(problema)
    const pagos: { metodo: MetodoPago; importe: number; entregado?: number }[] = []
    if (efectivo > 0) pagos.push({ metodo: 'efectivo', importe: efectivo, entregado: entregadoNum ?? efectivo })
    if (tarjeta > 0) pagos.push({ metodo: 'tarjeta', importe: tarjeta })
    setEnviando(true)
    const { data, error } = await rpc<Ticket>('cobrar_comanda', { p_comanda: comandaId, p_pagos: pagos })
    setEnviando(false)
    if (error || !data) return setError(error ?? 'No se pudo cobrar')
    onCobrado(data.id)
  }

  return (
    <Modal abierto={abierto} titulo={`Cobrar · ${mesaTexto}`} onCerrar={onCerrar}>
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl bg-fondo/60 py-4 text-center">
          <p className="text-xs uppercase tracking-widest text-suave">Total a cobrar</p>
          <p className="font-display text-5xl font-bold text-oro-claro">{euros(total)}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['efectivo', 'Efectivo', Banknote],
              ['tarjeta', 'Tarjeta', CreditCard],
              ['mixto', 'Mixto', Split],
            ] as const
          ).map(([m, texto, Icono]) => (
            <button
              key={m}
              onClick={() => {
                setModo(m)
                setError('')
                setEntregado('')
              }}
              className={clsx(
                'tactil flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-semibold transition',
                modo === m ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
              )}
            >
              <Icono size={22} />
              {texto}
            </button>
          ))}
        </div>

        {modo === 'mixto' && (
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="En efectivo (€)">
              <Entrada inputMode="decimal" value={parteEfectivo} onChange={(e) => setParteEfectivo(e.target.value)} placeholder="0,00" autoFocus />
            </Campo>
            <Campo etiqueta="Con tarjeta (€)">
              <Entrada value={tarjeta > 0 && efectivo > 0 ? euros(tarjeta) : '—'} disabled />
            </Campo>
          </div>
        )}

        {efectivo > 0 && (
          <div className="flex flex-col gap-3">
            <Campo etiqueta="Efectivo entregado por el cliente (€)" ayuda="Déjalo vacío si paga el importe exacto.">
              <Entrada
                inputMode="decimal"
                value={entregado}
                onChange={(e) => setEntregado(e.target.value)}
                placeholder={euros(efectivo)}
                autoFocus={modo === 'efectivo'}
              />
            </Campo>
            <div className="flex flex-wrap gap-2">
              {sugerenciasEfectivo(efectivo).map((v) => (
                <button
                  key={v}
                  onClick={() => setEntregado(String(v).replace('.', ','))}
                  className={clsx(
                    'tactil rounded-xl border px-4 py-2 font-display text-sm transition',
                    entregadoNum === v ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea hover:border-oro-oscuro',
                  )}
                >
                  {v === centimos(efectivo) ? 'Exacto' : euros(v)}
                </button>
              ))}
            </div>
            <div
              className={clsx(
                'flex items-center justify-between rounded-2xl px-4 py-3',
                cambio !== null && cambio >= 0 ? 'bg-ok/10' : 'bg-peligro/10',
              )}
            >
              <span className="text-sm font-semibold">Cambio a devolver</span>
              <span className={clsx('font-display text-3xl font-bold', cambio !== null && cambio >= 0 ? 'text-ok' : 'text-peligro')}>
                {cambio === null ? '—' : cambio < 0 ? `Faltan ${euros(-cambio)}` : euros(cambio)}
              </span>
            </div>
          </div>
        )}

        {modo === 'tarjeta' && (
          <p className="rounded-xl bg-fondo/60 px-4 py-3 text-sm text-suave">
            Cobra {euros(total)} en el datáfono y, cuando esté aceptado, confirma aquí.
          </p>
        )}

        <Aviso>{error}</Aviso>
        <Boton variante="oro" className="py-4 text-base" onClick={cobrar} disabled={enviando || !!problema}>
          <CheckCircle2 size={18} /> {enviando ? 'Cobrando…' : 'Confirmar cobro'}
        </Boton>
      </div>
    </Modal>
  )
}

/** Resultado del cobro: casillas de pago marcadas, cambio y ticket */
export function CobroHecho({ ticketId, onVolver }: { ticketId: number; onVolver: () => void }) {
  const [datos, setDatos] = useState<DatosTicket | null>(null)
  const { imprimir, portal } = useImprimirTicket()

  useEffect(() => {
    cargarTicket(ticketId).then(setDatos)
  }, [ticketId])

  if (!datos) return <Cargando />

  const metodos = new Set(datos.pagos.map((p) => p.metodo))
  const cambio = datos.pagos.reduce((t, p) => t + p.cambio, 0)

  return (
    <div className="aparecer mx-auto flex max-w-xl flex-col gap-5">
      {portal}
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 size={56} className="text-ok" />
        <h2 className="mt-3 font-display text-2xl text-oro-claro">Cobrado · {euros(datos.ticket.total)}</h2>
        <p className="text-sm text-suave">
          {datos.ticket.mesa_texto} · Ticket {numeroTicket(datos.ticket)}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-linea bg-panel p-4">
        {(
          [
            ['efectivo', 'Pagado en efectivo'],
            ['tarjeta', 'Pagado con tarjeta'],
          ] as const
        ).map(([m, texto]) => (
          <div key={m} className={clsx('flex items-center gap-3 text-base', metodos.has(m) ? 'font-semibold text-texto' : 'text-suave/60')}>
            {metodos.has(m) ? <SquareCheckBig size={22} className="text-ok" /> : <Square size={22} />}
            {texto}
            {metodos.has(m) && (
              <span className="ml-auto font-display text-oro-claro">
                {euros(datos.pagos.filter((p) => p.metodo === m).reduce((t, p) => t + p.importe, 0))}
              </span>
            )}
          </div>
        ))}
      </div>

      {cambio > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-ok/10 px-5 py-4">
          <span className="font-semibold">Cambio a devolver</span>
          <span className="font-display text-4xl font-bold text-ok">{euros(cambio)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Boton onClick={() => imprimir(datos)}>
          <Printer size={16} /> Imprimir ticket
        </Boton>
        <Boton variante="oro" onClick={onVolver}>
          Volver a la sala
        </Boton>
      </div>

      <details className="rounded-2xl border border-linea bg-panel p-3 text-sm">
        <summary className="cursor-pointer text-suave">Ver ticket</summary>
        <div className="mt-3 overflow-x-auto">
          <TicketPapel datos={datos} />
        </div>
      </details>
    </div>
  )
}
