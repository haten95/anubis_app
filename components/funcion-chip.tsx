import clsx from 'clsx'
import { Flame, Users, Wine } from 'lucide-react'
import { FUNCIONES, type FuncionTurno } from '@/lib/types'

export function IconoFuncion({ funcion, size = 16 }: { funcion: FuncionTurno; size?: number }) {
  if (funcion === 'barra') return <Wine size={size} />
  if (funcion === 'shishas') return <Flame size={size} />
  return <Users size={size} />
}

export function ChipFuncion({ funcion }: { funcion: FuncionTurno | null }) {
  if (!funcion) return null
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', FUNCIONES[funcion].clase)}>
      <IconoFuncion funcion={funcion} size={12} />
      {FUNCIONES[funcion].nombre}
    </span>
  )
}
