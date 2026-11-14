'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { divisionesMovibles, limites, moverDivision, posicionDesdePunto, punto, suma, trazoSector, type Porcion } from '@/lib/shisha'

export interface PorcionColor {
  nombre: string
  color: string
  porcentaje: number
}

const C = 100 // centro
const R_BORDE = 92
const R_TABACO = 80
const R_CHIMENEA = 22

/**
 * Cazoleta de barro vista desde arriba. El tabaco se reparte en sectores
 * proporcionales al porcentaje de cada sabor; lo que falta hasta el 100 % se ve vacío.
 */
export function Cazoleta({
  porciones,
  tamano = 220,
  conEtiquetas = true,
  children,
  svgRef,
  onPointerDown,
}: {
  porciones: PorcionColor[]
  tamano?: number
  conEtiquetas?: boolean
  children?: React.ReactNode
  svgRef?: React.Ref<SVGSVGElement>
  onPointerDown?: (e: ReactPointerEvent<SVGSVGElement>) => void
}) {
  const lim = limites(porciones.map((p, i) => ({ saborId: i, porcentaje: p.porcentaje })))
  const total = lim[lim.length - 1]
  const id = `caz-${tamano}`

  return (
    <svg
      ref={svgRef}
      width={tamano}
      height={tamano}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Cazoleta: ${porciones.map((p) => `${p.nombre} ${p.porcentaje}%`).join(', ') || 'vacía'}`}
      onPointerDown={onPointerDown}
      className="touch-none select-none"
    >
      <defs>
        <radialGradient id={`${id}-barro`} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#a45a35" />
          <stop offset="0.85" stopColor="#6e3418" />
          <stop offset="1" stopColor="#4a2210" />
        </radialGradient>
        <radialGradient id={`${id}-brillo`} cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-hebras`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0 3h6" stroke="#000" strokeOpacity="0.16" strokeWidth="1.2" />
        </pattern>
      </defs>

      {/* Borde de barro */}
      <circle cx={C} cy={C} r={R_BORDE + 6} fill="#2a1408" />
      <circle cx={C} cy={C} r={R_BORDE + 4} fill={`url(#${id}-barro)`} />
      <circle cx={C} cy={C} r={R_TABACO + 3} fill="#1b0c05" />

      {/* Hueco vacío */}
      <circle cx={C} cy={C} r={R_TABACO} fill="#24160d" />
      {total < 100 && (
        <path
          d={trazoSector(C, C, R_CHIMENEA + 4, R_TABACO - 3, total, 100)}
          fill="none"
          stroke="#8a6a26"
          strokeDasharray="4 4"
          strokeWidth="1.5"
          opacity="0.7"
        />
      )}

      {/* Tabaco por sabor */}
      {porciones.map((p, i) => (
        <g key={i}>
          <path d={trazoSector(C, C, R_CHIMENEA, R_TABACO, lim[i], lim[i + 1])} fill={p.color} />
          <path d={trazoSector(C, C, R_CHIMENEA, R_TABACO, lim[i], lim[i + 1])} fill={`url(#${id}-hebras)`} />
        </g>
      ))}

      {/* Líneas de separación entre sabores */}
      {porciones.length > 1 &&
        lim.slice(0, total >= 100 ? -1 : undefined).map((pos, i) => {
          const [x1, y1] = punto(C, C, R_CHIMENEA, pos)
          const [x2, y2] = punto(C, C, R_TABACO, pos)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#120904" strokeWidth="2" strokeOpacity="0.8" />
        })}

      {/* Chimenea central (cazoleta tipo phunnel) */}
      <circle cx={C} cy={C} r={R_CHIMENEA} fill={`url(#${id}-barro)`} stroke="#2a1408" strokeWidth="3" />
      <circle cx={C} cy={C} r={7} fill="#140904" />

      {/* Porcentajes sobre el tabaco */}
      {conEtiquetas &&
        porciones.map((p, i) => {
          if (p.porcentaje < 8) return null
          const [x, y] = punto(C, C, (R_CHIMENEA + R_TABACO) / 2 + 2, (lim[i] + lim[i + 1]) / 2)
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="800"
              fill="#fff"
              stroke="#000"
              strokeOpacity="0.55"
              strokeWidth="3"
              paintOrder="stroke"
              pointerEvents="none"
            >
              {p.porcentaje}%
            </text>
          )
        })}

      <circle cx={C} cy={C} r={R_BORDE + 4} fill={`url(#${id}-brillo)`} pointerEvents="none" />
      {children}
    </svg>
  )
}

/** Cazoleta con divisiones que se arrastran con el dedo o el ratón */
export function CazoletaEditable({
  porciones,
  colores,
  nombres,
  onCambio,
  tamano = 260,
}: {
  porciones: Porcion[]
  colores: string[]
  nombres: string[]
  onCambio: (p: Porcion[]) => void
  tamano?: number
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const lim = limites(porciones)
  const movibles = divisionesMovibles(porciones)

  function posicion(e: { clientX: number; clientY: number }) {
    const r = svg.current!.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    return posicionDesdePunto(dx, dy)
  }

  function empezar(d: number, e: ReactPointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setArrastrando(d)
  }

  function mover(e: ReactPointerEvent) {
    if (arrastrando === null) return
    let pos = posicion(e)
    // Evita el salto de 100 a 0 al pasar por arriba
    if (pos < 3 && lim[arrastrando] > 50) pos = 100
    onCambio(moverDivision(porciones, arrastrando, pos))
  }

  return (
    <div className="flex flex-col items-center">
      <Cazoleta
        svgRef={svg}
        tamano={tamano}
        porciones={porciones.map((p, i) => ({ nombre: nombres[i], color: colores[i], porcentaje: p.porcentaje }))}
      >
        <g onPointerMove={mover} onPointerUp={() => setArrastrando(null)} onPointerCancel={() => setArrastrando(null)}>
          {movibles.map((d) => {
            const [x, y] = punto(C, C, R_BORDE, lim[d])
            const activo = arrastrando === d
            return (
              <g key={d} onPointerDown={(e) => empezar(d, e)} style={{ cursor: 'grab' }}>
                <circle cx={x} cy={y} r={16} fill="transparent" />
                <circle cx={x} cy={y} r={activo ? 10 : 8} fill="#f0d38c" stroke="#3a2a0c" strokeWidth="3" />
                <circle cx={x} cy={y} r={2.5} fill="#3a2a0c" />
              </g>
            )
          })}
        </g>
      </Cazoleta>
      <p className="mt-1 text-xs text-suave">
        {suma(porciones) < 100 ? `Falta un ${100 - suma(porciones)}% por llenar` : 'Cazoleta completa'}
        {movibles.length > 0 && ' · arrastra los puntos dorados'}
      </p>
    </div>
  )
}

/** Versión pequeña para las líneas de la comanda */
export function MiniCazoleta({ sabores, tamano = 44 }: { sabores: PorcionColor[]; tamano?: number }) {
  return <Cazoleta porciones={sabores} tamano={tamano} conEtiquetas={false} />
}
