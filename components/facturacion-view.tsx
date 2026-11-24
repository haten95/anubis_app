'use client'

import clsx from 'clsx'
import { Ban, FileText, Printer, Search, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { euros, fechaCorta } from '@/lib/format'
import { deIso, hoyIso, sumarDias } from '@/lib/fechas'
import { NOMBRE_METODO, numeroDoc, type Factura, type MetodoPago, type Rectificativa, type Ticket, type Usuario } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Panel, Vacio } from './ui'
import { cargarTicket, numeroTicket, useImprimirTicket } from './ticket'

const num = <T extends { total: number; base: number; cuota_iva: number }>(x: T): T => ({
  ...x,
  total: Number(x.total),
  base: Number(x.base),
  cuota_iva: Number(x.cuota_iva),
})

export function FacturacionView({ perfil }: { perfil: Usuario }) {
  const [desde, setDesde] = useState(sumarDias(hoyIso(), -6))
  const [hasta, setHasta] = useState(hoyIso())
  const [buscar, setBuscar] = useState('')
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [rects, setRects] = useState<Rectificativa[]>([])
  const [facturando, setFacturando] = useState<Ticket | null>(null)
  const [anulando, setAnulando] = useState<Ticket | null>(null)
  const [error, setError] = useState('')
  const { imprimir, portal } = useImprimirTicket()

  const cargar = useCallback(async () => {
    const supabase = getSupabase()
    const ini = deIso(desde).toISOString()
    const fin = deIso(sumarDias(hasta, 1)).toISOString()
    const t = await supabase.from('tickets').select('*').gte('emitido_en', ini).lt('emitido_en', fin).order('emitido_en', { ascending: false }).limit(500)
    const lista = ((t.data as Ticket[]) ?? []).map(num)
    const ids = lista.map((x) => x.id)
    const [f, r] = ids.length
      ? await Promise.all([
          supabase.from('facturas').select('*').in('ticket_id', ids),
          supabase.from('rectificativas').select('*').in('ticket_id', ids),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]
    const err = t.error ?? f.error ?? r.error
    setError(err ? mensajeError(err) : '')
    setTickets(lista)
    setFacturas(((f.data as Factura[]) ?? []).map(num))
    setRects(((r.data as Rectificativa[]) ?? []).map(num))
  }, [desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (tickets === null) return <Cargando />

  const facturaDe = new Map(facturas.map((f) => [f.ticket_id, f]))
  const rectDe = new Map(rects.map((r) => [r.ticket_id, r]))
  const q = buscar.trim().toLowerCase()
  const visibles = tickets.filter(
    (t) =>
      !q ||
      numeroTicket(t).toLowerCase().includes(q) ||
      t.mesa_texto.toLowerCase().includes(q) ||
      (facturaDe.get(t.id) && `${numeroDoc(facturaDe.get(t.id)!)} ${facturaDe.get(t.id)!.cliente_nombre} ${facturaDe.get(t.id)!.cliente_nif}`.toLowerCase().includes(q)),
  )

  async function imprimirDoc(t: Ticket, tipo: 'ticket' | 'factura' | 'rectificativa') {
    const d = await cargarTicket(t.id)
    if (!d) return
    imprimir({ ...d, factura: tipo === 'factura' ? facturaDe.get(t.id) : null, rectificativa: tipo === 'rectificativa' ? rectDe.get(t.id) : null })
  }

  return (
    <div className="flex flex-col gap-4">
      {portal}
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <Campo etiqueta="Desde">
            <Entrada type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} className="sm:w-40" />
          </Campo>
          <Campo etiqueta="Hasta">
            <Entrada type="date" value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} className="sm:w-40" />
          </Campo>
        </div>
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Número, mesa, cliente o NIF…" className="pl-9" />
        </div>
      </div>

      <Aviso>{error}</Aviso>

      {visibles.length === 0 ? (
        <Vacio>No hay tickets en estas fechas.</Vacio>
      ) : (
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y divide-linea">
            {visibles.map((t) => {
              const f = facturaDe.get(t.id)
              const r = rectDe.get(t.id)
              return (
                <li key={t.id} className={clsx('flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5', r && 'opacity-70')}>
                  <div className="min-w-44 flex-1">
                    <p className="font-semibold">
                      {numeroTicket(t)} <span className="font-normal text-suave">· {t.mesa_texto}</span>
                    </p>
                    <p className="text-xs text-suave">{fechaCorta(t.emitido_en)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {f && <Etiqueta tono="oro">Factura {numeroDoc(f)} · {f.cliente_nombre}</Etiqueta>}
                      {r && <Etiqueta tono="peligro">Anulado {numeroDoc(r)} · {r.motivo}</Etiqueta>}
                    </div>
                  </div>
                  <span className={clsx('font-display text-lg', r ? 'text-suave line-through' : 'text-oro-claro')}>{euros(t.total)}</span>
                  <div className="flex items-center gap-1">
                    <BotonIcono titulo="Imprimir ticket" onClick={() => imprimirDoc(t, 'ticket')}>
                      <Printer size={16} />
                    </BotonIcono>
                    {f ? (
                      <BotonIcono titulo="Imprimir factura" onClick={() => imprimirDoc(t, 'factura')}>
                        <FileText size={16} className="text-oro-claro" />
                      </BotonIcono>
                    ) : (
                      !r && (
                        <BotonIcono titulo="Hacer factura con datos del cliente" onClick={() => setFacturando(t)}>
                          <FileText size={16} />
                        </BotonIcono>
                      )
                    )}
                    {r ? (
                      <BotonIcono titulo="Imprimir rectificativa" onClick={() => imprimirDoc(t, 'rectificativa')}>
                        <Ban size={16} className="text-peligro" />
                      </BotonIcono>
                    ) : (
                      <BotonIcono titulo="Anular (rectificativa)" onClick={() => setAnulando(t)}>
                        <Ban size={16} />
                      </BotonIcono>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {perfil.rol === 'dueno' && <RegistroFacturacion />}

      <FacturaModal
        ticket={facturando}
        onCerrar={() => setFacturando(null)}
        onHecho={async () => {
          setFacturando(null)
          await cargar()
        }}
      />
      <AnularModal
        ticket={anulando}
        onCerrar={() => setAnulando(null)}
        onHecho={async () => {
          setAnulando(null)
          await cargar()
        }}
      />
    </div>
  )
}

function BotonIcono({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={titulo} aria-label={titulo} className="tactil rounded-lg p-2.5 text-suave hover:bg-panel-2 hover:text-texto">
      {children}
    </button>
  )
}

function FacturaModal({ ticket, onCerrar, onHecho }: { ticket: Ticket | null; onCerrar: () => void; onHecho: () => void }) {
  const [nombre, setNombre] = useState('')
  const [nif, setNif] = useState('')
  const [direccion, setDireccion] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setNombre('')
    setNif('')
    setDireccion('')
    setError('')
  }, [ticket])

  async function emitir(e: FormEvent) {
    e.preventDefault()
    const { error } = await rpc('emitir_factura', { p_ticket: ticket!.id, p_nombre: nombre, p_nif: nif, p_direccion: direccion })
    if (error) return setError(error)
    onHecho()
  }

  return (
    <Modal abierto={ticket !== null} titulo={`Factura del ticket ${ticket ? numeroTicket(ticket) : ''}`} onCerrar={onCerrar}>
      <form onSubmit={emitir} className="flex flex-col gap-4">
        <p className="text-sm text-suave">
          Se emite una factura completa con los datos del cliente que sustituye al ticket ({ticket && euros(ticket.total)}). No se puede editar
          después.
        </p>
        <Campo etiqueta="Nombre o razón social">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} required autoFocus />
        </Campo>
        <Campo etiqueta="NIF / CIF">
          <Entrada value={nif} onChange={(e) => setNif(e.target.value.toUpperCase())} maxLength={20} required />
        </Campo>
        <Campo etiqueta="Dirección completa">
          <Entrada value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={200} placeholder="Calle, número, CP y ciudad" required />
        </Campo>
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="oro">
          <FileText size={16} /> Emitir factura
        </Boton>
      </form>
    </Modal>
  )
}

function AnularModal({ ticket, onCerrar, onHecho }: { ticket: Ticket | null; onCerrar: () => void; onHecho: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [error, setError] = useState('')

  useEffect(() => {
    setMotivo('')
    setMetodo('efectivo')
    setError('')
  }, [ticket])

  async function anular(e: FormEvent) {
    e.preventDefault()
    if (!motivo.trim()) return setError('Indica el motivo.')
    const { error } = await rpc('rectificar_ticket', { p_ticket: ticket!.id, p_motivo: motivo, p_metodo: metodo })
    if (error) return setError(error)
    onHecho()
  }

  return (
    <Modal abierto={ticket !== null} titulo={`Anular ticket ${ticket ? numeroTicket(ticket) : ''}`} onCerrar={onCerrar}>
      <form onSubmit={anular} className="flex flex-col gap-4">
        <p className="text-sm text-suave">
          Se emite una factura rectificativa por {ticket && euros(-ticket.total)} y la devolución se descuenta de la caja abierta. Los tickets no se
          borran nunca.
        </p>
        <Campo etiqueta="Motivo">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Cobrado por error, devolución al cliente…" autoFocus />
        </Campo>
        <Campo etiqueta="Se devuelve en">
          <div className="grid grid-cols-2 gap-2">
            {(['efectivo', 'tarjeta'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodo(m)}
                className={clsx('tactil rounded-xl border py-2.5 text-sm font-semibold', metodo === m ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave')}
              >
                {NOMBRE_METODO[m]}
              </button>
            ))}
          </div>
        </Campo>
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="peligro">
          <Ban size={16} /> Anular con rectificativa
        </Boton>
      </form>
    </Modal>
  )
}

function RegistroFacturacion() {
  const [resultado, setResultado] = useState<{ registros: number; erroneos: number; primero_erroneo: string | null; ultima_huella: string | null } | null>(null)
  const [error, setError] = useState('')

  async function verificar() {
    const { data, error } = await rpc<typeof resultado>('verificar_registro_facturacion', {})
    if (error) return setError(error)
    setResultado(data)
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck size={22} className="text-verde" />
        <div className="min-w-48 flex-1">
          <h3 className="font-display text-lg">Registro de facturación</h3>
          <p className="text-sm text-suave">
            Cada ticket, factura y rectificativa queda registrado con una huella encadenada a la anterior, de modo que cualquier cambio se detecta.
          </p>
        </div>
        <Boton onClick={verificar}>Comprobar integridad</Boton>
      </div>
      <div className="mt-3">
        <Aviso>{error}</Aviso>
        {resultado &&
          (resultado.erroneos === 0 ? (
            <Aviso tono="ok">
              {resultado.registros} registros correctos. Última huella: {resultado.ultima_huella?.slice(0, 16) ?? '—'}…
            </Aviso>
          ) : (
            <Aviso>
              {resultado.erroneos} de {resultado.registros} registros no cuadran (el primero: {resultado.primero_erroneo}).
            </Aviso>
          ))}
      </div>
      <p className="mt-3 text-xs text-suave">
        El envío de los registros a la Agencia Tributaria (Verifactu) se conectará más adelante con un proveedor certificado.
      </p>
    </Panel>
  )
}
