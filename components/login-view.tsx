'use client'

import { useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { Aviso, Boton, Campo, Entrada } from './ui'
import { Logo } from './logo'
import { FondoOasis, Friso, Loto, SolAlado } from './decoracion'

export function LoginView() {
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setEnviando(true)
    const supabase = getSupabase()
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) setError(mensajeError(error))
      } else {
        if (!nombre.trim()) {
          setError('Escribe tu nombre.')
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { nombre: nombre.trim() }, emailRedirectTo: window.location.origin },
        })
        if (error) setError(mensajeError(error))
        else if (!data.session) setInfo('Cuenta creada. Revisa tu email para confirmarla y después entra.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <FondoOasis intensidad="viva" />
      <div className="aparecer w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <SolAlado className="mb-3 w-64 opacity-90" />
          <Logo tamano={64} />
          <h1 className="mt-4 font-display text-4xl font-bold tracking-[0.3em] text-oro-claro">ANUBIS</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.35em] text-suave">Shisha lounge · Gestión</p>
          <Friso className="mt-4 w-56" />
        </div>

        <form onSubmit={enviar} className="relative flex flex-col gap-4 rounded-3xl border border-linea bg-panel/85 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm">
          <Loto className="absolute -top-5 left-1/2 w-12 -translate-x-1/2 rounded-full bg-panel px-1.5" />
          <div className="grid grid-cols-2 rounded-xl bg-fondo/70 p-1 text-sm">
            {(['entrar', 'registro'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`rounded-lg py-2 font-semibold transition ${modo === m ? 'bg-panel-2 text-oro-claro' : 'text-suave'}`}
              >
                {m === 'entrar' ? 'Entrar' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {modo === 'registro' && (
            <Campo etiqueta="Nombre">
              <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={80} required />
            </Campo>
          )}
          <Campo etiqueta="Email">
            <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Campo>
          <Campo etiqueta="Contraseña">
            <Entrada
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </Campo>

          <Aviso>{error}</Aviso>
          <Aviso tono="ok">{info}</Aviso>

          <Boton variante="oro" type="submit" disabled={enviando}>
            {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </Boton>

          {modo === 'registro' && (
            <p className="text-center text-xs text-suave">
              El dueño tiene que activar tu cuenta antes de que puedas usar la app.
            </p>
          )}
        </form>
      </div>
    </main>
  )
}
