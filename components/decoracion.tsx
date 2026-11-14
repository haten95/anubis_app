/**
 * Decoración de Anubis: vegetación de oasis (papiros y palmeras) y motivos
 * egipcios minimalistas (loto, ojo de Horus, sol alado, friso).
 * Todo es SVG estático, decorativo (aria-hidden) y sin interacción.
 */

const VERDE = '#7cc28f'
const HOJA = '#4c8a5c'
const ORO = '#d9ad50'
const TURQUESA = '#4fc1b0'

/** Redondea a 2 decimales: evita diferencias de coma flotante entre servidor y navegador */
const r2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------
// Vegetación
// ---------------------------------------------------------------------

/** Mata de papiros: tallos finos rematados en abanico */
export function Papiros({ className, espejo }: { className?: string; espejo?: boolean }) {
  const tallos = [
    { x: 60, alto: 330, curva: -18, abanico: 34 },
    { x: 92, alto: 380, curva: 6, abanico: 40 },
    { x: 120, alto: 290, curva: 22, abanico: 30 },
    { x: 40, alto: 250, curva: -30, abanico: 26 },
    { x: 145, alto: 220, curva: 34, abanico: 24 },
  ]
  return (
    <svg
      viewBox="0 0 200 420"
      className={className}
      aria-hidden="true"
      style={espejo ? { transform: 'scaleX(-1)' } : undefined}
    >
      {tallos.map((t, i) => {
        const base = 420
        const cimaX = t.x + t.curva
        const cimaY = base - t.alto
        const rayos = 13
        return (
          <g key={i}>
            <path
              d={`M ${t.x} ${base} Q ${t.x + t.curva * 0.2} ${base - t.alto * 0.55} ${cimaX} ${cimaY}`}
              stroke={HOJA}
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            {/* Umbela en abanico */}
            {Array.from({ length: rayos }, (_, k) => {
              const ang = (-160 + (140 / (rayos - 1)) * k) * (Math.PI / 180)
              const largo = t.abanico * (0.75 + 0.25 * Math.sin((k / (rayos - 1)) * Math.PI))
              const x2 = r2(cimaX + Math.cos(ang) * largo)
              const y2 = r2(cimaY + Math.sin(ang) * largo)
              return (
                <g key={k}>
                  <line x1={cimaX} y1={cimaY} x2={x2} y2={y2} stroke={VERDE} strokeWidth="1.1" strokeLinecap="round" />
                  <circle cx={x2} cy={y2} r="1.6" fill={VERDE} />
                </g>
              )
            })}
            <path
              d={`M ${cimaX - 5} ${cimaY + 6} Q ${cimaX} ${cimaY - 4} ${cimaX + 5} ${cimaY + 6}`}
              fill={HOJA}
            />
          </g>
        )
      })}
      {/* Hojas de la base */}
      {[
        'M 70 420 Q 30 380 10 330 Q 50 370 82 420 Z',
        'M 100 420 Q 140 370 175 345 Q 145 385 112 420 Z',
        'M 85 420 Q 80 370 95 330 Q 96 380 98 420 Z',
      ].map((d, i) => (
        <path key={i} d={d} fill={HOJA} opacity="0.9" />
      ))}
    </svg>
  )
}

