'use client'

import clsx from 'clsx'
import { ArrowDownLeft, ArrowUpRight, Gift, Lock, Printer, Unlock, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { centimos, euros, fechaCorta, parseImporte } from '@/lib/format'
import { NOMBRE_MOTIVO_MERMA, type Caja, type MotivoMerma, type ResumenCaja, type Ticket, type Usuario } from '@/lib/types'
import { FacturacionView } from './facturacion-view'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Panel, Titulo, Vacio } from './ui'
import { cargarTicket, numeroTicket, useImprimirTicket } from './ticket'

interface Movimiento {
  id: number
  tipo: 'entrada' | 'salida'
  importe: number
  motivo: string
  creado_en: string
}

interface MermaFila {
  id: number
  motivo: MotivoMerma
  nota: string | null
  valor_carta: number
  creado_en: string
  linea: { nombre: string; cantidad: number } | null
}

export function CajaView({ perfil }: { perfil: Usuario }) {
  const [pestana, setPestana] = useState<'turno' | 'facturas'>('turno')
  return (
    <div className="aparecer">
      <Titulo>Caja</Titulo>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {(
          [
            ['turno', 'Turno de caja'],
            ['facturas', 'Tickets y facturas'],
          ] as const
        ).map(([id, nombre]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={clsx(
              'tactil shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
              pestana === id ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
            )}
          >
            {nombre}
          </button>
        ))}
      </div>
      {pestana === 'turno' ? <TurnoCaja /> : <FacturacionView perfil={perfil} />}
    </div>
  )
}

