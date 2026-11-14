'use client'

import { useEffect, useState } from 'react'
import { getSupabase, mensajeError } from './supabase/client'
import type { Articulo, Categoria, Sabor } from './types'

export interface Carta {
  categorias: Categoria[]
  articulos: Articulo[]
  sabores: Sabor[]
}

/** Carta activa para tomar comandas */
export function useCarta() {
  const [carta, setCarta] = useState<Carta | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    const supabase = getSupabase()
    Promise.all([
      supabase.from('categorias').select('*').eq('activa', true).order('orden').order('id'),
      supabase.from('articulos').select('*').eq('activo', true).order('orden').order('nombre'),
      supabase.from('sabores').select('*').eq('activo', true).order('nombre'),
    ]).then(([c, a, s]) => {
      if (!vivo) return
      const err = c.error ?? a.error ?? s.error
      if (err) setError(mensajeError(err))
      setCarta({
        categorias: (c.data as Categoria[]) ?? [],
        articulos: ((a.data as Articulo[]) ?? []).map((x) => ({ ...x, precio: Number(x.precio), iva: Number(x.iva) })),
        sabores: (s.data as Sabor[]) ?? [],
      })
    })
    return () => {
      vivo = false
    }
  }, [])

  return { carta, error }
}
