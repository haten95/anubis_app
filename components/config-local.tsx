'use client'

import { ArrowDown, ArrowUp, Pencil, Plus, Sofa, Sun, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { useLocal } from '@/lib/use-local'
import { NOMBRE_TIPO_ZONA, type AjustesLocal, type Mesa, type TipoZona, type Zona } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Interruptor, Modal, Panel, Selector, Titulo, Vacio } from './ui'
import { MesaIcono } from './mesa-icono'

export function ConfigLocal() {
  const { zonas, mesas, error: errorCarga, recargar } = useLocal()
  const [error, setError] = useState('')
  const [editandoZona, setEditandoZona] = useState<Zona | 'nueva' | null>(null)
  const [editandoMesa, setEditandoMesa] = useState<Mesa | null>(null)

  if (zonas === null) return <Cargando />

  async function ejecutar(accion: () => PromiseLike<{ error: { message?: string; code?: string } | null }>) {
    setError('')
    const { error } = await accion()
    const mensaje = error ? mensajeError(error) : null
    if (mensaje) setError(mensaje)
    await recargar()
    return mensaje
  }

  async function mover(zona: Zona, dir: -1 | 1) {
    const idx = zonas!.findIndex((z) => z.id === zona.id)
    const otra = zonas![idx + dir]
    if (!otra) return
    const supabase = getSupabase()
    // Reasigna el orden de todas para que sea consecutivo y luego intercambia
    const orden = zonas!.map((z) => z.id)
    ;[orden[idx], orden[idx + dir]] = [orden[idx + dir], orden[idx]]
    await ejecutar(async () => {
      for (let i = 0; i < orden.length; i++) {
        const { error } = await supabase.from('zonas').update({ orden: i }).eq('id', orden[i])
        if (error) return { error }
      }
      return { error: null }
    })
  }

  const totalMesas = mesas.filter((m) => m.activa).length

  return (
    <div className="aparecer">
      <Titulo
        accion={
          <Boton variante="oro" onClick={() => setEditandoZona('nueva')}>
            <Plus size={16} /> Nueva zona
          </Boton>
        }
      >
        Configuración del local
      </Titulo>
      <p className="-mt-2 mb-5 text-sm text-suave">
        {zonas.length} {zonas.length === 1 ? 'zona' : 'zonas'} · {totalMesas} mesas activas. Las mesas se numeran
        seguidas entre todas las salas interiores, y aparte entre todas las terrazas.
      </p>

      <div className="mb-4 flex flex-col gap-2">
        <Aviso>{errorCarga || error}</Aviso>
      </div>

      {zonas.length === 0 ? (
        <Vacio>Empieza creando una sala interior o una terraza.</Vacio>
      ) : (
        <div className="flex flex-col gap-4">
          {zonas.map((zona, i) => (
            <ZonaPanel
              key={zona.id}
              zona={zona}
              mesas={mesas.filter((m) => m.zona_id === zona.id)}
              primera={i === 0}
              ultima={i === zonas.length - 1}
              onMover={(dir) => mover(zona, dir)}
              onEditar={() => setEditandoZona(zona)}
              onEditarMesa={setEditandoMesa}
              ejecutar={ejecutar}
            />
          ))}
        </div>
      )}

      <AjustesTicket />

      <ZonaModal
        zona={editandoZona}
        siguienteOrden={zonas.length}
        onCerrar={() => setEditandoZona(null)}
        ejecutar={ejecutar}
      />
      <MesaModal mesa={editandoMesa} zonas={zonas} onCerrar={() => setEditandoMesa(null)} ejecutar={ejecutar} />
    </div>
  )
}

/** Ejecuta una operación, recarga los datos y devuelve el mensaje de error (o null si fue bien) */
type Ejecutar = (accion: () => PromiseLike<{ error: { message?: string; code?: string } | null }>) => Promise<string | null>

