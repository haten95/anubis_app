'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from './supabase/client'
import type { Usuario } from './types'

/** Personas activas del equipo (para cuadrante, tareas, fichajes y nóminas) */
export function useEquipo() {
  const [equipo, setEquipo] = useState<Usuario[] | null>(null)
  useEffect(() => {
    getSupabase()
      .from('usuarios')
      .select('*')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setEquipo((data as Usuario[]) ?? []))
  }, [])
  return equipo
}
