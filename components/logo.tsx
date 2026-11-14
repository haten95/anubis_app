export function Logo({ tamano = 40 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="oro-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d38c" />
          <stop offset="1" stopColor="#a87d2c" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#oro-logo)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="32" cy="19" rx="8" ry="10" />
        <path d="M32 29v26M19 35h26" />
      </g>
      <circle cx="32" cy="19" r="2.6" fill="#d6a94a" />
    </svg>
  )
}

export function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo tamano={34} />
      <div className="leading-none">
        <p className="font-display text-xl font-bold tracking-[0.25em] text-oro-claro">ANUBIS</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-suave">Shisha lounge</p>
      </div>
    </div>
  )
}
