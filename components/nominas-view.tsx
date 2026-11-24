'use client'

import { Calculator, ChevronLeft, ChevronRight, Download, Pencil, Square, SquareCheckBig } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { useEquipo } from '@/lib/use-equipo'
import { descargarCsv } from '@/lib/csv'
import { euros, parseImporte } from '@/lib/format'
import { formatoHoras, hoyIso, nombreMes, primerDiaMes, sumarMeses } from '@/lib/fechas'
import type { DatosLaborales, Nomina, Usuario } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Panel, Vacio } from './ui'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export function NominasView() {
  const equipo = useEquipo()
  const [mes, setMes] = useState(primerDiaMes(hoyIso()))
  const [nominas, setNominas] = useState<Nomina[] | null>(null)
  const [datos, setDatos] = useState<DatosLaborales[]>([])
  const [editNomina, setEditNomina] = useState<Nomina | null>(null)
  const [editDatos, setEditDatos] = useState<Usuario | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const cargar = useCallback(async () => {
    const supabase = getSupabase()
    const [n, d] = await Promise.all([
      supabase.from('nominas').select('*').eq('mes', mes),
      supabase.from('datos_laborales').select('*'),
    ])
    const err = n.error ?? d.error
    if (err) setError(mensajeError(err))
    setNominas(
      ((n.data as Nomina[]) ?? []).map((x) => ({
        ...x,
        horas: Number(x.horas),
        bruto: Number(x.bruto),
        irpf: Number(x.irpf),
        seguridad_social: Number(x.seguridad_social),
        otras_deducciones: Number(x.otras_deducciones),
        neto: Number(x.neto),
      })),
    )
    setDatos(
      ((d.data as DatosLaborales[]) ?? []).map((x) => ({
        ...x,
        horas_semanales: num(x.horas_semanales),
        salario_base_mensual: num(x.salario_base_mensual),
        precio_hora: num(x.precio_hora),
        irpf_pct: Number(x.irpf_pct),
        seguridad_social_pct: Number(x.seguridad_social_pct),
      })),
    )
  }, [mes])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!equipo || nominas === null) return <Cargando />

  const nombre = (id: string) => equipo.find((u) => u.id === id)?.nombre ?? '—'
  const total = nominas.reduce((t, n) => ({ bruto: t.bruto + n.bruto, neto: t.neto + n.neto }), { bruto: 0, neto: 0 })

  async function generar() {
    setError('')
    setInfo('')
    const { data, error } = await rpc<number>('generar_nominas', { p_mes: mes })
    if (error) return setError(error)
    setInfo(data ? `Calculadas ${data} nóminas con las horas fichadas. Las ya pagadas no se tocan.` : 'Nadie tiene datos laborales todavía: rellénalos abajo.')
    cargar()
  }

  function exportar() {
    descargarCsv(`nominas-${mes.slice(0, 7)}.csv`, [
      ['Persona', 'Mes', 'Horas fichadas', 'Bruto', 'IRPF', 'Seguridad Social', 'Otras deducciones', 'Neto', 'Estado', 'Notas'],
      ...nominas!.map((n) => [
        nombre(n.usuario_id),
        n.mes.slice(0, 7),
        n.horas,
        n.bruto,
        n.irpf,
        n.seguridad_social,
        n.otras_deducciones,
        n.neto,
        n.estado === 'pagada' ? 'Pagada' : 'Pendiente',
        n.notas,
      ]),
    ])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Boton className="px-3" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </Boton>
        <p className="min-w-40 text-center font-semibold">{nombreMes(mes)}</p>
        <Boton className="px-3" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente">
          <ChevronRight size={18} />
        </Boton>
        <div className="ml-auto flex flex-wrap gap-2">
          <Boton variante="fantasma" onClick={exportar} disabled={nominas.length === 0}>
            <Download size={16} /> CSV para la gestoría
          </Boton>
          <Boton variante="oro" onClick={generar}>
            <Calculator size={16} /> Calcular nóminas del mes
          </Boton>
        </div>
      </div>

      <Aviso>{error}</Aviso>
      <Aviso tono="ok">{info}</Aviso>

      {nominas.length === 0 ? (
        <Vacio>No hay nóminas de {nombreMes(mes).toLowerCase()}. Pulsa «Calcular nóminas del mes».</Vacio>
      ) : (
        <>
        {/* Móvil: una ficha por persona */}
        <div className="flex flex-col gap-3 md:hidden">
          {nominas.map((n) => (
            <Panel key={n.id}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{nombre(n.usuario_id)}</p>
                  <p className="text-xs text-suave">{formatoHoras(n.horas)} fichadas</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl text-oro-claro">{euros(n.neto)}</p>
                  <p className="text-[11px] text-suave">neto</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-suave">Bruto</dt>
                <dd className="text-right">{euros(n.bruto)}</dd>
                <dt className="text-suave">IRPF</dt>
                <dd className="text-right">−{euros(n.irpf)}</dd>
                <dt className="text-suave">Seguridad Social</dt>
                <dd className="text-right">−{euros(n.seguridad_social)}</dd>
                {n.otras_deducciones > 0 && (
                  <>
                    <dt className="text-suave">Otras</dt>
                    <dd className="text-right">−{euros(n.otras_deducciones)}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex gap-2">
                <Boton
                  className="flex-1"
                  variante={n.estado === 'pagada' ? 'secundario' : 'oro'}
                  onClick={async () => {
                    const { error } = await rpc('pagar_nomina', { p_nomina: n.id, p_pagada: n.estado !== 'pagada' })
                    if (error) setError(error)
                    cargar()
                  }}
                >
                  {n.estado === 'pagada' ? <SquareCheckBig size={16} className="text-ok" /> : <Square size={16} />}
                  {n.estado === 'pagada' ? 'Pagada' : 'Marcar pagada'}
                </Boton>
                {n.estado === 'pendiente' && (
                  <Boton onClick={() => setEditNomina(n)} aria-label="Ajustar nómina">
                    <Pencil size={16} /> Ajustar
                  </Boton>
                )}
              </div>
            </Panel>
          ))}
          <p className="text-right text-sm text-suave">
            Total: bruto <strong className="text-texto">{euros(total.bruto)}</strong> · neto <strong className="text-oro-claro">{euros(total.neto)}</strong>
          </p>
        </div>

        <Panel className="hidden p-0 sm:p-0 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-xs uppercase tracking-widest text-suave">
                  <th className="px-4 py-3 font-semibold">Persona</th>
                  <th className="px-3 py-3 text-right font-semibold">Horas</th>
                  <th className="px-3 py-3 text-right font-semibold">Bruto</th>
                  <th className="px-3 py-3 text-right font-semibold">IRPF</th>
                  <th className="px-3 py-3 text-right font-semibold">S. Social</th>
                  <th className="px-3 py-3 text-right font-semibold">Otras</th>
                  <th className="px-3 py-3 text-right font-semibold">Neto</th>
                  <th className="px-3 py-3 font-semibold">Pagada</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {nominas.map((n) => (
                  <tr key={n.id}>
                    <td className="px-4 py-2.5 font-semibold">{nombre(n.usuario_id)}</td>
                    <td className="px-3 py-2.5 text-right text-suave">{formatoHoras(n.horas)}</td>
                    <td className="px-3 py-2.5 text-right">{euros(n.bruto)}</td>
                    <td className="px-3 py-2.5 text-right text-suave">{euros(n.irpf)}</td>
                    <td className="px-3 py-2.5 text-right text-suave">{euros(n.seguridad_social)}</td>
                    <td className="px-3 py-2.5 text-right text-suave">{euros(n.otras_deducciones)}</td>
                    <td className="px-3 py-2.5 text-right font-display text-oro-claro">{euros(n.neto)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={async () => {
                          const { error } = await rpc('pagar_nomina', { p_nomina: n.id, p_pagada: n.estado !== 'pagada' })
                          if (error) setError(error)
                          cargar()
                        }}
                        className="inline-flex items-center gap-1.5"
                        aria-label={n.estado === 'pagada' ? 'Marcar como pendiente' : 'Marcar como pagada'}
                      >
                        {n.estado === 'pagada' ? <SquareCheckBig size={20} className="text-ok" /> : <Square size={20} className="text-suave" />}
                      </button>
                    </td>
                    <td className="px-2 py-2.5">
                      {n.estado === 'pendiente' && (
                        <button onClick={() => setEditNomina(n)} className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto" aria-label="Ajustar nómina">
                          <Pencil size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-linea font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td />
                  <td className="px-3 py-3 text-right">{euros(total.bruto)}</td>
                  <td colSpan={3} />
                  <td className="px-3 py-3 text-right font-display text-oro-claro">{euros(total.neto)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
        </>
      )}

      <p className="text-xs text-suave">
        Cálculo orientativo: bruto = salario fijo o, si cobra por horas, horas fichadas × precio/hora; IRPF y Seguridad Social con el % de cada
        persona. La nómina oficial (cotizaciones, pagas extra, finiquitos) la calcula la gestoría con el CSV.
      </p>

      {/* Datos laborales */}
      <Panel>
        <h3 className="mb-1 font-display text-lg">Datos laborales</h3>
        <p className="mb-3 text-sm text-suave">Solo los ves tú; cada persona ve los suyos.</p>
        <ul className="divide-y divide-linea">
          {equipo.map((u) => {
            const d = datos.find((x) => x.usuario_id === u.id)
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="w-36 font-semibold">{u.nombre}</span>
                <span className="flex-1 text-suave">
                  {!d
                    ? 'Sin datos'
                    : [
                        d.tipo_contrato,
                        d.horas_semanales !== null && `${d.horas_semanales} h/semana`,
                        d.salario_base_mensual !== null ? `${euros(d.salario_base_mensual)}/mes` : d.precio_hora !== null && `${euros(d.precio_hora)}/h`,
                        `IRPF ${d.irpf_pct}%`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
                {!d && <Etiqueta tono="peligro">Falta</Etiqueta>}
                <button onClick={() => setEditDatos(u)} className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto" aria-label={`Editar datos de ${u.nombre}`}>
                  <Pencil size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Modal abierto={editNomina !== null} titulo={`Ajustar nómina · ${editNomina ? nombre(editNomina.usuario_id) : ''}`} onCerrar={() => setEditNomina(null)}>
        {editNomina && (
          <FormNomina
            key={editNomina.id}
            nomina={editNomina}
            onHecho={() => {
              setEditNomina(null)
              cargar()
            }}
          />
        )}
      </Modal>

      <Modal abierto={editDatos !== null} titulo={`Datos laborales · ${editDatos?.nombre ?? ''}`} onCerrar={() => setEditDatos(null)}>
        {editDatos && (
          <FormDatos
            key={editDatos.id}
            usuario={editDatos}
            datos={datos.find((d) => d.usuario_id === editDatos.id) ?? null}
            onHecho={() => {
              setEditDatos(null)
              cargar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}

const aTexto = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','))

function FormNomina({ nomina, onHecho }: { nomina: Nomina; onHecho: () => void }) {
  const [v, setV] = useState({
    bruto: aTexto(nomina.bruto),
    irpf: aTexto(nomina.irpf),
    seguridad_social: aTexto(nomina.seguridad_social),
    otras_deducciones: aTexto(nomina.otras_deducciones),
  })
  const [notas, setNotas] = useState(nomina.notas ?? '')
  const [error, setError] = useState('')

  const valores = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parseImporte(x || '0')])) as Record<keyof typeof v, number | null>
  const neto = Object.values(valores).some((x) => x === null) ? null : valores.bruto! - valores.irpf! - valores.seguridad_social! - valores.otras_deducciones!

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (neto === null) return setError('Revisa los importes (por ejemplo 1250,50).')
    const { error } = await getSupabase()
      .from('nominas')
      .update({ ...valores, notas: notas.trim() || null })
      .eq('id', nomina.id)
    if (error) return setError(mensajeError(error))
    onHecho()
  }

  const campo = (k: keyof typeof v, etiqueta: string) => (
    <Campo etiqueta={etiqueta}>
      <Entrada inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Campo>
  )

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {campo('bruto', 'Bruto (€)')}
        {campo('irpf', 'IRPF (€)')}
        {campo('seguridad_social', 'Seguridad Social (€)')}
        {campo('otras_deducciones', 'Otras deducciones (€)')}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-fondo/60 px-4 py-3">
        <span className="font-semibold">Neto</span>
        <span className="font-display text-2xl text-oro-claro">{neto === null ? '—' : euros(neto)}</span>
      </div>
      <Campo etiqueta="Notas">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={300} placeholder="Incluye 4 h extra del sábado…" />
      </Campo>
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro">
        Guardar
      </Boton>
    </form>
  )
}

function FormDatos({ usuario, datos, onHecho }: { usuario: Usuario; datos: DatosLaborales | null; onHecho: () => void }) {
  const [modo, setModo] = useState<'fijo' | 'horas'>(datos?.precio_hora !== null && datos?.precio_hora !== undefined && datos.salario_base_mensual === null ? 'horas' : 'fijo')
  const [v, setV] = useState({
    tipo_contrato: datos?.tipo_contrato ?? '',
    horas_semanales: aTexto(datos?.horas_semanales),
    salario: aTexto(datos?.salario_base_mensual),
    precio_hora: aTexto(datos?.precio_hora),
    irpf_pct: aTexto(datos?.irpf_pct ?? 2),
    ss_pct: aTexto(datos?.seguridad_social_pct ?? 6.48),
  })
  const [error, setError] = useState('')

  const n = (x: string) => (x.trim() === '' ? null : Number(x.replace(',', '.')))

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const fila = {
      usuario_id: usuario.id,
      tipo_contrato: v.tipo_contrato.trim() || null,
      horas_semanales: n(v.horas_semanales),
      salario_base_mensual: modo === 'fijo' ? n(v.salario) : null,
      precio_hora: modo === 'horas' ? n(v.precio_hora) : null,
      irpf_pct: n(v.irpf_pct) ?? 0,
      seguridad_social_pct: n(v.ss_pct) ?? 0,
      actualizado_en: new Date().toISOString(),
    }
    if (Object.values(fila).some((x) => typeof x === 'number' && !Number.isFinite(x))) return setError('Revisa los números.')
    if (modo === 'fijo' && fila.salario_base_mensual === null) return setError('Indica el salario mensual.')
    if (modo === 'horas' && fila.precio_hora === null) return setError('Indica el precio por hora.')
    const { error } = await getSupabase().from('datos_laborales').upsert(fila)
    if (error) return setError(mensajeError(error))
    onHecho()
  }

  const campo = (k: keyof typeof v, etiqueta: string, ayuda?: string) => (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <Entrada inputMode={k === 'tipo_contrato' ? 'text' : 'decimal'} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Campo>
  )

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {campo('tipo_contrato', 'Tipo de contrato', 'Indefinido, temporal, fijo discontinuo…')}
        {campo('horas_semanales', 'Horas semanales')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['fijo', 'horas'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={`tactil rounded-xl border px-3 py-2.5 text-sm font-semibold ${modo === m ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave'}`}
          >
            {m === 'fijo' ? 'Salario fijo mensual' : 'Cobra por horas'}
          </button>
        ))}
      </div>
      {modo === 'fijo' ? campo('salario', 'Salario bruto mensual (€)') : campo('precio_hora', 'Precio por hora bruto (€)')}
      <div className="grid grid-cols-2 gap-3">
        {campo('irpf_pct', 'Retención IRPF (%)')}
        {campo('ss_pct', 'Seguridad Social trabajador (%)', 'Lo indica la gestoría')}
      </div>
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro">
        Guardar
      </Boton>
    </form>
  )
}
