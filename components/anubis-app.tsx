'use client'

import clsx from 'clsx'
import { BarChart3, BookOpen, LayoutGrid, LogOut, MoreHorizontal, Package, Settings2, Users, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState, type ComponentType } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, supabaseConfigurado } from '@/lib/supabase/client'
import { NOMBRE_ROL, type Rol, type Usuario } from '@/lib/types'
import { Boton, Cargando, Panel } from './ui'
import { Logo, Marca } from './logo'
import { FondoOasis, Friso, Loto, OjoHorus, SolAlado } from './decoracion'
import { LoginView } from './login-view'
import { SalaView } from './sala-view'
import { ConfigLocal } from './config-local'
import { CartaView } from './carta-view'
import { CajaView } from './caja-view'
import { StockView } from './stock-view'
import { PersonalView } from './personal-view'
import { InformesView } from './informes-view'
import { useAvisosStock } from '@/lib/use-stock'

type Seccion = 'sala' | 'caja' | 'carta' | 'stock' | 'personal' | 'informes' | 'local'

const SECCIONES: { id: Seccion; nombre: string; icono: ComponentType<{ size?: number }>; roles: Rol[] }[] = [
  { id: 'sala', nombre: 'Sala', icono: LayoutGrid, roles: ['dueno', 'encargado', 'empleado'] },
  { id: 'caja', nombre: 'Caja', icono: Wallet, roles: ['dueno', 'encargado'] },
  { id: 'carta', nombre: 'Carta', icono: BookOpen, roles: ['dueno', 'encargado', 'empleado'] },
  { id: 'stock', nombre: 'Stock', icono: Package, roles: ['dueno', 'encargado', 'empleado'] },
  { id: 'personal', nombre: 'Personal', icono: Users, roles: ['dueno', 'encargado', 'empleado'] },
  { id: 'informes', nombre: 'Informes', icono: BarChart3, roles: ['dueno'] },
  { id: 'local', nombre: 'Local', icono: Settings2, roles: ['dueno'] },
]

export function AnubisApp() {
  if (!supabaseConfigurado) return <FaltaConfiguracion />
  return <ConSesion />
}

function ConSesion() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [perfil, setPerfil] = useState<Usuario | null | undefined>(undefined)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const cargarPerfil = useCallback(async (id: string) => {
    const { data } = await getSupabase().from('usuarios').select('*').eq('id', id).maybeSingle()
    setPerfil((data as Usuario | null) ?? null)
  }, [])

  const idUsuario = session?.user.id
  useEffect(() => {
    if (!idUsuario) {
      setPerfil(undefined)
      return
    }
    cargarPerfil(idUsuario)
  }, [idUsuario, cargarPerfil])

  if (session === undefined) return <PantallaCarga />
  if (!session) return <LoginView />
  if (perfil === undefined) return <PantallaCarga />
  if (!perfil || !perfil.activo) {
    return <PendienteActivacion nombre={perfil?.nombre} onReintentar={() => cargarPerfil(session.user.id)} />
  }
  return <Escritorio perfil={perfil} />
}

