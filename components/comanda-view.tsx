'use client'

import clsx from 'clsx'
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  Flame,
  Gift,
  Minus,
  NotebookPen,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCarta } from '@/lib/use-carta'
import { rpc, totalLineas } from '@/lib/use-servicio'
import { euros, haceCuanto } from '@/lib/format'
import {
  NOMBRE_MOTIVO_MERMA,
  textoMesa,
  type Articulo,
  type Comanda,
  type Linea,
  type Mesa,
  type MotivoMerma,
  type Usuario,
  type Zona,
} from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Vacio } from './ui'
import { MiniCazoleta } from './cazoleta'
import { ShishaModal } from './shisha-modal'
import { CobroHecho, CobroModal } from './cobro-modal'
import { MesaIcono } from './mesa-icono'

export function ComandaView({
  perfil,
  mesa,
  comanda,
  lineas,
  mesas,
  zonas,
  comandaDeMesa,
  hayCaja,
  recargar,
  onVolver,
  onIrAMesa,
}: {
  perfil: Usuario
  mesa: Mesa
  comanda: Comanda | null
  lineas: Linea[]
  mesas: Mesa[]
  zonas: Zona[]
  comandaDeMesa: Map<number, Comanda>
  hayCaja: boolean
  recargar: () => Promise<void>
  onVolver: () => void
  onIrAMesa: (mesaId: number) => void
}) {
  const gestor = perfil.rol !== 'empleado'
  const { carta, error: errorCarta } = useCarta()
  const [catSel, setCatSel] = useState<number | null>(null)
  const [vista, setVista] = useState<'carta' | 'comanda'>('carta')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [conNota, setConNota] = useState(false)

  const [shisha, setShisha] = useState<Articulo | null>(null)
  const [nota, setNota] = useState<Articulo | null>(null)
  const [merma, setMerma] = useState<Linea | 'todo' | null>(null)
  const [moviendo, setMoviendo] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [ticketCobrado, setTicketCobrado] = useState<number | null>(null)

  const total = totalLineas(lineas)
  const principales = lineas.filter((l) => l.linea_padre_id === null)
  const hijas = useMemo(() => {
    const m = new Map<number, Linea[]>()
    for (const l of lineas) if (l.linea_padre_id) m.set(l.linea_padre_id, [...(m.get(l.linea_padre_id) ?? []), l])
    return m
  }, [lineas])
  const unidades = principales.reduce((t, l) => t + l.cantidad, 0)

  async function accion(nombre: string, args: Record<string, unknown>) {
    setError('')
    setOcupado(true)
    const { error, data } = await rpc(nombre, args)
    await recargar()
    setOcupado(false)
    if (error) setError(error)
    return { error, data }
  }

  // Cobro terminado: se muestra el resultado aunque la comanda ya esté cerrada
  if (ticketCobrado !== null) {
    return <CobroHecho ticketId={ticketCobrado} onVolver={onVolver} />
  }

  // La comanda se ha cerrado desde otro dispositivo
  if (!comanda) {
    return (
      <div className="aparecer flex flex-col items-center gap-4 py-16 text-center">
        <MesaIcono numero={mesa.numero} />
        <p className="text-suave">La mesa {mesa.numero} no tiene ninguna comanda abierta.</p>
        <Boton variante="oro" onClick={onVolver}>
          <ArrowLeft size={16} /> Volver a la sala
        </Boton>
      </div>
    )
  }

  const categorias = carta?.categorias ?? []
  const actual = categorias.find((c) => c.id === catSel) ?? categorias[0]
  const articulos = (carta?.articulos ?? []).filter((a) => a.categoria_id === actual?.id && !a.es_cambio_carbon)
  const carbon = carta?.articulos.find((a) => a.es_cambio_carbon)

  function pulsarArticulo(a: Articulo) {
    if (actual?.es_shisha) return setShisha(a)
    if (conNota) return setNota(a)
    accion('anadir_linea', { p_comanda: comanda!.id, p_articulo: a.id, p_cantidad: 1 })
  }

  const pideCuenta = comanda.estado === 'cuenta'

  return (
    <div className="aparecer">
      {/* Cabecera */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Boton variante="secundario" onClick={onVolver} className="px-3" aria-label="Volver a la sala">
          <ArrowLeft size={18} />
        </Boton>
        <div className="mr-auto">
          <h2 className="font-display text-xl text-oro-claro sm:text-2xl">{textoMesa(mesa.tipo, mesa.numero)}</h2>
          <p className="text-xs text-suave">
            Abierta hace {haceCuanto(comanda.abierta_en)} · {unidades} {unidades === 1 ? 'consumición' : 'consumiciones'}
          </p>
        </div>
        {pideCuenta && <Etiqueta tono="peligro">Pide la cuenta</Etiqueta>}
      </div>

      <div className="mb-3">
        <Aviso>{errorCarta || error}</Aviso>
      </div>

      {/* Selector carta/comanda en móvil */}
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-panel p-1 text-sm lg:hidden">
        <button onClick={() => setVista('carta')} className={clsx('rounded-lg py-2.5 font-semibold', vista === 'carta' ? 'bg-panel-2 text-oro-claro' : 'text-suave')}>
          Carta
        </button>
        <button onClick={() => setVista('comanda')} className={clsx('rounded-lg py-2.5 font-semibold', vista === 'comanda' ? 'bg-panel-2 text-oro-claro' : 'text-suave')}>
          Comanda · {euros(total)}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        {/* CARTA */}
        <section className={clsx(vista !== 'carta' && 'hidden lg:block')}>
          {!carta ? (
            <Cargando />
          ) : (
            <>
              <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCatSel(c.id)}
                    className={clsx(
                      'tactil flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition',
                      actual?.id === c.id ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
                    )}
                  >
                    {c.es_shisha && <Flame size={14} />}
                    {c.nombre}
                  </button>
                ))}
              </div>

              {!actual?.es_shisha && (
                <button
                  onClick={() => setConNota(!conNota)}
                  className={clsx(
                    'mb-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    conNota ? 'bg-oro/20 text-oro-claro' : 'text-suave hover:bg-panel-2',
                  )}
                >
                  <NotebookPen size={14} /> {conNota ? 'Añadiendo con nota (pulsa para quitar)' : 'Añadir con nota'}
                </button>
              )}

              {articulos.length === 0 ? (
                <Vacio>No hay artículos en esta categoría. Añádelos en «Carta».</Vacio>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                  {articulos.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => pulsarArticulo(a)}
                      disabled={ocupado}
                      className={clsx(
                        'group flex min-h-24 flex-col justify-between rounded-2xl border border-linea bg-panel p-3.5 text-left transition',
                        'hover:border-oro-oscuro hover:bg-panel-2 active:scale-[0.97] disabled:opacity-60',
                      )}
                    >
                      <span className="font-semibold leading-snug">{a.nombre}</span>
                      <span className="mt-2 flex items-center justify-between">
                        <span className="font-display text-oro-claro">{euros(a.precio)}</span>
                        {actual?.es_shisha ? (
                          <Flame size={16} className="text-oro" />
                        ) : (
                          <Plus size={16} className="text-suave group-hover:text-oro-claro" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* COMANDA */}
        <section className={clsx('lg:sticky lg:top-6 lg:self-start', vista !== 'comanda' && 'hidden lg:block')}>
          <div className="rounded-2xl border border-linea bg-panel">
            <div className="max-h-[52dvh] overflow-y-auto p-3 lg:max-h-[58dvh]">
              {principales.length === 0 ? (
                <p className="px-2 py-10 text-center text-sm text-suave">Comanda vacía. Añade algo de la carta.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {principales.map((l) => (
                    <LineaFila
                      key={l.id}
                      linea={l}
                      hijas={hijas.get(l.id) ?? []}
                      gestor={gestor}
                      ocupado={ocupado}
                      hayCarbon={!!carbon}
                      onMas={() => accion('cambiar_cantidad', { p_linea: l.id, p_cantidad: l.cantidad + 1 })}
                      onMenos={() =>
                        l.cantidad > 1
                          ? accion('cambiar_cantidad', { p_linea: l.id, p_cantidad: l.cantidad - 1 })
                          : accion('anular_linea', { p_linea: l.id })
                      }
                      onAnular={(id) => {
                        if (confirm('¿Quitar esta línea de la comanda?')) accion('anular_linea', { p_linea: id })
                      }}
                      onCarbon={() => accion('cambio_carbon', { p_linea_shisha: l.id })}
                      onMerma={() => setMerma(l)}
                      onQuitarMerma={() => accion('quitar_merma', { p_linea: l.id })}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-linea p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm uppercase tracking-widest text-suave">Total</span>
                <span className="font-display text-3xl font-bold text-oro-claro">{euros(total)}</span>
              </div>
              {lineas.some((l) => l.merma) && (
                <p className="mb-3 text-xs text-suave">Las líneas en merma no se cobran ni cuentan en la facturación.</p>
              )}

              <Boton
                variante="oro"
                className="w-full py-4 text-base"
                disabled={ocupado || total <= 0}
                onClick={() => setCobrando(true)}
              >
                <Receipt size={18} /> Cobrar {total > 0 && euros(total)}
              </Boton>
              {!hayCaja && total > 0 && <p className="mt-2 text-center text-xs text-peligro">No hay caja abierta: no se puede cobrar todavía.</p>}

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Boton
                  disabled={ocupado || principales.length === 0}
                  onClick={() => accion('pedir_cuenta', { p_comanda: comanda.id, p_pedida: !pideCuenta })}
                >
                  {pideCuenta ? <RotateCcw size={16} /> : <Receipt size={16} />}
                  {pideCuenta ? 'Quitar cuenta' : 'Pide la cuenta'}
                </Boton>
                <Boton disabled={ocupado} onClick={() => setMoviendo(true)}>
                  <ArrowRightLeft size={16} /> Cambiar mesa
                </Boton>
                {gestor && principales.some((l) => !l.merma) && (
                  <Boton disabled={ocupado} onClick={() => setMerma('todo')} className="col-span-2">
                    <Gift size={16} /> Cerrar todo como merma
                  </Boton>
                )}
                {principales.length === 0 && (
                  <Boton
                    variante="peligro"
                    className="col-span-2"
                    disabled={ocupado}
                    onClick={async () => {
                      const { error } = await accion('cerrar_comanda_vacia', { p_comanda: comanda.id })
                      if (!error) onVolver()
                    }}
                  >
                    <Ban size={16} /> Cerrar mesa sin consumir
                  </Boton>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modales */}
      {carta && (
        <ShishaModal
          articulo={shisha}
          sabores={carta.sabores}
          onCerrar={() => setShisha(null)}
          onConfirmar={async (sabores, notas) => {
            const { error } = await accion('anadir_shisha', {
              p_comanda: comanda.id,
              p_articulo: shisha!.id,
              p_sabores: sabores.map((s) => ({ sabor_id: s.saborId, porcentaje: s.porcentaje })),
              p_notas: notas,
            })
            if (!error) setShisha(null)
            return error
          }}
        />
      )}

      <NotaModal
        articulo={nota}
        onCerrar={() => setNota(null)}
        onConfirmar={async (texto) => {
          const { error } = await accion('anadir_linea', { p_comanda: comanda.id, p_articulo: nota!.id, p_cantidad: 1, p_notas: texto })
          if (!error) setNota(null)
          return error
        }}
      />

      <MermaModal
        objetivo={merma}
        onCerrar={() => setMerma(null)}
        onConfirmar={async (motivo, texto) => {
          const { error } =
            merma === 'todo'
              ? await accion('cerrar_como_merma', { p_comanda: comanda.id, p_motivo: motivo, p_nota: texto })
              : await accion('marcar_merma', { p_linea: (merma as Linea).id, p_motivo: motivo, p_nota: texto })
          if (!error) {
            const eraTodo = merma === 'todo'
            setMerma(null)
            if (eraTodo) onVolver()
          }
          return error
        }}
      />

      <MoverModal
        abierto={moviendo}
        mesaActual={mesa}
        mesas={mesas}
        zonas={zonas}
        ocupadas={comandaDeMesa}
        onCerrar={() => setMoviendo(false)}
        onElegir={async (destino) => {
          const { error } = await accion('mover_comanda', { p_comanda: comanda.id, p_mesa_destino: destino })
          if (!error) {
            setMoviendo(false)
            onIrAMesa(destino)
          }
          return error
        }}
      />

      <CobroModal
        abierto={cobrando}
        comandaId={comanda.id}
        total={total}
        mesaTexto={textoMesa(mesa.tipo, mesa.numero)}
        onCerrar={() => setCobrando(false)}
        onCobrado={(id) => {
          setCobrando(false)
          setTicketCobrado(id)
          recargar()
        }}
      />
    </div>
  )
}

function LineaFila({
  linea: l,
  hijas,
  gestor,
  ocupado,
  hayCarbon,
  onMas,
  onMenos,
  onAnular,
  onCarbon,
  onMerma,
  onQuitarMerma,
}: {
  linea: Linea
  hijas: Linea[]
  gestor: boolean
  ocupado: boolean
  hayCarbon: boolean
  onMas: () => void
  onMenos: () => void
  onAnular: (id: number) => void
  onCarbon: () => void
  onMerma: () => void
  onQuitarMerma: () => void
}) {
  const carbones = hijas.filter((h) => !h.anulada)
  const importe = l.precio * l.cantidad + carbones.reduce((t, h) => t + h.precio, 0)

  return (
    <li className={clsx('rounded-xl bg-fondo/50 p-2.5', l.merma && 'opacity-70')}>
      <div className="flex items-start gap-2.5">
        {l.es_shisha && l.sabores && l.sabores.length > 0 && <MiniCazoleta sabores={l.sabores} tamano={52} />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">
            {!l.es_shisha && <span className="mr-1 text-oro-claro">{l.cantidad}×</span>}
            {l.nombre}
          </p>
          {l.es_shisha && l.sabores && (
            <p className="mt-0.5 text-xs leading-snug text-suave">
              {l.sabores.map((s) => (
                <span key={s.sabor_id} className="mr-2 inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.nombre} {s.porcentaje}%
                </span>
              ))}
            </p>
          )}
          {l.notas && <p className="mt-0.5 text-xs italic text-oro-claro/80">«{l.notas}»</p>}
          {carbones.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-suave">
              <Flame size={12} className="text-oro" /> {carbones.length} {carbones.length === 1 ? 'cambio' : 'cambios'} de carbón · último hace{' '}
              {haceCuanto(carbones[carbones.length - 1].creado_en)}
            </p>
          )}
          {l.merma && (
            <div className="mt-1">
              <Etiqueta tono="oro">Merma · no se cobra</Etiqueta>
            </div>
          )}
        </div>
        <span className={clsx('shrink-0 font-display text-sm', l.merma ? 'text-suave line-through' : 'text-texto')}>{euros(importe)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {!l.es_shisha && !l.merma && (
          <div className="flex items-center rounded-lg border border-linea">
            <button className="p-2 text-suave hover:text-texto disabled:opacity-40" onClick={onMenos} disabled={ocupado} aria-label="Quitar uno">
              <Minus size={15} />
            </button>
            <span className="w-7 text-center text-sm font-semibold">{l.cantidad}</span>
            <button className="p-2 text-suave hover:text-texto disabled:opacity-40" onClick={onMas} disabled={ocupado} aria-label="Añadir uno">
              <Plus size={15} />
            </button>
          </div>
        )}
        {l.es_shisha && hayCarbon && (
          <button
            onClick={onCarbon}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-lg border border-oro/40 bg-oro/10 px-2.5 py-1.5 text-xs font-semibold text-oro-claro hover:bg-oro/20 disabled:opacity-50"
          >
            <Flame size={14} /> Cambio de carbón
          </button>
        )}
        <span className="ml-auto flex items-center gap-1">
          {gestor &&
            (l.merma ? (
              <button onClick={onQuitarMerma} disabled={ocupado} className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto" title="Quitar merma">
                <Undo2 size={15} />
              </button>
            ) : (
              <button onClick={onMerma} disabled={ocupado} className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto" title="Pasar a merma">
                <Gift size={15} />
              </button>
            ))}
          {carbones.length > 0 && (
            <button
              onClick={() => onAnular(carbones[carbones.length - 1].id)}
              disabled={ocupado}
              className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto"
              title="Quitar el último cambio de carbón"
            >
              <Flame size={15} className="opacity-60" />
            </button>
          )}
          <button onClick={() => onAnular(l.id)} disabled={ocupado} className="rounded-lg p-2 text-suave hover:bg-peligro/10 hover:text-peligro" title="Quitar línea">
            <Trash2 size={15} />
          </button>
        </span>
      </div>
    </li>
  )
}

function NotaModal({
  articulo,
  onCerrar,
  onConfirmar,
}: {
  articulo: Articulo | null
  onCerrar: () => void
  onConfirmar: (nota: string) => Promise<string | null>
}) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal abierto={articulo !== null} titulo={`${articulo?.nombre ?? ''} con nota`} onCerrar={onCerrar}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const err = await onConfirmar(texto)
          setError(err ?? '')
          if (!err) setTexto('')
        }}
      >
        <Campo etiqueta="Nota">
          <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={200} placeholder="Sin hielo, poco azúcar…" autoFocus />
        </Campo>
        <div className="flex flex-wrap gap-2">
          {['Sin hielo', 'Poco hielo', 'Sin azúcar', 'Muy frío', 'Con limón'].map((s) => (
            <button key={s} type="button" onClick={() => setTexto(s)} className="rounded-full border border-linea px-3 py-1.5 text-xs text-suave hover:text-texto">
              {s}
            </button>
          ))}
        </div>
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="oro">
          Añadir
        </Boton>
      </form>
    </Modal>
  )
}

function MermaModal({
  objetivo,
  onCerrar,
  onConfirmar,
}: {
  objetivo: Linea | 'todo' | null
  onCerrar: () => void
  onConfirmar: (motivo: MotivoMerma, nota: string) => Promise<string | null>
}) {
  const [motivo, setMotivo] = useState<MotivoMerma | null>(null)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const titulo = objetivo === 'todo' ? 'Cerrar la comanda como merma' : `Merma: ${objetivo?.nombre ?? ''}`

  return (
    <Modal
      abierto={objetivo !== null}
      titulo={titulo}
      onCerrar={() => {
        setMotivo(null)
        setNota('')
        setError('')
        onCerrar()
      }}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!motivo) return setError('Elige el motivo.')
          const err = await onConfirmar(motivo, nota)
          setError(err ?? '')
          if (!err) {
            setMotivo(null)
            setNota('')
          }
        }}
      >
        <p className="text-sm text-suave">
          {objetivo === 'todo'
            ? 'Todo lo pendiente se cierra sin cobrar: no genera ticket ni cuenta en la facturación. Solo queda como dato orientativo.'
            : 'Esta línea no se cobrará y no contará en la facturación. Solo queda como dato orientativo.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(NOMBRE_MOTIVO_MERMA) as MotivoMerma[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivo(m)}
              className={clsx(
                'tactil rounded-xl border px-3 py-3 text-sm font-semibold transition',
                motivo === m ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
              )}
            >
              {NOMBRE_MOTIVO_MERMA[m]}
            </button>
          ))}
        </div>
        <Campo etiqueta="Nota (opcional)">
          <Entrada value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ej.: cliente habitual, copa rota…" />
        </Campo>
        <p className="rounded-xl bg-fondo/60 px-3.5 py-2.5 text-xs text-suave">
          Si el cliente paga algo, no es merma: cóbralo con efectivo o tarjeta.
        </p>
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="oro">
          <Gift size={16} /> Confirmar merma
        </Boton>
      </form>
    </Modal>
  )
}

