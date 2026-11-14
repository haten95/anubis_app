'use client'

import clsx from 'clsx'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { useEquipo } from '@/lib/use-equipo'
import { fechaLarga, hoyIso, sumarDias } from '@/lib/fechas'
import type { Tarea, Turno } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Panel, Selector, Vacio } from './ui'
import { ChipFuncion } from './funcion-chip'

const SUGERENCIAS = ['Limpiar cachimbas', 'Reponer la cámara', 'Revisar el carbón', 'Inventario de tabaco', 'Limpiar baños', 'Sacar la basura']

export function TareasView() {
  const equipo = useEquipo()
  const [fecha, setFecha] = useState(hoyIso())
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const supabase = getSupabase()
    const [t, tu] = await Promise.all([
      supabase.from('tareas').select('*').eq('fecha', fecha).order('id'),
      supabase.from('turnos').select('*').eq('fecha', fecha).order('inicio'),
    ])
    const err = t.error ?? tu.error
    if (err) setError(mensajeError(err))
    setTareas((t.data as Tarea[]) ?? [])
    setTurnos((tu.data as Turno[]) ?? [])
  }, [fecha])

  useEffect(() => {
    cargar()
    const supabase = getSupabase()
    const canal = supabase
      .channel('tareas-gestion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => cargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [cargar])

  if (!equipo || tareas === null) return <Cargando />

  // Primero quien trabaja ese día
  const ordenados = [...equipo].sort(
    (a, b) => Number(turnos.some((t) => t.usuario_id === b.id)) - Number(turnos.some((t) => t.usuario_id === a.id)),
  )
  const destino = usuarioId || ordenados[0]?.id || ''

  async function anadir(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !destino) return
    const { error } = await getSupabase().from('tareas').insert({ usuario_id: destino, fecha, descripcion: texto.trim() })
    if (error) return setError(mensajeError(error))
    setTexto('')
    setError('')
    cargar()
  }

  const hechas = tareas.filter((t) => t.hecha).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Boton className="px-3" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">
          <ChevronLeft size={18} />
        </Boton>
        <p className="min-w-56 text-center font-semibold">{fechaLarga(fecha)}</p>
        <Boton className="px-3" onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">
          <ChevronRight size={18} />
        </Boton>
        {fecha !== hoyIso() && (
          <Boton variante="fantasma" onClick={() => setFecha(hoyIso())}>
            Hoy
          </Boton>
        )}
        {tareas.length > 0 && (
          <span className="ml-auto text-sm text-suave">
            {hechas}/{tareas.length} hechas
          </span>
        )}
      </div>

      <Panel>
        <form onSubmit={anadir} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <Campo etiqueta="Para">
              <Selector value={destino} onChange={(e) => setUsuarioId(e.target.value)}>
                {ordenados.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                    {turnos.some((t) => t.usuario_id === u.id) ? ' (trabaja)' : ''}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Tarea">
              <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={200} placeholder="Limpiar cachimbas…" />
            </Campo>
            <Boton type="submit" variante="oro" disabled={!texto.trim()}>
              <Plus size={16} /> Asignar
            </Boton>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" onClick={() => setTexto(s)} className="rounded-full border border-linea px-3 py-1.5 text-xs text-suave hover:text-texto">
                {s}
              </button>
            ))}
          </div>
        </form>
      </Panel>

      <Aviso>{error}</Aviso>

      {tareas.length === 0 ? (
        <Vacio>No hay tareas para este día.</Vacio>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {equipo
            .filter((u) => tareas.some((t) => t.usuario_id === u.id))
            .map((u) => (
              <Panel key={u.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg">{u.nombre}</h3>
                  {turnos
                    .filter((t) => t.usuario_id === u.id)
                    .map((t) => (
                      <ChipFuncion key={t.id} funcion={t.funcion} />
                    ))}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {tareas
                    .filter((t) => t.usuario_id === u.id)
                    .map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const { error } = await rpc('marcar_tarea', { p_tarea: t.id, p_hecha: !t.hecha })
                            if (error) setError(error)
                            cargar()
                          }}
                          className={clsx('flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-panel-2', t.hecha && 'text-suave line-through')}
                        >
                          {t.hecha ? <CheckCircle2 size={18} className="shrink-0 text-ok" /> : <Circle size={18} className="shrink-0 text-suave" />}
                          {t.descripcion}
                        </button>
                        <button
                          onClick={async () => {
                            const { error } = await getSupabase().from('tareas').delete().eq('id', t.id)
                            if (error) setError(mensajeError(error))
                            cargar()
                          }}
                          className="rounded-lg p-1.5 text-suave hover:bg-peligro/10 hover:text-peligro"
                          aria-label="Quitar tarea"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                </ul>
              </Panel>
            ))}
        </div>
      )}
    </div>
  )
}