/** Hoja de palmera: nervio curvo con foliolos que se acortan hacia la punta */
export function HojaPalmera({ className, rotar = 0 }: { className?: string; rotar?: number }) {
  const n = 22
  const p0 = { x: 10, y: 20 }
  const p1 = { x: 160, y: 10 }
  const p2 = { x: 290, y: 150 }
  const punto = (t: number) => ({
    x: r2((1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x),
    y: r2((1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y),
  })
  const tangente = (t: number) => ({
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  })
  return (
    <svg viewBox="0 0 300 230" className={className} aria-hidden="true" style={{ transform: `rotate(${rotar}deg)` }}>
      <path d={`M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`} stroke={HOJA} strokeWidth="3" fill="none" strokeLinecap="round" />
      {Array.from({ length: n }, (_, i) => {
        const t = 0.06 + (i / n) * 0.9
        const p = punto(t)
        const d = tangente(t)
        const len = Math.hypot(d.x, d.y)
        const nx = -d.y / len
        const ny = d.x / len
        const largo = 70 * (1 - t * 0.75)
        // Foliolos a ambos lados, inclinados hacia la punta
        return [1, -1].map((lado) => {
          const ex = r2(p.x + (nx * lado * 0.85 + (d.x / len) * 0.5) * largo)
          const ey = r2(p.y + (ny * lado * 0.85 + (d.y / len) * 0.5) * largo + (lado === 1 ? 10 : 18))
          const cx = r2(p.x + nx * lado * largo * 0.45)
          const cy = r2(p.y + ny * lado * largo * 0.45)
          return (
            <path
              key={`${i}${lado}`}
              d={`M ${p.x} ${p.y} Q ${cx} ${cy} ${ex} ${ey}`}
              stroke={lado === 1 ? VERDE : HOJA}
              strokeWidth="2.6"
              fill="none"
              strokeLinecap="round"
            />
          )
        })
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------
// Motivos egipcios (trazo fino)
// ---------------------------------------------------------------------

/** Flor de loto vista de frente */
export function Loto({ className, color = ORO }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 44 C 26 34, 26 18, 32 6 C 38 18, 38 34, 32 44 Z" />
      <path d="M30 44 C 20 38, 15 26, 16 14 C 24 20, 29 30, 30 44" />
      <path d="M34 44 C 44 38, 49 26, 48 14 C 40 20, 35 30, 34 44" />
      <path d="M28 44 C 16 42, 8 34, 4 26 C 14 28, 22 34, 28 44" />
      <path d="M36 44 C 48 42, 56 34, 60 26 C 50 28, 42 34, 36 44" />
      <path d="M22 46 H 42" />
    </svg>
  )
}

/** Ojo de Horus (Udjat) estilizado */
export function OjoHorus({ className, color = ORO }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 64" className={className} aria-hidden="true" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Ceja */}
      <path d="M14 10 Q 46 0 86 8" />
      {/* Ojo */}
      <path d="M10 26 Q 40 10 74 24 Q 46 38 14 28" />
      <circle cx="44" cy="25" r="6.5" fill={color} stroke="none" />
      {/* Prolongación hacia la sien */}
      <path d="M74 24 L 92 24" />
      {/* Lágrima vertical */}
      <path d="M40 34 L 38 56" />
      {/* Espiral */}
      <path d="M52 33 Q 58 46 70 50 Q 78 52 78 45 Q 77 40 71 42" />
    </svg>
  )
}

/** Sol alado (disco solar con alas extendidas) */
export function SolAlado({ className }: { className?: string }) {
  const plumas = 7
  return (
    <svg viewBox="0 0 320 70" className={className} aria-hidden="true">
      {[-1, 1].map((lado) => (
        <g key={lado} stroke={ORO} strokeWidth="2" strokeLinecap="round" fill="none">
          {Array.from({ length: plumas }, (_, i) => {
            const y = 22 + i * 5.5
            const largo = 130 - i * 15
            const x1 = 160 + lado * 26
            const x2 = 160 + lado * (26 + largo)
            return <path key={i} d={`M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - 10 + i} ${x2} ${y - 14 + i * 2}`} opacity={1 - i * 0.08} />
          })}
        </g>
      ))}
      {/* Uraeus a cada lado del disco */}
      {[-1, 1].map((lado) => (
        <path key={lado} d={`M ${160 + lado * 20} 52 Q ${160 + lado * 30} 40 ${160 + lado * 22} 30 Q ${160 + lado * 18} 26 ${160 + lado * 20} 22`} stroke={TURQUESA} strokeWidth="2" fill="none" strokeLinecap="round" />
      ))}
      <circle cx="160" cy="34" r="17" fill={ORO} />
      <circle cx="160" cy="34" r="17" fill="none" stroke="#f2d892" strokeWidth="1.5" />
    </svg>
  )
}

/** Friso horizontal: lotos y capullos alternos, como en las cenefas de los templos */
export function Friso({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" width="100%" height="14" preserveAspectRatio="none">
      <defs>
        <pattern id="friso-anubis" width="36" height="14" patternUnits="userSpaceOnUse">
          {/* Loto abierto */}
          <path d="M9 13 C 4 10, 2 6, 2 2 C 5 4, 8 8, 9 13 C 10 8, 13 4, 16 2 C 16 6, 14 10, 9 13 Z" fill="none" stroke={ORO} strokeWidth="1.1" strokeLinejoin="round" />
          {/* Capullo */}
          <path d="M27 13 C 24 10, 24 6, 27 3 C 30 6, 30 10, 27 13 Z" fill={TURQUESA} opacity="0.75" />
          <path d="M0 13.4 H 36" stroke={ORO} strokeWidth="0.8" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="14" fill="url(#friso-anubis)" />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Capa de fondo
// ---------------------------------------------------------------------

/**
 * Vegetación fija en los bordes de la pantalla, detrás del contenido.
 * Se atenúa para no distraer en el TPV y se oculta en pantallas pequeñas lo que estorbe.
 */
export function FondoOasis({ intensidad = 'suave' }: { intensidad?: 'suave' | 'viva' }) {
  const op = intensidad === 'viva' ? 'opacity-50' : 'opacity-[0.22]'
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Papiros className={`absolute -bottom-4 -left-6 h-[46vh] max-h-[460px] ${op}`} />
      <Papiros className={`absolute -bottom-4 -right-6 hidden h-[38vh] max-h-[380px] sm:block ${op}`} espejo />
      <HojaPalmera className={`absolute -right-16 -top-10 hidden w-[340px] md:block ${op}`} rotar={8} />
      <HojaPalmera className={`absolute -right-24 top-24 hidden w-[260px] lg:block ${op}`} rotar={38} />
      <OjoHorus className={`absolute bottom-10 right-1/3 hidden w-24 lg:block ${intensidad === 'viva' ? 'opacity-25' : 'opacity-[0.08]'}`} />
    </div>
  )
}