function TurnoCaja() {
  const [resumen, setResumen] = useState<ResumenCaja | null | undefined>(undefined)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [mermas, setMermas] = useState<MermaFila[]>([])
  const [historial, setHistorial] = useState<Caja[]>([])
  const [error, setError] = useState('')
  const [movModal, setMovModal] = useState<'entrada' | 'salida' | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const { imprimir, portal } = useImprimirTicket()

  const recargar = useCallback(async () => {
    const supabase = getSupabase()
    const { data, error } = await rpc<ResumenCaja>('resumen_caja', { p_caja: null })
    if (error) setError(error)
    setResumen(data)

    const h = await supabase.from('cajas').select('*').not('cerrada_en', 'is', null).order('cerrada_en', { ascending: false }).limit(10)
    setHistorial((h.data as Caja[]) ?? [])

    if (!data) {
      setTickets([])
      setMovimientos([])
      setMermas([])
      return
    }
    const k = data.caja
    const [t, m, me] = await Promise.all([
      supabase.from('tickets').select('*').eq('caja_id', k.id).order('numero', { ascending: false }),
      supabase.from('movimientos_caja').select('*').eq('caja_id', k.id).order('creado_en', { ascending: false }),
      supabase
        .from('mermas')
        .select('id, motivo, nota, valor_carta, creado_en, linea:lineas_comanda(nombre, cantidad)')
        .gte('creado_en', k.abierta_en)
        .order('creado_en', { ascending: false }),
    ])
    const err = t.error ?? m.error ?? me.error
    if (err) setError(mensajeError(err))
    setTickets(((t.data as Ticket[]) ?? []).map((x) => ({ ...x, total: Number(x.total) })))
    setMovimientos(((m.data as Movimiento[]) ?? []).map((x) => ({ ...x, importe: Number(x.importe) })))
    setMermas(((me.data as unknown as MermaFila[]) ?? []).map((x) => ({ ...x, valor_carta: Number(x.valor_carta) })))
  }, [])

  useEffect(() => {
    recargar()
    const supabase = getSupabase()
    const canal = supabase
      .channel('caja')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cajas' }, () => recargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => recargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [recargar])

  if (resumen === undefined) return <Cargando />

  return (
    <div>
      {portal}
      <BarraAcciones
        accion={
          resumen && (
            <div className="flex flex-wrap gap-2">
              <Boton onClick={() => setMovModal('entrada')}>
                <ArrowDownLeft size={16} /> Entrada
              </Boton>
              <Boton onClick={() => setMovModal('salida')}>
                <ArrowUpRight size={16} /> Salida
              </Boton>
              <Boton variante="oro" onClick={() => setCerrando(true)}>
                <Lock size={16} /> Cerrar caja
              </Boton>
            </div>
          )
        }
      />
      <div className="mb-4">
        <Aviso>{error}</Aviso>
      </div>

      {!resumen ? (
        <AbrirCaja onAbierta={recargar} />
      ) : (
        <div className="flex flex-col gap-5">
          <p className="-mt-2 text-sm text-suave">
            Abierta el {fechaCorta(resumen.caja.abierta_en)} con un fondo de {euros(Number(resumen.caja.fondo_inicial))}.
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Dato
              titulo="Ventas"
              valor={euros(resumen.total_ventas)}
              detalle={`${resumen.tickets} tickets${resumen.devoluciones ? ` · −${euros(resumen.devoluciones)} devuelto` : ''}`}
              destacado
            />
            <Dato titulo="Efectivo" valor={euros(resumen.efectivo)} />
            <Dato titulo="Tarjeta" valor={euros(resumen.tarjeta)} />
            <Dato titulo="Efectivo en cajón" valor={euros(resumen.efectivo_esperado)} detalle="Fondo + efectivo ± movimientos" />
          </div>

          {resumen.comandas_abiertas > 0 && (
            <Aviso tono="info">
              Hay {resumen.comandas_abiertas} {resumen.comandas_abiertas === 1 ? 'mesa abierta' : 'mesas abiertas'} sin cobrar.
            </Aviso>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <h3 className="mb-3 font-display text-lg">Tickets</h3>
              {tickets.length === 0 ? (
                <Vacio>Todavía no se ha cobrado nada.</Vacio>
              ) : (
                <ul className="max-h-96 divide-y divide-linea overflow-y-auto">
                  {tickets.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{numeroTicket(t)}</p>
                        <p className="text-xs text-suave">
                          {t.mesa_texto} · {fechaCorta(t.emitido_en)}
                        </p>
                      </div>
                      <span className="font-display text-oro-claro">{euros(t.total)}</span>
                      <button
                        onClick={async () => {
                          const d = await cargarTicket(t.id)
                          if (d) imprimir(d)
                        }}
                        className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto"
                        title="Reimprimir"
                      >
                        <Printer size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="flex flex-col gap-5">
              <Panel>
                <h3 className="mb-3 font-display text-lg">Entradas y salidas de efectivo</h3>
                {movimientos.length === 0 ? (
                  <Vacio>Sin movimientos.</Vacio>
                ) : (
                  <ul className="divide-y divide-linea">
                    {movimientos.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        {m.tipo === 'entrada' ? <ArrowDownLeft size={16} className="text-ok" /> : <ArrowUpRight size={16} className="text-peligro" />}
                        <span className="flex-1 text-sm">{m.motivo}</span>
                        <span className={clsx('font-display', m.tipo === 'entrada' ? 'text-ok' : 'text-peligro')}>
                          {m.tipo === 'entrada' ? '+' : '−'}
                          {euros(m.importe)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-lg">
                      <Gift size={18} className="text-oro" /> Mermas del turno
                    </h3>
                    <p className="text-xs text-suave">Orientativo: no cuenta en la facturación ni en el efectivo.</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-oro-claro">{euros(resumen.mermas_valor_carta)}</p>
                    <p className="text-[11px] text-suave">valor de carta</p>
                  </div>
                </div>
                {mermas.length === 0 ? (
                  <Vacio>Sin mermas.</Vacio>
                ) : (
                  <ul className="max-h-72 divide-y divide-linea overflow-y-auto">
                    {mermas.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {m.linea ? `${m.linea.cantidad}× ${m.linea.nombre}` : 'Línea'}
                          </p>
                          <p className="text-xs text-suave">
                            {NOMBRE_MOTIVO_MERMA[m.motivo]}
                            {m.nota && ` · ${m.nota}`}
                          </p>
                        </div>
                        <span className="text-suave">{euros(m.valor_carta)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}

      {historial.length > 0 && (
        <Panel className="mt-6">
          <h3 className="mb-3 font-display text-lg">Cierres anteriores</h3>
          <ul className="divide-y divide-linea">
            {historial.map((k) => {
              const desc = centimos(Number(k.efectivo_contado ?? 0) - Number(k.efectivo_esperado ?? 0))
              return (
                <li key={k.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1">{fechaCorta(k.cerrada_en!)}</span>
                  <span className="text-suave">Esperado {euros(Number(k.efectivo_esperado))}</span>
                  <span className="text-suave">Contado {euros(Number(k.efectivo_contado))}</span>
                  <Etiqueta tono={desc === 0 ? 'ok' : 'peligro'}>
                    {desc === 0 ? 'Cuadra' : `${desc > 0 ? 'Sobran' : 'Faltan'} ${euros(Math.abs(desc))}`}
                  </Etiqueta>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <MovimientoModal tipo={movModal} onCerrar={() => setMovModal(null)} onHecho={recargar} />
      {resumen && <CerrarCajaModal abierto={cerrando} resumen={resumen} onCerrar={() => setCerrando(false)} onHecho={recargar} />}
    </div>
  )
}

function Dato({ titulo, valor, detalle, destacado }: { titulo: string; valor: string; detalle?: string; destacado?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border p-4', destacado ? 'border-oro/40 bg-oro/10' : 'border-linea bg-panel')}>
      <p className="text-xs uppercase tracking-widest text-suave">{titulo}</p>
      <p className={clsx('mt-1 font-display text-2xl font-bold', destacado ? 'text-oro-claro' : 'text-texto')}>{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-suave">{detalle}</p>}
    </div>
  )
}

function AbrirCaja({ onAbierta }: { onAbierta: () => void }) {
  const [fondo, setFondo] = useState('')
  const [error, setError] = useState('')

  async function abrir(e: FormEvent) {
    e.preventDefault()
    const f = fondo.trim() === '' ? 0 : parseImporte(fondo)
    if (f === null) return setError('Importe no válido.')
    const { error } = await rpc('abrir_caja', { p_fondo: f })
    if (error) return setError(error)
    onAbierta()
  }

  return (
    <Panel className="mx-auto max-w-md text-center">
      <Wallet size={40} className="mx-auto text-oro" />
      <h3 className="mt-3 font-display text-xl">La caja está cerrada</h3>
      <p className="mt-1 text-sm text-suave">Ábrela con el efectivo que hay en el cajón para empezar a cobrar.</p>
      <form onSubmit={abrir} className="mt-5 flex flex-col gap-3 text-left">
        <Campo etiqueta="Fondo inicial (€)">
          <Entrada inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} placeholder="0,00" autoFocus />
        </Campo>
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="oro" className="py-3.5">
          <Unlock size={16} /> Abrir caja
        </Boton>
      </form>
    </Panel>
  )
}

function MovimientoModal({ tipo, onCerrar, onHecho }: { tipo: 'entrada' | 'salida' | null; onCerrar: () => void; onHecho: () => void }) {
  const [importe, setImporte] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const v = parseImporte(importe)
    if (v === null || v <= 0) return setError('Importe no válido.')
    if (!motivo.trim()) return setError('Indica el motivo.')
    const { error } = await rpc('movimiento_caja', { p_tipo: tipo, p_importe: v, p_motivo: motivo })
    if (error) return setError(error)
    setImporte('')
    setMotivo('')
    setError('')
    onHecho()
    onCerrar()
  }

  return (
    <Modal abierto={tipo !== null} titulo={tipo === 'entrada' ? 'Entrada de efectivo' : 'Salida de efectivo'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <Campo etiqueta="Importe (€)">
          <Entrada inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0,00" autoFocus />
        </Campo>
        <Campo etiqueta="Motivo">
          <Entrada
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            placeholder={tipo === 'entrada' ? 'Cambio traído del banco…' : 'Pago a repartidor de hielo…'}
          />
        </Campo>
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="oro">
          Guardar
        </Boton>
      </form>
    </Modal>
  )
}

function CerrarCajaModal({
  abierto,
  resumen,
  onCerrar,
  onHecho,
}: {
  abierto: boolean
  resumen: ResumenCaja
  onCerrar: () => void
  onHecho: () => void
}) {
  const [contado, setContado] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const valor = parseImporte(contado)
  const descuadre = valor === null ? null : centimos(valor - resumen.efectivo_esperado)

  async function cerrar(e: FormEvent) {
    e.preventDefault()
    if (valor === null) return setError('Indica el efectivo contado.')
    if (resumen.comandas_abiertas > 0 && !confirm('Hay mesas sin cobrar. ¿Cerrar la caja igualmente?')) return
    const { error } = await rpc('cerrar_caja', { p_contado: valor, p_notas: notas })
    if (error) return setError(error)
    setContado('')
    setNotas('')
    onHecho()
    onCerrar()
  }

  return (
    <Modal abierto={abierto} titulo="Cerrar caja · arqueo" onCerrar={onCerrar}>
      <form onSubmit={cerrar} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Fila texto="Fondo inicial" valor={Number(resumen.caja.fondo_inicial)} />
          <Fila texto="Cobrado en efectivo" valor={resumen.efectivo} />
          <Fila texto="Entradas" valor={resumen.entradas} />
          <Fila texto="Salidas" valor={-resumen.salidas} />
          <Fila texto="Cobrado con tarjeta" valor={resumen.tarjeta} />
          <Fila texto="Total ventas" valor={resumen.total_ventas} />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-fondo/60 px-4 py-3">
          <span className="font-semibold">Efectivo que debería haber</span>
          <span className="font-display text-2xl text-oro-claro">{euros(resumen.efectivo_esperado)}</span>
        </div>
        <Campo etiqueta="Efectivo contado en el cajón (€)">
          <Entrada inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0,00" autoFocus />
        </Campo>
        {descuadre !== null && (
          <div className={clsx('rounded-xl px-4 py-3 text-center font-semibold', descuadre === 0 ? 'bg-ok/10 text-ok' : 'bg-peligro/10 text-peligro')}>
            {descuadre === 0 ? 'La caja cuadra' : `${descuadre > 0 ? 'Sobran' : 'Faltan'} ${euros(Math.abs(descuadre))}`}
          </div>
        )}
        <p className="text-xs text-suave">
          Mermas del turno (orientativo, no afecta al arqueo): {resumen.mermas_lineas} líneas · {euros(resumen.mermas_valor_carta)} en valor de carta.
        </p>
        <Campo etiqueta="Notas (opcional)">
          <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} />
        </Campo>
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="oro" className="py-3.5">
          <Lock size={16} /> Cerrar caja
        </Boton>
      </form>
    </Modal>
  )
}

function Fila({ texto, valor }: { texto: string; valor: number }) {
  return (
    <>
      <span className="text-suave">{texto}</span>
      <span className="text-right font-display">{euros(valor)}</span>
    </>
  )
}

function BarraAcciones({ accion }: { accion: React.ReactNode }) {
  if (!accion) return null
  return <div className="mb-4 flex justify-end">{accion}</div>
}
