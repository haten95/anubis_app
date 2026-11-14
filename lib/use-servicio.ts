'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase, mensajeError } from './supabase/client'
import type { Caja, Comanda, Linea, LineaSabor } from './types'

export interface EstadoServicio {
  comandas: Comanda[]
  lineas: Linea[]
  caja: Caja | null
}

function normalizarLinea(l: Linea): Linea {
  return { ...l, precio: Number(l.precio), iva: Number(l.iva) }
}

/**
 * Comandas abiertas del local con sus líneas, y la caja abierta.
 * Se mantiene al día en tiempo real en todos los dispositivos.
 */
export function useServicio() {
  const [estado, setEstado] = useState<EstadoServicio | null>(null)
  const [error, setError] = useState('')
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recargar = useCallback(async () => {
    const supabase = getSupabase()
    const [c, k] = await Promise.all([
      supabase.from('comandas').select('*').neq('estado', 'cerrada').order('abierta_en'),
      supabase.from('cajas').select('*').is('cerrada_en', null).maybeSingle(),
    ])
    if (c.error) {
      setError(mensajeError(c.error))
      setEstado((e) => e ?? { comandas: [], lineas: [], caja: null })
      return
    }
    const comandas = c.data as Comanda[]
    let lineas: Linea[] = []
    if (comandas.length) {
      const l = await supabase
        .from('lineas_comanda')
        .select('*, sabores:lineas_shisha_sabores(*)')
        .in('comanda_id', comandas.map((x) => x.id))
        .eq('anulada', false)
        .order('id')
      if (l.error) setError(mensajeError(l.error))
      lineas = ((l.data as Linea[]) ?? []).map((x) => ({
        ...normalizarLinea(x),
        sabores: ((x.sabores as LineaSabor[] | undefined) ?? []).sort((a, b) => a.orden - b.orden),
      }))
    }
    setError('')
    setEstado({ comandas, lineas, caja: (k.data as Caja | null) ?? null })
  }, [])

  // Agrupa ráfagas de cambios en una sola recarga
  const programar = useCallback(() => {
    if (pendiente.current) clearTimeout(pendiente.current)
    pendiente.current = setTimeout(recargar, 150)
  }, [recargar])

  useEffect(() => {
    recargar()
    const supabase = getSupabase()
    const canal = supabase
      .channel('servicio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, programar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_comanda' }, programar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cajas' }, programar)
      .subscribe()
    // Por si se pierde algún evento (p. ej. el TPV estuvo en reposo)
    const intervalo = setInterval(recargar, 30000)
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      supabase.removeChannel(canal)
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      if (pendiente.current) clearTimeout(pendiente.current)
    }
  }, [recargar, programar])

  return { estado, error, recargar }
}

/** Total a cobrar de una comanda (sin líneas anuladas ni mermas) */
export function totalLineas(lineas: Linea[]): number {
  return Math.round(lineas.filter((l) => !l.anulada && !l.merma).reduce((t, l) => t + l.precio * l.cantidad, 0) * 100) / 100
}

/** Llama a una función RPC y devuelve el mensaje de error o null */
export async function rpc<T = unknown>(nombre: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await getSupabase().rpc(nombre, args)
  return { data: (data as T) ?? null, error: error ? mensajeError(error) : null }
}
