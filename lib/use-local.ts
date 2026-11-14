'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabase, mensajeError } from './supabase/client'
import type { Mesa, Zona } from './types'

/** Carga zonas y mesas del local y se mantiene al día en tiempo real */
export function useLocal() {
  const [zonas, setZonas] = useState<Zona[] | null>(null)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    const supabase = getSupabase()
    const [z, m] = await Promise.all([
      supabase.from('zonas').select('*').order('orden').order('id'),
      supabase.from('mesas').select('*').order('numero'),
    ])
    if (z.error || m.error) {
      setError(mensajeError(z.error ?? m.error))
      setZonas([])
      return
    }
    setError('')
    setZonas(z.data as Zona[])
    setMesas(m.data as Mesa[])
  }, [])

  useEffect(() => {
    recargar()
    const supabase = getSupabase()
    const canal = supabase
      .channel('local-zonas-mesas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zonas' }, () => recargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => recargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [recargar])

  return { zonas, mesas, error, recargar }
}
