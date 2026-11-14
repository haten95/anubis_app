'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { NOMBRE_ROL, type Rol, type Usuario } from '@/lib/types'
import { Aviso, Cargando, Etiqueta, Interruptor, Panel, Selector, Vacio } from './ui'

export function EquipoView({ perfil }: { perfil: Usuario }) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    const { data, error } = await getSupabase().from('usuarios').select('*').order('activo').order('nombre')
    if (error) setError(mensajeError(error))
    setUsuarios((data as Usuario[]) ?? [])
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  async function actualizar(id: string, cambios: Partial<Pick<Usuario, 'rol' | 'activo'>>) {
    setError('')
    const { error } = await getSupabase().from('usuarios').update(cambios).eq('id', id)
    if (error) setError(mensajeError(error))
    await recargar()
  }

  if (usuarios === null) return <Cargando />

  const pendientes = usuarios.filter((u) => !u.activo)

  return (
    <div className="aparecer">
      <p className="mb-5 text-sm text-suave">
        Los trabajadores se registran desde la pantalla de inicio con «Crear cuenta». Aquí los activas y les asignas el rol.
      </p>
      <div className="mb-4 flex flex-col gap-2">
        <Aviso>{error}</Aviso>
        {pendientes.length > 0 && (
          <Aviso tono="info">
            {pendientes.length === 1 ? 'Hay 1 cuenta pendiente de activar.' : `Hay ${pendientes.length} cuentas pendientes de activar.`}
          </Aviso>
        )}
      </div>

      {usuarios.length === 0 ? (
        <Vacio>No hay usuarios.</Vacio>
      ) : (
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y divide-linea">
            {usuarios.map((u) => {
              const yo = u.id === perfil.id
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel-2 font-display text-oro-claro">
                    {u.nombre.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {u.nombre} {yo && <Etiqueta tono="oro">Tú</Etiqueta>} {!u.activo && <Etiqueta tono="peligro">Pendiente</Etiqueta>}
                    </p>
                    <p className="truncate text-sm text-suave">{u.email}</p>
                  </div>
                  <Selector
                    value={u.rol}
                    onChange={(e) => actualizar(u.id, { rol: e.target.value as Rol })}
                    className="w-auto min-w-36"
                    aria-label={`Rol de ${u.nombre}`}
                  >
                    {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => (
                      <option key={r} value={r}>
                        {NOMBRE_ROL[r]}
                      </option>
                    ))}
                  </Selector>
                  <div className="flex items-center gap-2 text-sm text-suave">
                    Activo
                    <Interruptor activo={u.activo} onCambio={(v) => actualizar(u.id, { activo: v })} etiqueta={`Activar a ${u.nombre}`} disabled={yo} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </div>
  )
}
