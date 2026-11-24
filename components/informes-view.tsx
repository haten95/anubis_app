'use client'

import clsx from 'clsx'
import { Download, Info } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { euros } from '@/lib/format'
import { deIso, fechaLarga, hoyIso, primerDiaMes, sumarDias, sumarMeses } from '@/lib/fechas'
import type { InformeVentas } from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Panel, Titulo } from './ui'
import { GraficoColumnas, Ranking } from './graficos'

type Preset = 'hoy' | 'ayer' | '7d' | 'mes' | 'mes_pasado' | 'propio'

/** Día de negocio actual: de 06:00 a 06:00 */
function diaNegocioHoy(): string {
  const d = new Date()
  d.setHours(d.getHours() - 6)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rango(p: Preset, propio: [string, string]): [string, string] {
  const hoy = diaNegocioHoy()
  switch (p) {
    case 'hoy':
      return [hoy, hoy]
    case 'ayer':
      return [sumarDias(hoy, -1), sumarDias(hoy, -1)]
    case '7d':
      return [sumarDias(hoy, -6), hoy]
    case 'mes':
      return [primerDiaMes(hoy), hoy]
    case 'mes_pasado':
      return [sumarMeses(hoy, -1), sumarDias(primerDiaMes(hoy), -1)]
    default:
      return propio
  }
}

const eurosCortos = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} k€` : `${Math.round(v)} €`)

export function InformesView() {
  const [preset, setPreset] = useState<Preset>('7d')
  const [propio, setPropio] = useState<[string, string]>([sumarDias(hoyIso(), -30), hoyIso()])
  const [informe, setInforme] = useState<InformeVentas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [desde, hasta] = rango(preset, propio)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await rpc<InformeVentas>('informe_ventas', { p_desde: desde, p_hasta: hasta })
    setCargando(false)
    if (error) return setError(error)
    setError('')
    // La base de datos devuelve los días con hora ("2026-11-08T00:00:00"): nos quedamos con la fecha
    setInforme(data ? { ...data, por_dia: data.por_dia.map((d) => ({ ...d, dia: d.dia.slice(0, 10) })) } : null)
  }, [desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function exportar() {
    if (!informe) return
    setExportando(true)
    try {
      const { data } = await getSupabase().from('ajustes_local').select('nombre_comercial').maybeSingle()
      const { exportarInformeExcel } = await import('@/lib/excel-informe')
      await exportarInformeExcel(informe, desde, hasta, (data?.nombre_comercial as string) ?? 'Anubis')
    } catch (e) {
      setError(`No se pudo generar el Excel: ${(e as Error).message}`)
    } finally {
      setExportando(false)
    }
  }

  const presets: [Preset, string][] = [
    ['hoy', 'Hoy'],
    ['ayer', 'Ayer'],
    ['7d', '7 días'],
    ['mes', 'Este mes'],
    ['mes_pasado', 'Mes pasado'],
    ['propio', 'Elegir fechas'],
  ]

  return (
    <div className="aparecer">
      <Titulo
        accion={
          <Boton variante="oro" onClick={exportar} disabled={!informe || exportando}>
            <Download size={16} /> {exportando ? 'Generando…' : 'Exportar a Excel'}
          </Boton>
        }
      >
        Informes
      </Titulo>

      {/* Filtros en una fila */}
      <div className="mb-5 flex flex-wrap items-end gap-2">
        {presets.map(([p, n]) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={clsx(
              'tactil rounded-full border px-4 py-2 text-sm font-semibold transition',
              preset === p ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
            )}
          >
            {n}
          </button>
        ))}
        {preset === 'propio' && (
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Campo etiqueta="Desde">
              <Entrada type="date" value={propio[0]} onChange={(e) => e.target.value && setPropio([e.target.value, propio[1]])} className="sm:w-40" />
            </Campo>
            <Campo etiqueta="Hasta">
              <Entrada type="date" value={propio[1]} onChange={(e) => e.target.value && setPropio([propio[0], e.target.value])} className="sm:w-40" />
            </Campo>
          </div>
        )}
      </div>
      <p className="-mt-3 mb-5 flex items-center gap-1.5 text-xs text-suave">
        <Info size={13} />
        {desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde, true)} – ${fechaLarga(hasta, true)}`} · Cada día va de 06:00 a 06:00, así lo
        cobrado de madrugada cuenta en su noche.
      </p>

      <Aviso>{error}</Aviso>

      {cargando && !informe ? (
        <Cargando />
      ) : informe ? (
        <Contenido informe={informe} desde={desde} hasta={hasta} cargando={cargando} />
      ) : null}
    </div>
  )
}

