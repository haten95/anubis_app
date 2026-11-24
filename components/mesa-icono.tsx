import clsx from 'clsx'

export type EstadoMesa = 'libre' | 'ocupada' | 'cobro'

const COLORES: Record<EstadoMesa, { mesa: string; borde: string; texto: string }> = {
  libre: { mesa: '#24342c', borde: '#5e8a6c', texto: '#f2d892' },
  ocupada: { mesa: '#3a2a0c', borde: '#d6a94a', texto: '#fff3d1' },
  cobro: { mesa: '#3b1712', borde: '#f17a6c', texto: '#ffd9d3' },
}

/** Mesa redonda vista desde arriba, con sillas alrededor y su número en el centro */
export function MesaIcono({
  numero,
  estado = 'libre',
  capacidad,
  inactiva,
  tamano = 92,
  className,
}: {
  numero: number
  estado?: EstadoMesa
  capacidad?: number | null
  inactiva?: boolean
  tamano?: number
  className?: string
}) {
  const c = COLORES[estado]
  const sillas = Math.min(Math.max(capacidad ?? 4, 2), 8)
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 100 100"
      className={clsx('transition', inactiva && 'opacity-35 grayscale', className)}
      role="img"
      aria-label={`Mesa ${numero}`}
    >
      {Array.from({ length: sillas }, (_, i) => {
        const ang = (i / sillas) * Math.PI * 2 - Math.PI / 2
        return (
          <rect
            key={i}
            x={50 + Math.cos(ang) * 40 - 7}
            y={50 + Math.sin(ang) * 40 - 7}
            width="14"
            height="14"
            rx="4"
            fill="#2c3d34"
            stroke={c.borde}
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
        )
      })}
      <circle cx="50" cy="50" r="30" fill={c.mesa} stroke={c.borde} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="24" fill="none" stroke={c.borde} strokeOpacity="0.25" strokeWidth="1" />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.texto}
        fontSize={numero > 99 ? 20 : 26}
        fontWeight="700"
        fontFamily="var(--fuente-display), serif"
      >
        {numero}
      </text>
    </svg>
  )
}