function MoverModal({
  abierto,
  mesaActual,
  mesas,
  zonas,
  ocupadas,
  onCerrar,
  onElegir,
}: {
  abierto: boolean
  mesaActual: Mesa
  mesas: Mesa[]
  zonas: Zona[]
  ocupadas: Map<number, Comanda>
  onCerrar: () => void
  onElegir: (mesaId: number) => Promise<string | null>
}) {
  const [error, setError] = useState('')
  return (
    <Modal abierto={abierto} titulo={`Mover la ${textoMesa(mesaActual.tipo, mesaActual.numero)}`} onCerrar={onCerrar}>
      <p className="mb-4 text-sm text-suave">Elige una mesa libre. La comanda pasa entera a la nueva mesa.</p>
      <div className="flex flex-col gap-4">
        {zonas
          .filter((z) => z.activa)
          .map((z) => {
            const libres = mesas.filter((m) => m.zona_id === z.id && m.activa && !ocupadas.has(m.id))
            if (libres.length === 0) return null
            return (
              <div key={z.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-suave">{z.nombre}</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
                  {libres.map((m) => (
                    <button
                      key={m.id}
                      onClick={async () => setError((await onElegir(m.id)) ?? '')}
                      className="flex justify-center rounded-xl border border-linea p-1 hover:border-oro"
                    >
                      <MesaIcono numero={m.numero} capacidad={m.capacidad} tamano={58} />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        <Aviso>{error}</Aviso>
      </div>
    </Modal>
  )
}