function Contenido({ informe, desde, hasta, cargando }: { informe: InformeVentas; desde: string; hasta: string; cargando: boolean }) {
  const r = informe.resumen
  const n = (x: unknown) => Number(x)
  const margen = n(r.base) - n(r.coste)
  const pctMargen = n(r.base) > 0 ? Math.round((margen / n(r.base)) * 100) : null
  const totalMetodos = n(r.efectivo) + n(r.tarjeta)
  const variosDias = desde !== hasta
  const dias = informe.por_dia.length

  // Horas con actividad o del horario típico (de 12:00 a 05:00)
  const orden = [...Array.from({ length: 18 }, (_, i) => i + 12), ...Array.from({ length: 6 }, (_, i) => i)].filter((h) => h < 24)
  const horas = orden.map((h) => informe.por_hora.find((x) => x.hora === h) ?? { hora: h, ventas: 0, tickets: 0 })

  return (
    <div className={clsx('flex flex-col gap-5 transition-opacity', cargando && 'opacity-60')}>
      {/* Cifras clave */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra titulo="Ventas" valor={euros(n(r.ventas))} detalle={`Base ${euros(n(r.base))} + IVA ${euros(n(r.iva))}`} destacado />
        <Cifra titulo="Tickets" valor={String(r.tickets)} detalle={`Ticket medio ${euros(n(r.ticket_medio))}`} />
        <Cifra
          titulo="Margen bruto"
          valor={n(r.coste) > 0 ? euros(margen) : '—'}
          detalle={n(r.coste) > 0 ? `${pctMargen}% sobre la base · coste ${euros(n(r.coste))}` : 'Rellena los escandallos para verlo'}
        />
        <Cifra titulo="Shishas" valor={String(n(r.shishas))} detalle={variosDias ? `${(n(r.shishas) / dias).toFixed(1)} por día` : undefined} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel>
          <p className="text-xs uppercase tracking-widest text-suave">Cómo pagan</p>
          {totalMetodos === 0 ? (
            <p className="mt-2 text-sm text-suave">Sin cobros.</p>
          ) : (
            <>
              <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full">
                <div className="bg-oro" style={{ width: `${(n(r.efectivo) / totalMetodos) * 100}%` }} title="Efectivo" />
                <div className="bg-turquesa" style={{ width: `${(n(r.tarjeta) / totalMetodos) * 100}%` }} title="Tarjeta" />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-oro" /> Efectivo <strong>{euros(n(r.efectivo))}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-turquesa" /> Tarjeta <strong>{euros(n(r.tarjeta))}</strong>
                </span>
              </div>
            </>
          )}
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-widest text-suave">Mermas (orientativo)</p>
          <p className="mt-1 font-display text-2xl">{euros(n(r.mermas_valor))}</p>
          <p className="text-xs text-suave">
            en valor de carta · {r.mermas_lineas} líneas · coste {euros(n(r.mermas_coste))}. No cuenta en la facturación.
          </p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-widest text-suave">Anulaciones</p>
          <p className="mt-1 font-display text-2xl">{r.anulaciones}</p>
          <p className="text-xs text-suave">{r.anulaciones ? `${euros(n(r.importe_anulado))} devueltos con rectificativa` : 'Ningún ticket anulado.'}</p>
        </Panel>
      </div>

      {variosDias && (
        <Panel>
          <h3 className="mb-4 font-display text-lg">Ventas por día</h3>
          <GraficoColumnas
            datos={informe.por_dia.map((d) => ({ clave: d.dia, valor: n(d.ventas), detalle: `${d.tickets} tickets` }))}
            formato={eurosCortos}
            etiqueta={(c) => (dias > 7 ? String(deIso(c).getDate()) : fechaLarga(c, true).split(' ').slice(0, 2).join(' '))}
            cadaEtiqueta={dias > 20 ? 3 : 1}
          />
          <TablaDatos filas={informe.por_dia.map((d) => [fechaLarga(d.dia, true), euros(n(d.ventas)), `${d.tickets}`])} cabecera={['Día', 'Ventas', 'Tickets']} />
        </Panel>
      )}

      <Panel>
        <h3 className="mb-4 font-display text-lg">Ventas por hora</h3>
        <GraficoColumnas
          datos={horas.map((h) => ({ clave: String(h.hora), valor: n(h.ventas), detalle: `${h.tickets} tickets` }))}
          formato={eurosCortos}
          etiqueta={(c) => `${c.padStart(2, '0')}h`}
          cadaEtiqueta={3}
          alto={170}
        />
        <TablaDatos
          filas={horas.filter((h) => n(h.ventas) > 0).map((h) => [`${String(h.hora).padStart(2, '0')}:00`, euros(n(h.ventas)), `${h.tickets}`])}
          cabecera={['Hora', 'Ventas', 'Tickets']}
        />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="mb-4 font-display text-lg">Lo más vendido</h3>
          <Ranking filas={informe.productos.map((p) => ({ nombre: p.nombre, valor: n(p.importe), detalle: `${n(p.unidades)} ud` }))} formato={euros} />
        </Panel>
        <Panel>
          <h3 className="mb-4 font-display text-lg">Sabores de shisha</h3>
          <Ranking
            filas={informe.sabores.map((s) => ({ nombre: s.nombre, valor: n(s.cargas), detalle: `en ${s.shishas} shishas`, color: s.color }))}
            formato={(v) => `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} cargas`}
          />
          <p className="mt-3 text-xs text-suave">Cargas equivalentes: una shisha 50/50 suma media carga a cada sabor.</p>
        </Panel>
        <Panel>
          <h3 className="mb-4 font-display text-lg">Por categoría</h3>
          <Ranking filas={informe.categorias.map((c) => ({ nombre: c.nombre, valor: n(c.importe), detalle: `${n(c.unidades)} ud` }))} formato={euros} />
        </Panel>
        <Panel>
          <h3 className="mb-4 font-display text-lg">Cobrado por persona</h3>
          <Ranking filas={informe.personal.map((p) => ({ nombre: p.nombre, valor: n(p.ventas), detalle: `${p.tickets} tickets` }))} formato={euros} />
        </Panel>
      </div>
    </div>
  )
}

function Cifra({ titulo, valor, detalle, destacado }: { titulo: string; valor: string; detalle?: string; destacado?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border p-4', destacado ? 'border-oro/40 bg-oro/10' : 'border-linea bg-panel/80')}>
      <p className="text-xs uppercase tracking-widest text-suave">{titulo}</p>
      <p className={clsx('mt-1 font-display text-2xl font-bold', destacado ? 'text-oro-claro' : 'text-texto')}>{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-suave">{detalle}</p>}
    </div>
  )
}

function TablaDatos({ cabecera, filas }: { cabecera: string[]; filas: string[][] }) {
  if (filas.length === 0) return null
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver como tabla</summary>
      <div className="mt-2 max-h-64 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-suave">
              {cabecera.map((c, i) => (
                <th key={c} className={clsx('py-1 font-semibold', i > 0 && 'text-right')}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((f, i) => (
              <tr key={i}>
                {f.map((c, j) => (
                  <td key={j} className={clsx('py-1', j > 0 && 'text-right')}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
