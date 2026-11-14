'use client'

import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { useEquipo } from '@/lib/use-equipo'
import { diasSemana, fechaLarga, formatoHoras, horaCorta, horasTurno, hoyIso, lunesDe, sumarDias } from '@/lib/fechas'
import { FUNCIONES, NOMBRE_ROL, type FuncionTurno, type Turno, type Usuario } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Modal, Selector, Vacio } from './ui'
import { ChipFuncion, IconoFuncion } from './funcion-chip'

const HORARIOS_RAPIDOS: [string, string][] = [
  ['17:00', '23:00'],
  ['18:00', '02:00'],
  ['20:00', '03:00'],
  ['12:00', '18:00'],
]

type Edicion = { turno: Turno | null; usuarioId: string; fecha: string }

export function CuadranteView() {
  const equipo = useEquipo()
  const [lunes, setLunes] = useState(lunesDe(hoyIso()))
  const [turnos, setTurnos] = useState<Turno[] | null>(null)
  const [editando, setEditando] = useState<Edicion | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const dias = diasSemana(lunes)
  const hoy = hoyIso()

  const cargar = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('turnos')
      .select('*')
      .gte('fecha', lunes)
      .lte('fecha', sumarDias(lunes, 6))
      .order('inicio')
    if (error) setError(mensajeError(error))
    setTurnos((data as Turno[]) ?? [])
  }, [lunes])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function copiarSemanaAnterior() {
    setError('')
    setInfo('')
    const supabase = getSupabase()
    const anterior = sumarDias(lunes, -7)
    const { data, error } = await supabase.from('turnos').select('*').gte('fecha', anterior).lte('fecha', sumarDias(anterior, 6))
    if (error) return setError(mensajeError(error))
    const origen = (data as Turno[]) ?? []
    if (origen.length === 0) return setInfo('La semana anterior no tiene turnos.')
    if ((turnos?.length ?? 0) > 0 && !confirm('Esta semana ya tiene turnos. ¿Añadir también los de la semana anterior?')) return
    const { error: e2 } = await supabase.from('turnos').insert(
      origen.map((t) => ({ usuario_id: t.usuario_id, fecha: sumarDias(t.fecha, 7), inicio: t.inicio, fin: t.fin, funcion: t.funcion, notas: t.notas })),
    )
    if (e2) return setError(mensajeError(e2))
    setInfo(`Copiados ${origen.length} turnos.`)
    cargar()
  }

  if (!equipo || turnos === null) return <Cargando />

  const hoyTrabajan = turnos.filter((t) => t.fecha === hoy)

  return (
    <div className="flex flex-col gap-4">
      {/* Navegación de semana */}
      <div className="flex flex-wrap items-center gap-2">
        <Boton className="px-3" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">
          <ChevronLeft size={18} />
        </Boton>
        <p className="min-w-52 text-center font-semibold">
          {fechaLarga(dias[0], true)} – {fechaLarga(dias[6], true)}
        </p>
        <Boton className="px-3" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">
          <ChevronRight size={18} />
        </Boton>
        {lunes !== lunesDe(hoy) && (
          <Boton variante="fantasma" onClick={() => setLunes(lunesDe(hoy))}>
            Esta semana
          </Boton>
        )}
        <Boton variante="fantasma" className="ml-auto" onClick={copiarSemanaAnterior}>
          <Copy size={16} /> Copiar semana anterior
        </Boton>
      </div>

      <Aviso>{error}</Aviso>
      <Aviso tono="ok">{info}</Aviso>

      {/* Hoy */}
      {lunes === lunesDe(hoy) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-linea bg-panel/80 px-4 py-3 text-sm">
          <span className="font-semibold text-oro-claro">Hoy:</span>
          {hoyTrabajan.length === 0
            ? <span className="text-suave">nadie tiene turno.</span>
            : hoyTrabajan.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1.5">
                  {equipo.find((u) => u.id === t.usuario_id)?.nombre ?? '—'}
                  <ChipFuncion funcion={t.funcion} />
                </span>
              ))}
        </div>
      )}

      {equipo.length === 0 ? (
        <Vacio>No hay personas activas en el equipo.</Vacio>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[860px] border-separate border-spacing-1.5 text-sm">
            <thead>
              <tr>
                <th className="w-40 text-left text-xs font-semibold uppercase tracking-widest text-suave">Persona</th>
                {dias.map((d) => (
                  <th key={d} className={clsx('text-left text-xs font-semibold', d === hoy ? 'text-oro-claro' : 'text-suave')}>
                    {fechaLarga(d, true)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipo.map((u) => {
                const suyos = turnos.filter((t) => t.usuario_id === u.id)
                const horas = suyos.reduce((h, t) => h + horasTurno(t.inicio, t.fin), 0)
                return (
                  <tr key={u.id}>
                    <td className="align-top">
                      <p className="font-semibold">{u.nombre}</p>
                      <p className="text-[11px] text-suave">
                        {NOMBRE_ROL[u.rol]} · {formatoHoras(horas)}
                      </p>
                    </td>
                    {dias.map((d) => {
                      const delDia = suyos.filter((t) => t.fecha === d)
                      return (
                        <td key={d} className={clsx('rounded-xl border align-top', d === hoy ? 'border-oro/40 bg-oro/5' : 'border-linea bg-panel/60')}>
                          <div className="flex min-h-16 flex-col gap-1 p-1.5">
                            {delDia.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => setEditando({ turno: t, usuarioId: u.id, fecha: d })}
                                className={clsx(
                                  'rounded-lg border px-2 py-1 text-left text-xs transition hover:brightness-125',
                                  t.funcion ? FUNCIONES[t.funcion].clase : 'border-linea bg-panel-2 text-texto',
                                )}
                              >
                                <span className="block font-semibold">
                                  {horaCorta(t.inicio)}–{horaCorta(t.fin)}
                                </span>
                                {t.funcion && (
                                  <span className="flex items-center gap-1">
                                    <IconoFuncion funcion={t.funcion} size={11} /> {FUNCIONES[t.funcion].nombre}
                                  </span>
                                )}
                              </button>
                            ))}
                            <button
                              onClick={() => setEditando({ turno: null, usuarioId: u.id, fecha: d })}
                              className="flex items-center justify-center rounded-lg py-1 text-suave/60 hover:bg-panel-2 hover:text-texto"
                              aria-label={`Añadir turno a ${u.nombre} el ${fechaLarga(d)}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-suave">
        {(Object.keys(FUNCIONES) as FuncionTurno[]).map((f) => (
          <ChipFuncion key={f} funcion={f} />
        ))}
        <span>· Si la hora de fin es menor que la de inicio, el turno acaba al día siguiente.</span>
      </div>

      <Modal
        abierto={editando !== null}
        titulo={editando?.turno ? 'Editar turno' : 'Nuevo turno'}
        onCerrar={() => setEditando(null)}
      >
        {editando && (
          <FormTurno
            key={`${editando.turno?.id ?? 'nuevo'}-${editando.usuarioId}-${editando.fecha}`}
            edicion={editando}
            equipo={equipo}
            onHecho={() => {
              setEditando(null)
              cargar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function FormTurno({ edicion, equipo, onHecho }: { edicion: Edicion; equipo: Usuario[]; onHecho: () => void }) {
  const t = edicion.turno
  const [usuarioId, setUsuarioId] = useState(t?.usuario_id ?? edicion.usuarioId)
  const [fecha, setFecha] = useState(t?.fecha ?? edicion.fecha)
  const [inicio, setInicio] = useState(t ? horaCorta(t.inicio) : '18:00')
  const [fin, setFin] = useState(t ? horaCorta(t.fin) : '02:00')
  const [funcion, setFuncion] = useState<FuncionTurno | null>(t?.funcion ?? null)
  const [notas, setNotas] = useState(t?.notas ?? '')
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!inicio || !fin) return setError('Indica la hora de inicio y de fin.')
    if (inicio === fin) return setError('El inicio y el fin no pueden ser iguales.')
    const datos = { usuario_id: usuarioId, fecha, inicio, fin, funcion, notas: notas.trim() || null }
    const supabase = getSupabase()
    const { error } = t ? await supabase.from('turnos').update(datos).eq('id', t.id) : await supabase.from('turnos').insert(datos)
    if (error) return setError(mensajeError(error))
    onHecho()
  }

  async function borrar() {
    if (!t || !confirm('¿Quitar este turno?')) return
    const { error } = await getSupabase().from('turnos').delete().eq('id', t.id)
    if (error) return setError(mensajeError(error))
    onHecho()
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Persona">
          <Selector value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            {equipo.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Día">
          <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Entrada">
          <Entrada type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Salida">
          <Entrada type="time" value={fin} onChange={(e) => setFin(e.target.value)} required />
        </Campo>
      </div>
      <div className="flex flex-wrap gap-2">
        {HORARIOS_RAPIDOS.map(([a, b]) => (
          <button
            key={a + b}
            type="button"
            onClick={() => {
              setInicio(a)
              setFin(b)
            }}
            className="rounded-full border border-linea px-3 py-1.5 text-xs text-suave hover:text-texto"
          >
            {a}–{b}
          </button>
        ))}
        {inicio && fin && inicio !== fin && <span className="self-center text-xs text-suave">· {formatoHoras(horasTurno(inicio, fin))}</span>}
      </div>

      <Campo etiqueta="Función ese día">
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(FUNCIONES) as FuncionTurno[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFuncion(f)}
              className={clsx(
                'tactil flex flex-col items-center gap-1 rounded-xl border py-2.5 text-sm font-semibold transition',
                funcion === f ? FUNCIONES[f].clase : 'border-linea text-suave',
              )}
            >
              <IconoFuncion funcion={f} size={18} />
              {FUNCIONES[f].nombre}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFuncion(null)}
            className={clsx('tactil rounded-xl border py-2.5 text-sm font-semibold', funcion === null ? 'border-oro bg-oro/10 text-oro-claro' : 'border-linea text-suave')}
          >
            Sin función
          </button>
        </div>
      </Campo>

      <Campo etiqueta="Nota (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={200} placeholder="Abre el local, cierra caja…" />
      </Campo>

      <Aviso>{error}</Aviso>
      <div className="flex justify-between gap-2">
        {t ? (
          <Boton type="button" variante="peligro" onClick={borrar}>
            <Trash2 size={16} /> Quitar
          </Boton>
        ) : (
          <span />
        )}
        <Boton type="submit" variante="oro">
          Guardar
        </Boton>
      </div>
    </form>
  )
}
