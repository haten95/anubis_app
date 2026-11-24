'use client'

import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Download, Pencil } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { useEquipo } from '@/lib/use-equipo'
import { descargarCsv } from '@/lib/csv'
import { aInputLocal, deIso, diasSemana, fechaLarga, formatoHoras, horaDe, horasEntre, horasTurno, hoyIso, isoDia, lunesDe, sumarDias } from '@/lib/fechas'
import type { Fichaje, Turno } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Panel, Vacio } from './ui'

export function FichajesView({ esDueno }: { esDueno: boolean }) {
  const equipo = useEquipo()
  const [lunes, setLunes] = useState(lunesDe(hoyIso()))
  const [fichajes, setFichajes] = useState<Fichaje[] | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [corrigiendo, setCorrigiendo] = useState<Fichaje | null>(null)
  const [error, setError] = useState('')

  const dias = diasSemana(lunes)

  const cargar = useCallback(async () => {
    const supabase = getSupabase()
    const desde = deIso(lunes)
    const hasta = deIso(sumarDias(lunes, 7))
    const [f, t] = await Promise.all([
      supabase.from('fichajes').select('*').gte('entrada', desde.toISOString()).lt('entrada', hasta.toISOString()).order('entrada'),
      supabase.from('turnos').select('*').gte('fecha', lunes).lte('fecha', sumarDias(lunes, 6)),
    ])
    const err = f.error ?? t.error
    if (err) setError(mensajeError(err))
    // Las jornadas abiertas de antes de esta semana también se muestran
    const abiertas = await supabase.from('fichajes').select('*').is('salida', null)
    const todas = new Map<number, Fichaje>()
    for (const x of [...((f.data as Fichaje[]) ?? []), ...((abiertas.data as Fichaje[]) ?? [])]) todas.set(x.id, x)
    setFichajes([...todas.values()].sort((a, b) => a.entrada.localeCompare(b.entrada)))
    setTurnos((t.data as Turno[]) ?? [])
  }, [lunes])

  useEffect(() => {
    cargar()
    const supabase = getSupabase()
    const canal = supabase
      .channel('fichajes-gestion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fichajes' }, () => cargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [cargar])

  if (!equipo || fichajes === null) return <Cargando />

  const nombre = (id: string) => equipo.find((u) => u.id === id)?.nombre ?? '—'
  const trabajando = fichajes.filter((f) => !f.salida)

  function exportar() {
    descargarCsv(`registro-jornada-${lunes}.csv`, [
      ['Persona', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Corregido', 'Motivo de la corrección'],
      ...fichajes!.map((f) => [
        nombre(f.usuario_id),
        isoDia(new Date(f.entrada)),
        horaDe(f.entrada),
        f.salida ? `${isoDia(new Date(f.salida))} ${horaDe(f.salida)}` : '',
        horasEntre(f.entrada, f.salida),
        f.editado_en ? 'Sí' : 'No',
        f.motivo_edicion,
      ]),
    ])
  }

  return (
    <div className="flex flex-col gap-4">
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
        <Boton variante="fantasma" className="ml-auto" onClick={exportar} disabled={fichajes.length === 0}>
          <Download size={16} /> Descargar registro (CSV)
        </Boton>
      </div>

      <Aviso>{error}</Aviso>

      <Panel>
        <h3 className="mb-2 font-display text-lg">Ahora trabajando</h3>
        {trabajando.length === 0 ? (
          <p className="text-sm text-suave">Nadie ha fichado entrada.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trabajando.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-3 py-1.5 text-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
                {nombre(f.usuario_id)} · desde {horaDe(f.entrada)} ({formatoHoras(horasEntre(f.entrada, null))})
              </span>
            ))}
          </div>
        )}
      </Panel>

      {/* Resumen semanal por persona: fichado frente a planificado */}
      <Panel className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-linea text-left text-xs uppercase tracking-widest text-suave">
                <th className="px-3 py-3 font-semibold sm:px-4">Persona</th>
                <th className="px-2 py-3 text-right font-semibold sm:px-4">Planificado</th>
                <th className="px-2 py-3 text-right font-semibold sm:px-4">Fichado</th>
                <th className="px-2 py-3 text-right font-semibold sm:px-4">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {equipo.map((u) => {
                const plan = turnos.filter((t) => t.usuario_id === u.id).reduce((h, t) => h + horasTurno(t.inicio, t.fin), 0)
                const real = fichajes.filter((f) => f.usuario_id === u.id).reduce((h, f) => h + horasEntre(f.entrada, f.salida), 0)
                if (plan === 0 && real === 0) return null
                const dif = Math.round((real - plan) * 100) / 100
                return (
                  <tr key={u.id}>
                    <td className="px-3 py-2.5 font-semibold sm:px-4">{u.nombre}</td>
                    <td className="px-2 py-2.5 text-right sm:px-4">{formatoHoras(plan)}</td>
                    <td className="px-2 py-2.5 text-right sm:px-4">{formatoHoras(real)}</td>
                    <td className={clsx('px-2 py-2.5 text-right sm:px-4', Math.abs(dif) < 0.25 ? 'text-suave' : dif > 0 ? 'text-oro-claro' : 'text-peligro')}>
                      {Math.abs(dif) < 0.25 ? '—' : `${dif > 0 ? '+' : '−'}${formatoHoras(Math.abs(dif))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {fichajes.length === 0 ? (
        <Vacio>No hay fichajes esta semana.</Vacio>
      ) : (
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y divide-linea">
            {fichajes.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="w-32 font-semibold">{nombre(f.usuario_id)}</span>
                <span className="w-28 text-suave">{fechaLarga(isoDia(new Date(f.entrada)), true)}</span>
                <span>
                  {horaDe(f.entrada)} → {f.salida ? horaDe(f.salida) : <span className="text-ok">en curso</span>}
                </span>
                <span className="ml-auto font-display">{formatoHoras(horasEntre(f.entrada, f.salida))}</span>
                {f.editado_en && (
                  <span title={f.motivo_edicion ?? ''}>
                    <Etiqueta tono="oro">Corregido</Etiqueta>
                  </span>
                )}
                {esDueno && (
                  <button onClick={() => setCorrigiendo(f)} className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto" aria-label="Corregir fichaje">
                    <Pencil size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-xs text-suave">
        El registro de jornada es obligatorio y hay que conservarlo 4 años. Las correcciones quedan registradas con su motivo.
      </p>

      <Modal abierto={corrigiendo !== null} titulo={`Corregir fichaje · ${corrigiendo ? nombre(corrigiendo.usuario_id) : ''}`} onCerrar={() => setCorrigiendo(null)}>
        {corrigiendo && (
          <FormCorreccion
            key={corrigiendo.id}
            fichaje={corrigiendo}
            onHecho={() => {
              setCorrigiendo(null)
              cargar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function FormCorreccion({ fichaje, onHecho }: { fichaje: Fichaje; onHecho: () => void }) {
  const [entrada, setEntrada] = useState(aInputLocal(fichaje.entrada))
  const [salida, setSalida] = useState(fichaje.salida ? aInputLocal(fichaje.salida) : '')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!motivo.trim()) return setError('Indica el motivo de la corrección.')
    const { error } = await rpc('corregir_fichaje', {
      p_fichaje: fichaje.id,
      p_entrada: new Date(entrada).toISOString(),
      p_salida: salida ? new Date(salida).toISOString() : null,
      p_motivo: motivo,
    })
    if (error) return setError(error)
    onHecho()
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Entrada">
          <Entrada type="datetime-local" value={entrada} onChange={(e) => setEntrada(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Salida" ayuda="Vacío si sigue trabajando">
          <Entrada type="datetime-local" value={salida} onChange={(e) => setSalida(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Motivo">
        <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Olvidó fichar la salida…" />
      </Campo>
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro">
        Guardar corrección
      </Boton>
    </form>
  )
}
