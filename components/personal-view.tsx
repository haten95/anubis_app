'use client'

import clsx from 'clsx'
import { CheckCircle2, Circle, Clock, LogIn, LogOut } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { euros } from '@/lib/format'
import { diasSemana, isoDia, fechaLarga, formatoHoras, horaCorta, horaDe, horasEntre, horasTurno, hoyIso, lunesDe, nombreMes } from '@/lib/fechas'
import { FUNCIONES, type Fichaje, type Nomina, type Tarea, type Turno, type Usuario } from '@/lib/types'
import { Aviso, Boton, Cargando, Etiqueta, Panel, Titulo, Vacio } from './ui'
import { CuadranteView } from './cuadrante-view'
import { TareasView } from './tareas-view'
import { FichajesView } from './fichajes-view'
import { NominasView } from './nominas-view'
import { EquipoView } from './equipo-view'
import { ChipFuncion, IconoFuncion } from './funcion-chip'

type Pestana = 'midia' | 'cuadrante' | 'tareas' | 'fichajes' | 'nominas' | 'cuentas'

export function PersonalView({ perfil }: { perfil: Usuario }) {
  const gestor = perfil.rol !== 'empleado'
  const [pestana, setPestana] = useState<Pestana>('midia')

  const pestanas: { id: Pestana; nombre: string }[] = [
    { id: 'midia', nombre: 'Mi día' },
    ...(gestor
      ? ([
          { id: 'cuadrante', nombre: 'Cuadrante' },
          { id: 'tareas', nombre: 'Tareas' },
          { id: 'fichajes', nombre: 'Fichajes' },
        ] as const)
      : []),
    ...(perfil.rol === 'dueno'
      ? ([
          { id: 'nominas', nombre: 'Nóminas' },
          { id: 'cuentas', nombre: 'Cuentas y roles' },
        ] as const)
      : []),
  ]

  return (
    <div className="aparecer">
      <Titulo>Personal</Titulo>
      {pestanas.length > 1 && (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {pestanas.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={clsx(
                'tactil shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
                pestana === p.id ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
              )}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}
      {pestana === 'midia' && <MiDia perfil={perfil} />}
      {pestana === 'cuadrante' && gestor && <CuadranteView />}
      {pestana === 'tareas' && gestor && <TareasView />}
      {pestana === 'fichajes' && gestor && <FichajesView esDueno={perfil.rol === 'dueno'} />}
      {pestana === 'nominas' && perfil.rol === 'dueno' && <NominasView />}
      {pestana === 'cuentas' && perfil.rol === 'dueno' && <EquipoView perfil={perfil} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Mi día: fichar, turno y función de hoy, tareas, semana y nóminas
// ---------------------------------------------------------------------
function MiDia({ perfil }: { perfil: Usuario }) {
  const hoy = hoyIso()
  const lunes = lunesDe(hoy)
  const [turnos, setTurnos] = useState<Turno[] | null>(null)
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [fichajes, setFichajes] = useState<Fichaje[]>([])
  const [nominas, setNominas] = useState<Nomina[]>([])
  const [error, setError] = useState('')
  const [fichando, setFichando] = useState(false)
  const [, setReloj] = useState(0)

  const cargar = useCallback(async () => {
    const supabase = getSupabase()
    const domingo = diasSemana(lunes)[6]
    const [t, ta, f, n] = await Promise.all([
      supabase.from('turnos').select('*').eq('usuario_id', perfil.id).gte('fecha', lunes).lte('fecha', domingo).order('fecha').order('inicio'),
      supabase.from('tareas').select('*').eq('usuario_id', perfil.id).eq('fecha', hoy).order('id'),
      supabase.from('fichajes').select('*').eq('usuario_id', perfil.id).order('entrada', { ascending: false }).limit(10),
      supabase.from('nominas').select('*').eq('usuario_id', perfil.id).order('mes', { ascending: false }).limit(6),
    ])
    const err = t.error ?? ta.error ?? f.error ?? n.error
    setError(err ? mensajeError(err) : '')
    setTurnos((t.data as Turno[]) ?? [])
    setTareas((ta.data as Tarea[]) ?? [])
    setFichajes((f.data as Fichaje[]) ?? [])
    setNominas(((n.data as Nomina[]) ?? []).map((x) => ({ ...x, bruto: Number(x.bruto), neto: Number(x.neto), horas: Number(x.horas) })))
  }, [perfil.id, hoy, lunes])

  useEffect(() => {
    cargar()
    const supabase = getSupabase()
    const canal = supabase
      .channel('mi-dia')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas', filter: `usuario_id=eq.${perfil.id}` }, () => cargar())
      .subscribe()
    const t = setInterval(() => setReloj((x) => x + 1), 30000)
    return () => {
      supabase.removeChannel(canal)
      clearInterval(t)
    }
  }, [cargar, perfil.id])

  if (turnos === null) return <Cargando />

  const abierto = fichajes.find((f) => !f.salida) ?? null
  const turnosHoy = turnos.filter((t) => t.fecha === hoy)
  const horasHoy = fichajes
    .filter((f) => isoDia(new Date(f.entrada)) === hoy || !f.salida)
    .reduce((t, f) => t + horasEntre(f.entrada, f.salida), 0)

  async function fichar() {
    setFichando(true)
    const { error } = await rpc('fichar', {})
    setFichando(false)
    if (error) setError(error)
    cargar()
  }

  async function marcar(t: Tarea) {
    setTareas(tareas.map((x) => (x.id === t.id ? { ...x, hecha: !x.hecha } : x)))
    const { error } = await rpc('marcar_tarea', { p_tarea: t.id, p_hecha: !t.hecha })
    if (error) setError(error)
    cargar()
  }

  return (
    <div className="flex flex-col gap-5">
      <Aviso>{error}</Aviso>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Fichaje */}
        <Panel className={clsx(abierto ? 'border-ok/40' : '')}>
          <p className="text-sm text-suave">{fechaLarga(hoy)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <p className={clsx('font-display text-2xl', abierto ? 'text-ok' : 'text-texto')}>
                {abierto ? 'Trabajando' : 'Fuera de turno'}
              </p>
              <p className="text-sm text-suave">
                {abierto ? `Entrada a las ${horaDe(abierto.entrada)} · llevas ${formatoHoras(horasEntre(abierto.entrada, null))}` : 'Ficha al empezar y al terminar tu jornada.'}
              </p>
            </div>
            <Boton variante={abierto ? 'secundario' : 'oro'} className="w-full px-6 py-4 text-base sm:w-auto" onClick={fichar} disabled={fichando}>
              {abierto ? <LogOut size={20} /> : <LogIn size={20} />}
              {abierto ? 'Fichar salida' : 'Fichar entrada'}
            </Boton>
          </div>
          {horasHoy > 0 && !abierto && <p className="mt-3 text-xs text-suave">Hoy: {formatoHoras(horasHoy)} fichadas.</p>}
        </Panel>

        {/* Turno de hoy */}
        <Panel>
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg">
            <Clock size={18} className="text-oro" /> Tu turno de hoy
          </h3>
          {turnosHoy.length === 0 ? (
            <p className="text-sm text-suave">Hoy no tienes turno asignado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {turnosHoy.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-fondo/50 px-4 py-3">
                  <span className="font-display text-xl">
                    {horaCorta(t.inicio)} – {horaCorta(t.fin)}
                  </span>
                  {t.funcion ? (
                    <span
                      className={clsx('inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-semibold', FUNCIONES[t.funcion].clase)}
                    >
                      <IconoFuncion funcion={t.funcion} size={18} /> {FUNCIONES[t.funcion].nombre}
                    </span>
                  ) : null}
                  {t.notas && <span className="w-full text-sm text-suave">{t.notas}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Tareas */}
      <Panel>
        <h3 className="mb-3 font-display text-lg">Tus tareas de hoy</h3>
        {tareas.length === 0 ? (
          <Vacio>No tienes tareas asignadas para hoy.</Vacio>
        ) : (
          <ul className="flex flex-col gap-2">
            {tareas.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => marcar(t)}
                  className={clsx(
                    'tactil flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                    t.hecha ? 'border-ok/30 bg-ok/5 text-suave line-through' : 'border-linea bg-fondo/40 hover:border-oro-oscuro',
                  )}
                >
                  {t.hecha ? <CheckCircle2 size={22} className="shrink-0 text-ok" /> : <Circle size={22} className="shrink-0 text-suave" />}
                  {t.descripcion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Semana */}
        <Panel>
          <h3 className="mb-3 font-display text-lg">Tu semana</h3>
          <ul className="divide-y divide-linea">
            {diasSemana(lunes).map((d) => {
              const delDia = turnos.filter((t) => t.fecha === d)
              return (
                <li key={d} className={clsx('flex flex-wrap items-center gap-2 py-2 text-sm', d === hoy && 'font-semibold')}>
                  <span className={clsx('w-28', d === hoy ? 'text-oro-claro' : 'text-suave')}>{fechaLarga(d, true)}</span>
                  {delDia.length === 0 ? (
                    <span className="text-suave/60">Libre</span>
                  ) : (
                    delDia.map((t) => (
                      <span key={t.id} className="flex items-center gap-2">
                        {horaCorta(t.inicio)}–{horaCorta(t.fin)}
                        <ChipFuncion funcion={t.funcion} />
                      </span>
                    ))
                  )}
                  {delDia.length > 0 && (
                    <span className="ml-auto text-xs text-suave">{formatoHoras(delDia.reduce((h, t) => h + horasTurno(t.inicio, t.fin), 0))}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>

        {/* Nóminas */}
        <Panel>
          <h3 className="mb-3 font-display text-lg">Tus nóminas</h3>
          {nominas.length === 0 ? (
            <p className="text-sm text-suave">Todavía no hay nóminas.</p>
          ) : (
            <ul className="divide-y divide-linea">
              {nominas.map((n) => (
                <li key={n.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1">{nombreMes(n.mes)}</span>
                  <span className="text-suave">{formatoHoras(n.horas)}</span>
                  <span className="font-display text-oro-claro">{euros(n.neto)}</span>
                  <Etiqueta tono={n.estado === 'pagada' ? 'ok' : 'neutro'}>{n.estado === 'pagada' ? 'Pagada' : 'Pendiente'}</Etiqueta>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-suave">Importes orientativos. La nómina oficial te la da la gestoría.</p>
        </Panel>
      </div>
    </div>
  )
}
