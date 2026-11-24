'use client'

import clsx from 'clsx'
import { ArrowLeft, X } from 'lucide-react'
import { useCapa } from '@/lib/navegacion'
import { createPortal } from 'react-dom'
import { Friso } from './decoracion'
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

type Variante = 'oro' | 'secundario' | 'fantasma' | 'peligro'

export function Boton({
  variante = 'secundario',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={clsx(
        'tactil inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50',
        variante === 'oro' && 'bg-oro text-fondo hover:bg-oro-claro',
        variante === 'secundario' && 'border border-linea bg-panel-2 text-texto hover:border-oro-oscuro',
        variante === 'fantasma' && 'text-suave hover:bg-panel-2 hover:text-texto',
        variante === 'peligro' && 'border border-peligro/40 text-peligro hover:bg-peligro/10',
        className,
      )}
    />
  )
}

export function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-suave">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-suave/80">{ayuda}</span>}
    </label>
  )
}

const claseEntrada =
  'tactil w-full rounded-xl border border-linea bg-fondo/60 px-3.5 py-2.5 text-texto placeholder:text-suave/60 ' +
  'focus:border-oro focus:outline-none disabled:opacity-60'

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(claseEntrada, className)} />
}

export function Selector({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(claseEntrada, 'appearance-auto', className)} />
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('rounded-2xl border border-linea bg-panel/90 p-4 sm:p-5', className)}>{children}</section>
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    // En el móvil el nombre de la sección ya está en la cabecera: aquí solo quedan las acciones
    <div className={clsx('flex flex-wrap items-end justify-between gap-3 lg:mb-5', accion ? 'mb-4' : 'mb-1')}>
      <div className="hidden lg:block">
        <h2 className="font-display text-2xl tracking-wide text-oro-claro">{children}</h2>
        <Friso className="mt-1.5 w-44 opacity-80" />
      </div>
      {accion && (
        <div className="flex w-full flex-wrap gap-2 lg:w-auto max-lg:[&_button]:flex-1 max-lg:[&>*]:w-full">{accion}</div>
      )}
    </div>
  )
}

export function Etiqueta({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'oro' | 'ok' | 'peligro' | 'terraza' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tono === 'neutro' && 'bg-panel-2 text-suave',
        tono === 'oro' && 'bg-oro/15 text-oro-claro',
        tono === 'ok' && 'bg-ok/15 text-ok',
        tono === 'peligro' && 'bg-peligro/15 text-peligro',
        tono === 'terraza' && 'bg-terraza/15 text-terraza',
      )}
    >
      {children}
    </span>
  )
}

export function Aviso({ children, tono = 'peligro' }: { children: ReactNode; tono?: 'peligro' | 'ok' | 'info' }) {
  if (!children) return null
  return (
    <p
      role={tono === 'peligro' ? 'alert' : 'status'}
      className={clsx(
        'rounded-xl px-3.5 py-2.5 text-sm',
        tono === 'peligro' && 'bg-peligro/10 text-peligro',
        tono === 'ok' && 'bg-ok/10 text-ok',
        tono === 'info' && 'bg-oro/10 text-oro-claro',
      )}
    >
      {children}
    </p>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-linea px-4 py-8 text-center text-sm text-suave">{children}</p>
}

export function Cargando() {
  return (
    <div className="flex justify-center py-16" aria-label="Cargando">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-linea border-t-oro" />
    </div>
  )
}

export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  ancho = 'normal',
}: {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  ancho?: 'normal' | 'grande'
}) {
  // El botón atrás del móvil y la tecla Escape cierran la ventana
  useCapa(abierto, onCerrar)

  if (!abierto || typeof document === 'undefined') return null
  // Se pinta directamente en <body>: así ninguna pantalla puede dejarla por detrás de la cabecera o del menú
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={clsx(
          'aparecer flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-linea bg-panel shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl',
          ancho === 'grande' ? 'sm:max-w-4xl' : 'sm:max-w-lg',
        )}
      >
        {/* Cabecera fija: siempre se puede volver aunque el contenido sea largo */}
        <div className="shrink-0 border-b border-linea/70 bg-panel px-3 pb-2.5 pt-2 sm:px-5 sm:pt-4">
          <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-linea sm:hidden" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <button
              onClick={onCerrar}
              className="tactil flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-suave hover:bg-panel-2 hover:text-texto sm:hidden"
              aria-label="Volver"
            >
              <ArrowLeft size={20} />
            </button>
            <h3 className="min-w-0 flex-1 truncate font-display text-lg text-oro-claro">{titulo}</h3>
            <button onClick={onCerrar} className="hidden rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto sm:block" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  disabled,
}: {
  activo: boolean
  onCambio: (v: boolean) => void
  etiqueta: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={clsx(
        'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50',
        activo ? 'bg-oro' : 'bg-linea',
      )}
    >
      <span
        className={clsx(
          'absolute top-1 h-5 w-5 rounded-full bg-texto transition-all',
          activo ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}
