import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

export const supabaseConfigurado = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    )
  }
  return client
}

/** Traduce los errores más habituales de Supabase/Postgres a un mensaje para el usuario */
export function mensajeError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Error desconocido'
  const m = error.message ?? ''
  if (error.code === '23505') return 'Ya existe un registro con ese valor (por ejemplo, ese número de mesa).'
  if (error.code === '23503') return 'No se puede borrar porque tiene elementos asociados. Desactívalo en su lugar.'
  if (error.code === '42501') return 'No tienes permiso para hacer esto.'
  if (m.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('Email not confirmed')) return 'Tienes que confirmar tu email antes de entrar.'
  if (m.includes('User already registered')) return 'Ya existe una cuenta con ese email.'
  if (m.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  return m || 'Error desconocido'
}
