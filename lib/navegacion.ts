'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * «Volver» común para toda la app.
 *
 * Cada pantalla o ventana que se superpone (una sección distinta de Sala, una comanda,
 * una ventana emergente, el menú «Más») registra una «capa». Cada capa añade una entrada
 * al historial del navegador, así que:
 *  · el botón atrás del móvil o del navegador cierra la capa de arriba (y no sale de la app),
 *  · la tecla Escape también la cierra,
 *  · los botones «Volver» de la app llaman a volver(), que hace lo mismo.
 * Si una capa se cierra desde la propia app (p. ej. con la X), su entrada del historial se retira.
 */

type Capa = { id: number; cerrar: () => void }

const pila: Capa[] = []
const oyentes = new Set<() => void>()
let siguienteId = 1
let popsIgnorados = 0
let instalado = false

function avisar() {
  oyentes.forEach((f) => f())
}

function instalar() {
  if (instalado || typeof window === 'undefined') return
  instalado = true
  window.addEventListener('popstate', () => {
    if (popsIgnorados > 0) {
      popsIgnorados--
      return
    }
    const capa = pila.pop()
    avisar()
    capa?.cerrar()
  })
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || pila.length === 0) return
    // No interferir con un desplegable nativo abierto
    if ((e.target as HTMLElement | null)?.tagName === 'SELECT') return
    e.preventDefault()
    volver()
  })
}

/** Cierra la capa de arriba (equivale a pulsar «atrás») */
export function volver() {
  if (pila.length > 0) window.history.back()
}

/** Registra una capa mientras `activa` sea true; `cerrar` se llama al pulsar atrás / Escape */
export function useCapa(activa: boolean, cerrar: () => void) {
  const ref = useRef(cerrar)
  ref.current = cerrar

  useEffect(() => {
    if (!activa) return
    instalar()
    const capa: Capa = { id: siguienteId++, cerrar: () => ref.current() }
    // Se registra un instante después: en desarrollo React monta y desmonta dos veces seguidas
    const t = window.setTimeout(() => {
      pila.push(capa)
      window.history.pushState({ anubis: capa.id }, '')
      avisar()
    }, 0)
    return () => {
      window.clearTimeout(t)
      // Si se cerró desde la app (no con «atrás»), quitamos su entrada del historial
      const i = pila.indexOf(capa)
      if (i >= 0) {
        pila.splice(i, 1)
        popsIgnorados++
        window.history.back()
        avisar()
      }
    }
  }, [activa])
}

/** Número de capas abiertas (para mostrar u ocultar la flecha de volver) */
export function useHayCapas(): boolean {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => pila.length > 0,
    () => false,
  )
}
