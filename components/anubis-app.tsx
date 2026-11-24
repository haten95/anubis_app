'use client'

import clsx from 'clsx'
import { ArrowLeft, BarChart3, BookOpen, LayoutGrid, LogOut, MoreHorizontal, Package, Settings2, Users, Wallet } from 'lucide-react'
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
import { useCapa, useHayCapas, volver } from '@/lib/navegacion'

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
  const hayCapas = useHayCapas()
  const actual = SECCIONES.find((s) => s.id === seccion)!
  const IconoActual = actual.icono

  // «Atrás» desde cualquier sección vuelve a la Sala (y desde la Sala sale de la app)
  useCapa(seccion !== 'sala', () => setSeccion('sala'))
  // El menú «Más» también se cierra con «atrás»
  useCapa(mas, () => setMas(false))

  function ir(id: Seccion) {
    setSeccion(id)
    setMas(false)
    window.scrollTo({ top: 0 })
  }

  const avisoStock = (id: Seccion) => id === 'stock' && stockBajos > 0

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
              onClick={() => ir(id)}
              aria-current={seccion === id ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition',
                seccion === id ? 'bg-oro/15 text-oro-claro' : 'text-suave hover:bg-panel-2 hover:text-texto',
              )}
            >
              <Icono size={18} />
              {nombre}
              {avisoStock(id) && (
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

      {/* Cabecera móvil y tablet: volver + dónde estás */}
      <header className="sticky top-0 z-30 border-b border-linea bg-fondo/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-1 px-2">
          {hayCapas ? (
            <button
              onClick={volver}
              className="tactil flex items-center rounded-xl px-2.5 py-2 text-oro-claro hover:bg-panel-2"
              aria-label="Volver"
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <span className="px-2">
              <Logo tamano={30} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {seccion === 'sala' && !hayCapas ? (
              <p className="font-display text-lg font-bold tracking-[0.25em] text-oro-claro">ANUBIS</p>
            ) : (
              <p className="flex items-center gap-2 truncate font-display text-lg text-oro-claro">
                <IconoActual size={18} />
                {actual.nombre}
              </p>
            )}
          </div>
          <span className="hidden max-w-28 truncate text-xs text-suave sm:block">{perfil.nombre}</span>
          <button
            onClick={() => {
              if (confirm('¿Cerrar sesión?')) getSupabase().auth.signOut()
            }}
            className="tactil rounded-xl p-2.5 text-suave hover:bg-panel-2"
            aria-label="Cerrar sesión"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:pb-10 lg:pt-8">
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
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-linea bg-panel/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.25)] backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${principales.length + (resto.length ? 1 : 0)}, minmax(0, 1fr))` }}
        aria-label="Secciones"
      >
        {principales.map(({ id, nombre, icono: Icono }) => (
          <BotonNav key={id} activo={seccion === id && !mas} aviso={avisoStock(id)} onClick={() => ir(id)} nombre={nombre}>
            <Icono size={21} />
          </BotonNav>
        ))}
        {resto.length > 0 && (
          <BotonNav
            activo={mas || resto.some((r) => r.id === seccion)}
            aviso={resto.some((r) => avisoStock(r.id))}
            onClick={() => setMas(!mas)}
            nombre="Más"
            expandido={mas}
          >
            <MoreHorizontal size={21} />
          </BotonNav>
        )}
      </nav>
      {mas && (
        <div className="fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px] lg:hidden" onClick={() => setMas(false)}>
          <div
            className="aparecer absolute inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] rounded-2xl border border-linea bg-panel p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-widest text-suave">Más secciones</p>
            {resto.map(({ id, nombre, icono: Icono }) => (
              <button
                key={id}
                onClick={() => ir(id)}
                className={clsx(
                  'tactil flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left font-semibold',
                  seccion === id ? 'bg-oro/15 text-oro-claro' : 'text-texto hover:bg-panel-2',
                )}
              >
                <Icono size={20} />
                {nombre}
                {avisoStock(id) && <span className="ml-auto rounded-full bg-peligro px-2 text-[11px] font-bold text-fondo">{stockBajos}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BotonNav({
  activo,
  aviso,
  onClick,
  nombre,
  expandido,
  children,
}: {
  activo: boolean
  aviso: boolean
  onClick: () => void
  nombre: string
  expandido?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-current={activo && expandido === undefined ? 'page' : undefined}
      aria-expanded={expandido}
      className={clsx(
        'relative flex flex-col items-center gap-1 pb-2 pt-2 text-[11px] font-semibold transition',
        activo ? 'text-oro-claro' : 'text-suave active:text-texto',
      )}
    >
      {/* Indicador superior de la sección activa */}
      <span className={clsx('absolute top-0 h-0.5 w-8 rounded-full transition', activo ? 'bg-oro' : 'bg-transparent')} />
      <span className={clsx('relative flex h-8 w-14 items-center justify-center rounded-full transition', activo && 'bg-oro/15')}>
        {children}
        {aviso && <span className="absolute right-2.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-peligro" aria-label="Productos bajo mínimo" />}
      </span>
      {nombre}
    </button>
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