function ZonaPanel({
  zona,
  mesas,
  primera,
  ultima,
  onMover,
  onEditar,
  onEditarMesa,
  ejecutar,
}: {
  zona: Zona
  mesas: Mesa[]
  primera: boolean
  ultima: boolean
  onMover: (dir: -1 | 1) => void
  onEditar: () => void
  onEditarMesa: (m: Mesa) => void
  ejecutar: Ejecutar
}) {
  const [cantidad, setCantidad] = useState('1')
  const [creando, setCreando] = useState(false)

  async function anadirMesas(e: FormEvent) {
    e.preventDefault()
    const n = Number(cantidad)
    if (!Number.isInteger(n) || n < 1 || n > 100) return
    setCreando(true)
    await ejecutar(() => getSupabase().rpc('crear_mesas', { p_zona_id: zona.id, p_cantidad: n }))
    setCreando(false)
    setCantidad('1')
  }

  const Icono = zona.tipo === 'terraza' ? Sun : Sofa

  return (
    <Panel className={zona.activa ? '' : 'opacity-70'}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${zona.tipo === 'terraza' ? 'bg-terraza/15 text-terraza' : 'bg-oro/15 text-oro'}`}
        >
          <Icono size={20} />
        </span>
        <div className="mr-auto min-w-0">
          <h3 className="truncate font-display text-lg text-texto">{zona.nombre}</h3>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <Etiqueta tono={zona.tipo === 'terraza' ? 'terraza' : 'oro'}>{NOMBRE_TIPO_ZONA[zona.tipo]}</Etiqueta>
            <Etiqueta>{mesas.length} mesas</Etiqueta>
            {!zona.activa && <Etiqueta tono="peligro">Desactivada</Etiqueta>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" className="px-2.5" disabled={primera} onClick={() => onMover(-1)} aria-label="Subir zona">
            <ArrowUp size={16} />
          </Boton>
          <Boton variante="fantasma" className="px-2.5" disabled={ultima} onClick={() => onMover(1)} aria-label="Bajar zona">
            <ArrowDown size={16} />
          </Boton>
          <Boton variante="fantasma" className="px-2.5" onClick={onEditar} aria-label="Editar zona">
            <Pencil size={16} />
          </Boton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
        {mesas.map((m) => (
          <button
            key={m.id}
            onClick={() => onEditarMesa(m)}
            className="flex flex-col items-center rounded-xl border border-transparent p-1 pb-2 transition hover:border-linea hover:bg-panel-2"
            title={`Editar mesa ${m.numero}`}
          >
            <MesaIcono numero={m.numero} capacidad={m.capacidad} inactiva={!m.activa} tamano={72} />
            <span className="text-[11px] text-suave">
              {m.activa ? (m.capacidad ? `${m.capacidad} pers.` : 'Editar') : 'Inactiva'}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={anadirMesas} className="mt-4 flex flex-wrap items-end gap-2 border-t border-linea pt-4">
        <Campo etiqueta="Añadir mesas">
          <Entrada
            type="number"
            min={1}
            max={100}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-24"
            aria-label="Cantidad de mesas a añadir"
          />
        </Campo>
        <Boton type="submit" disabled={creando}>
          <Plus size={16} /> {creando ? 'Creando…' : 'Añadir'}
        </Boton>
        <span className="pb-3 text-xs text-suave">
          Se numeran a partir del siguiente número libre {zona.tipo === 'terraza' ? 'de las terrazas' : 'de las salas'}.
        </span>
      </form>
    </Panel>
  )
}

function ZonaModal({
  zona,
  siguienteOrden,
  onCerrar,
  ejecutar,
}: {
  zona: Zona | 'nueva' | null
  siguienteOrden: number
  onCerrar: () => void
  ejecutar: Ejecutar
}) {
  const nueva = zona === 'nueva'
  const existente = zona && zona !== 'nueva' ? zona : null
  return (
    <Modal abierto={zona !== null} titulo={nueva ? 'Nueva zona' : 'Editar zona'} onCerrar={onCerrar}>
      {zona !== null && (
        <FormZona
          key={existente?.id ?? 'nueva'}
          zona={existente}
          onGuardar={async (datos) => {
            const supabase = getSupabase()
            const err = await ejecutar(() =>
              existente
                ? supabase.from('zonas').update(datos).eq('id', existente.id)
                : supabase.from('zonas').insert({ ...datos, orden: siguienteOrden }),
            )
            if (!err) onCerrar()
            return err
          }}
          onBorrar={
            existente
              ? async () => {
                  if (!confirm(`¿Borrar la zona «${existente.nombre}»? Solo se puede si no tiene mesas.`)) return
                  const err = await ejecutar(() => getSupabase().from('zonas').delete().eq('id', existente.id))
                  if (!err) onCerrar()
                  return err
                }
              : undefined
          }
        />
      )}
    </Modal>
  )
}

function FormZona({
  zona,
  onGuardar,
  onBorrar,
}: {
  zona: Zona | null
  onGuardar: (d: { nombre: string; tipo: TipoZona; activa: boolean }) => Promise<string | null>
  onBorrar?: () => Promise<string | null | undefined>
}) {
  const [nombre, setNombre] = useState(zona?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoZona>(zona?.tipo ?? 'interior')
  const [activa, setActiva] = useState(zona?.activa ?? true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!nombre.trim()) return
        setGuardando(true)
        setError((await onGuardar({ nombre: nombre.trim(), tipo, activa })) ?? '')
        setGuardando(false)
      }}
    >
      <Campo etiqueta="Tipo">
        <div className="grid grid-cols-2 gap-2">
          {(['interior', 'terraza'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`tactil flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                tipo === t ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave'
              }`}
            >
              {t === 'terraza' ? <Sun size={16} /> : <Sofa size={16} />}
              {NOMBRE_TIPO_ZONA[t]}
            </button>
          ))}
        </div>
      </Campo>
      <Campo etiqueta="Nombre">
        <Entrada
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={tipo === 'terraza' ? 'Terraza 1' : 'Sala principal'}
          maxLength={60}
          required
          autoFocus
        />
      </Campo>
      {zona && (
        <div className="flex items-center justify-between rounded-xl bg-fondo/50 px-3.5 py-3">
          <span className="text-sm">
            Zona activa
            <span className="block text-xs text-suave">Si la desactivas, deja de verse en la sala.</span>
          </span>
          <Interruptor activo={activa} onCambio={setActiva} etiqueta="Zona activa" />
        </div>
      )}
      <Aviso>{error}</Aviso>
      <div className="flex flex-wrap justify-between gap-2 pt-1">
        {onBorrar ? (
          <Boton type="button" variante="peligro" onClick={async () => setError((await onBorrar()) ?? '')}>
            <Trash2 size={16} /> Borrar
          </Boton>
        ) : (
          <span />
        )}
        <Boton type="submit" variante="oro" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </form>
  )
}

function MesaModal({
  mesa,
  zonas,
  onCerrar,
  ejecutar,
}: {
  mesa: Mesa | null
  zonas: Zona[]
  onCerrar: () => void
  ejecutar: Ejecutar
}) {
  return (
    <Modal abierto={mesa !== null} titulo={mesa ? `Mesa ${mesa.numero}` : ''} onCerrar={onCerrar}>
      {mesa && <FormMesa key={mesa.id} mesa={mesa} zonas={zonas} ejecutar={ejecutar} onCerrar={onCerrar} />}
    </Modal>
  )
}

function FormMesa({ mesa, zonas, ejecutar, onCerrar }: { mesa: Mesa; zonas: Zona[]; ejecutar: Ejecutar; onCerrar: () => void }) {
  const [numero, setNumero] = useState(String(mesa.numero))
  const [capacidad, setCapacidad] = useState(mesa.capacidad ? String(mesa.capacidad) : '')
  const [zonaId, setZonaId] = useState(mesa.zona_id)
  const [activa, setActiva] = useState(mesa.activa)
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const n = Number(numero)
    const cap = capacidad === '' ? null : Number(capacidad)
    if (!Number.isInteger(n) || n < 1 || n > 999) return setError('El número debe estar entre 1 y 999.')
    if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 50)) return setError('La capacidad debe estar entre 1 y 50.')
    const err = await ejecutar(() =>
      getSupabase().from('mesas').update({ numero: n, capacidad: cap, zona_id: zonaId, activa }).eq('id', mesa.id),
    )
    if (err) setError(err)
    else onCerrar()
  }

  async function borrar() {
    if (!confirm(`¿Borrar la mesa ${mesa.numero}? Si ya tiene historial, mejor desactívala.`)) return
    const err = await ejecutar(() => getSupabase().from('mesas').delete().eq('id', mesa.id))
    if (err) setError(err)
    else onCerrar()
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="flex justify-center">
        <MesaIcono numero={Number(numero) || mesa.numero} capacidad={capacidad ? Number(capacidad) : null} inactiva={!activa} tamano={110} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Número">
          <Entrada type="number" min={1} max={999} value={numero} onChange={(e) => setNumero(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Personas (opcional)">
          <Entrada type="number" min={1} max={50} value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Zona">
        <Selector value={zonaId} onChange={(e) => setZonaId(Number(e.target.value))}>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre} ({NOMBRE_TIPO_ZONA[z.tipo]})
            </option>
          ))}
        </Selector>
      </Campo>
      <div className="flex items-center justify-between rounded-xl bg-fondo/50 px-3.5 py-3">
        <span className="text-sm">
          Mesa activa
          <span className="block text-xs text-suave">Las inactivas no aparecen en la sala.</span>
        </span>
        <Interruptor activo={activa} onCambio={setActiva} etiqueta="Mesa activa" />
      </div>
      <Aviso>{error}</Aviso>
      <div className="flex justify-between gap-2">
        <Boton type="button" variante="peligro" onClick={borrar}>
          <Trash2 size={16} /> Borrar
        </Boton>
        <Boton type="submit" variante="oro">
          Guardar
        </Boton>
      </div>
    </form>
  )
}

function AjustesTicket() {
  const [datos, setDatos] = useState<AjustesLocal | null>(null)
  const [estado, setEstado] = useState<{ tono: 'ok' | 'peligro'; texto: string } | null>(null)

  useEffect(() => {
    getSupabase()
      .from('ajustes_local')
      .select('*')
      .maybeSingle()
      .then(({ data }) => setDatos((data as AjustesLocal | null) ?? null))
  }, [])

  if (!datos) return null

  const campo = (clave: keyof AjustesLocal, etiqueta: string, max: number, placeholder?: string) => (
    <Campo etiqueta={etiqueta}>
      <Entrada
        value={datos[clave] ?? ''}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })}
      />
    </Campo>
  )

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const limpio = Object.fromEntries(
      Object.entries(datos!).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]),
    ) as Partial<AjustesLocal> & { id?: boolean }
    if (!limpio.nombre_comercial) return setEstado({ tono: 'peligro', texto: 'El nombre comercial es obligatorio.' })
    const { error } = await getSupabase().from('ajustes_local').update(limpio).eq('id', true)
    setEstado(error ? { tono: 'peligro', texto: mensajeError(error) } : { tono: 'ok', texto: 'Datos guardados.' })
  }

  return (
    <Panel className="mt-6">
      <h3 className="font-display text-lg">Datos del ticket</h3>
      <p className="mb-4 text-sm text-suave">Aparecen en la cabecera de cada factura simplificada.</p>
      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
        {campo('nombre_comercial', 'Nombre comercial', 80)}
        {campo('razon_social', 'Razón social', 120, 'Nombre fiscal de la empresa')}
        {campo('nif', 'NIF / CIF', 20)}
        {campo('telefono', 'Teléfono', 30)}
        <div className="sm:col-span-2">{campo('direccion', 'Dirección', 200)}</div>
        <div className="sm:col-span-2">{campo('pie_ticket', 'Pie del ticket', 200)}</div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Boton type="submit" variante="oro">
            Guardar datos
          </Boton>
          {estado && <Aviso tono={estado.tono}>{estado.texto}</Aviso>}
        </div>
      </form>
    </Panel>
  )
}