function Escritorio({ perfil }: { perfil: Usuario }) {
  const disponibles = SECCIONES.filter((s) => s.roles.includes(perfil.rol))
  const stockBajos = useAvisosStock()
  const [mas, setMas] = useState(false)
  const principales = disponibles.length > 5 ? disponibles.slice(0, 4) : disponibles
  const resto = disponibles.length > 5 ? disponibles.slice(4) : []
  const [seccion, setSeccion] = useState<Seccion>('sala')

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <FondoOasis />
      {/* Barra lateral (escritorio y TPV horizontal) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-linea bg-panel/75 p-5 backdrop-blur-sm lg:flex">
        <Marca />
        <Friso className="mt-4 opacity-70" />
        <nav className="mt-8 flex flex-col gap-1">
          {disponibles.map(({ id, nombre, icono: Icono }) => (
            <button
              key={id}
              onClick={() => setSeccion(id)}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition',
                seccion === id ? 'bg-oro/15 text-oro-claro' : 'text-suave hover:bg-panel-2 hover:text-texto',
              )}
            >
              <Icono size={18} />
              {nombre}
              {id === 'stock' && stockBajos > 0 && (
                <span className="ml-auto rounded-full bg-peligro px-2 text-[11px] font-bold text-fondo" title="Productos bajo mínimo">
                  {stockBajos}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col items-center pb-4 opacity-60">
          <OjoHorus className="w-16" />
          <Loto className="mt-3 w-10" color="#7cc28f" />
        </div>
        <div className="border-t border-linea pt-4">
          <p className="truncate text-sm font-semibold">{perfil.nombre}</p>
          <p className="text-xs text-suave">{NOMBRE_ROL[perfil.rol]}</p>
          <Boton variante="fantasma" className="mt-3 w-full justify-start px-2" onClick={() => getSupabase().auth.signOut()}>
            <LogOut size={16} /> Cerrar sesión
          </Boton>
        </div>
      </aside>

      {/* Cabecera móvil y tablet */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-linea bg-fondo/85 px-4 py-3 backdrop-blur lg:hidden">
        <Marca />
        <button
          onClick={() => getSupabase().auth.signOut()}
          className="rounded-lg p-2 text-suave hover:bg-panel-2"
          aria-label="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
        {seccion === 'sala' && <SalaView perfil={perfil} />}
        {seccion === 'caja' && perfil.rol !== 'empleado' && <CajaView perfil={perfil} />}
        {seccion === 'stock' && <StockView perfil={perfil} />}
        {seccion === 'carta' && <CartaView perfil={perfil} />}
        {seccion === 'local' && perfil.rol === 'dueno' && <ConfigLocal />}
        {seccion === 'personal' && <PersonalView perfil={perfil} />}
        {seccion === 'informes' && perfil.rol === 'dueno' && <InformesView />}
      </main>

      {/* Navegación inferior en móvil y tablet: 4 secciones + «Más» si no caben */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-linea bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${principales.length + (resto.length ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {principales.map(({ id, nombre, icono: Icono }) => (
          <button
            key={id}
            onClick={() => {
              setSeccion(id)
              setMas(false)
            }}
            className={clsx(
              'relative flex flex-col items-center gap-1 py-3 text-xs font-semibold',
              seccion === id ? 'text-oro-claro' : 'text-suave',
            )}
          >
            <Icono size={20} />
            {nombre}
            {id === 'stock' && stockBajos > 0 && (
              <span className="absolute right-[calc(50%-18px)] top-2 h-2.5 w-2.5 rounded-full bg-peligro" aria-label="Productos bajo mínimo" />
            )}
          </button>
        ))}
        {resto.length > 0 && (
          <button
            onClick={() => setMas(!mas)}
            aria-expanded={mas}
            className={clsx(
              'relative flex flex-col items-center gap-1 py-3 text-xs font-semibold',
              mas || resto.some((r) => r.id === seccion) ? 'text-oro-claro' : 'text-suave',
            )}
          >
            <MoreHorizontal size={20} />
            Más
            {resto.some((r) => r.id === 'stock') && stockBajos > 0 && (
              <span className="absolute right-[calc(50%-18px)] top-2 h-2.5 w-2.5 rounded-full bg-peligro" />
            )}
          </button>
        )}
      </nav>
      {mas && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setMas(false)}>
          <div
            className="aparecer absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] rounded-2xl border border-linea bg-panel p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {resto.map(({ id, nombre, icono: Icono }) => (
              <button
                key={id}
                onClick={() => {
                  setSeccion(id)
                  setMas(false)
                }}
                className={clsx(
                  'tactil flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold',
                  seccion === id ? 'bg-oro/15 text-oro-claro' : 'text-texto hover:bg-panel-2',
                )}
              >
                <Icono size={18} />
                {nombre}
                {id === 'stock' && stockBajos > 0 && (
                  <span className="ml-auto rounded-full bg-peligro px-2 text-[11px] font-bold text-fondo">{stockBajos}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PantallaCarga() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <FondoOasis />
      <SolAlado className="w-56 opacity-80" />
      <Logo tamano={56} />
      <Cargando />
    </main>
  )
}

function PendienteActivacion({ nombre, onReintentar }: { nombre?: string; onReintentar: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <FondoOasis intensidad="viva" />
      <Panel className="aparecer max-w-sm text-center">
        <div className="mb-4 flex justify-center">
          <Logo tamano={56} />
        </div>
        <h1 className="font-display text-xl text-oro-claro">Cuenta pendiente</h1>
        <p className="mt-3 text-sm text-suave">
          {nombre ? `Hola, ${nombre}. ` : ''}El dueño tiene que activar tu cuenta y asignarte un rol antes de que puedas
          usar la app.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Boton onClick={onReintentar}>Comprobar de nuevo</Boton>
          <Boton variante="fantasma" onClick={() => getSupabase().auth.signOut()}>
            Salir
          </Boton>
        </div>
      </Panel>
    </main>
  )
}

function FaltaConfiguracion() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Panel className="max-w-md">
        <h1 className="font-display text-xl text-oro-claro">Falta conectar Supabase</h1>
        <p className="mt-3 text-sm text-suave">
          Crea el archivo <code className="text-texto">.env.local</code> con <code className="text-texto">NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
          <code className="text-texto">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (tienes un ejemplo en{' '}
          <code className="text-texto">.env.example</code>) y reinicia el servidor.
        </p>
      </Panel>
    </main>
  )
}
