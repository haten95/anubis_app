'use client'

import clsx from 'clsx'
import { useState } from 'react'

/**
 * Gráficos sencillos en HTML: una sola serie (no necesitan leyenda; el título la nombra),
 * barras finas con extremo redondeado sobre la línea base, rejilla discreta y
 * tooltip al pasar el ratón o tocar. El color es el dorado de la marca.
 */

const ORO = 'var(--color-oro)'

function escalaMax(max: number): number {
  if (max <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(max)))
  const n = max / exp
  const paso = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return paso * exp
}

export function GraficoColumnas({
  datos,
  formato,
  etiqueta,
  alto = 200,
  cadaEtiqueta = 1,
}: {
  datos: { clave: string; valor: number; detalle?: string }[]
  formato: (v: number) => string
  etiqueta: (clave: string) => string
  alto?: number
  /** Muestra una etiqueta del eje X de cada N (para no amontonar) */
  cadaEtiqueta?: number
}) {
  const [activo, setActivo] = useState<number | null>(null)
  const max = escalaMax(Math.max(...datos.map((d) => d.valor), 0))
  const lineas = [1, 0.5, 0]

  return (
    <div className="relative select-none">
      <div className="flex gap-2">
        {/* Eje Y */}
        <div className="flex flex-col justify-between text-right text-[11px] text-suave" style={{ height: alto }}>
          {lineas.map((l) => (
            <span key={l} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formato(max * l)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* Rejilla */}
          {lineas.map((l) => (
            <div key={l} className="absolute inset-x-0 border-t border-linea/70" style={{ top: (1 - l) * alto }} />
          ))}
          {/* Barras */}
          <div className="relative flex items-end gap-[2px]" style={{ height: alto }} onMouseLeave={() => setActivo(null)}>
            {datos.map((d, i) => (
              <div
                key={d.clave}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setActivo(i)}
                onClick={() => setActivo(activo === i ? null : i)}
              >
                <div
                  className={clsx('w-full max-w-10 rounded-t-[4px] transition-opacity', activo !== null && activo !== i && 'opacity-50')}
                  style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor > 0 ? 2 : 0, background: ORO }}
                />
                {activo === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-linea bg-panel px-2.5 py-1.5 text-xs shadow-xl">
                    <p className="text-suave">{etiqueta(d.clave)}</p>
                    <p className="font-semibold text-texto">{formato(d.valor)}</p>
                    {d.detalle && <p className="text-suave">{d.detalle}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Eje X */}
          <div className="mt-1.5 flex gap-[2px] text-[10px] text-suave">
            {datos.map((d, i) => (
              <span key={d.clave} className="flex-1 truncate text-center">
                {i % cadaEtiqueta === 0 ? etiqueta(d.clave) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Ranking en barras horizontales con el nombre y el valor siempre escritos */
export function Ranking({
  filas,
  formato,
  max: maxFilas = 10,
}: {
  filas: { nombre: string; valor: number; detalle?: string; color?: string }[]
  formato: (v: number) => string
  max?: number
}) {
  const visibles = filas.slice(0, maxFilas)
  const max = Math.max(...visibles.map((f) => f.valor), 0) || 1
  if (visibles.length === 0) return <p className="py-6 text-center text-sm text-suave">Sin datos en este periodo.</p>
  return (
    <ul className="flex flex-col gap-2.5">
      {visibles.map((f) => (
        <li key={f.nombre}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 truncate">
              {f.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />}
              <span className="truncate">{f.nombre}</span>
            </span>
            <span className="shrink-0 font-semibold">
              {formato(f.valor)}
              {f.detalle && <span className="ml-1.5 text-xs font-normal text-suave">{f.detalle}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-linea/50">
            <div className="h-full rounded-full" style={{ width: `${(f.valor / max) * 100}%`, background: f.color ?? ORO }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
