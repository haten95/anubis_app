'use client'

import clsx from 'clsx'
import { Sofa, Sun, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocal } from '@/lib/use-local'
import { rpc, totalLineas, useServicio } from '@/lib/use-servicio'
import { euros, haceCuanto } from '@/lib/format'
import { NOMBRE_TIPO_ZONA, type Comanda, type Usuario } from '@/lib/types'
import { Aviso, Cargando, Titulo, Vacio } from './ui'
import { MesaIcono, type EstadoMesa } from './mesa-icono'
import { ComandaView } from './comanda-view'

export function SalaView({ perfil }: { perfil: Usuario }) {
  const { zonas, mesas, error: errorLocal } = useLocal()
  const { estado, error: errorServicio, recargar } = useServicio()
  const [zonaSel, setZonaSel] = useState<number | 'todas'>('todas')
  const [mesaAbierta, setMesaAbierta] = useState<number | null>(null)
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [, setReloj] = useState(0)

  // Refresca los "hace X min" cada minuto
  useEffect(() => {
    const t = setInterval(() => setReloj((x) => x + 1), 60000)
    return () => clearInterval(t)
  }, [])

  if (zonas === null || estado === null) return <Cargando />

  const comandaDeMesa = new Map<number, Comanda>(estado.comandas.map((c) => [c.mesa_id, c]))

  if (mesaAbierta !== null) {
    const mesa = mesas.find((m) => m.id === mesaAbierta)
    const comanda = comandaDeMesa.get(mesaAbierta)
    if (mesa) {
      return (
        <ComandaView
          perfil={perfil}
          mesa={mesa}
          comanda={comanda ?? null}
          lineas={comanda ? estado.lineas.filter((l) => l.comanda_id === comanda.id) : []}
          mesas={mesas}
          zonas={zonas}
          comandaDeMesa={comandaDeMesa}
          hayCaja={estado.caja !== null}
          recargar={recargar}
          onVolver={() => setMesaAbierta(null)}
          onIrAMesa={setMesaAbierta}
        />
      )
    }
  }

  async function pulsarMesa(mesaId: number) {
    setError('')
    if (comandaDeMesa.has(mesaId)) {
      setMesaAbierta(mesaId)
      return
    }
    setAbriendo(mesaId)
    const { error } = await rpc('abrir_comanda', { p_mesa: mesaId })
    await recargar()
    setAbriendo(null)
    // Si otro dispositivo la abrió a la vez, entramos igualmente en su comanda
    if (error && !error.includes('ya tiene una comanda')) return setError(error)
    setMesaAbierta(mesaId)
  }

  const activas = zonas.filter((z) => z.activa)
  const visibles = zonaSel === 'todas' ? activas : activas.filter((z) => z.id === zonaSel)
  const ocupadas = estado.comandas.length

  return (
    <div className="aparecer">
      <Titulo>Sala</Titulo>
      <div className="mb-4 flex flex-col gap-2">
        <Aviso>{errorLocal || errorServicio || error}</Aviso>
        {!estado.caja && (
          <Aviso tono="info">
            <span className="inline-flex items-center gap-2">
              <Wallet size={16} /> No hay caja abierta: se pueden tomar comandas, pero no cobrar hasta que el dueño o el
              encargado la abra.
            </span>
          </Aviso>
        )}
      </div>

      {activas.length === 0 ? (
        <Vacio>Todavía no hay zonas ni mesas. El dueño puede crearlas en «Local».</Vacio>
      ) : (
        <>
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <Pestana activa={zonaSel === 'todas'} onClick={() => setZonaSel('todas')}>
              Todas
            </Pestana>
            {activas.map((z) => {
              const n = mesas.filter((m) => m.zona_id === z.id && comandaDeMesa.has(m.id)).length
              return (
                <Pestana key={z.id} activa={zonaSel === z.id} onClick={() => setZonaSel(z.id)}>
                  {z.tipo === 'terraza' ? <Sun size={15} /> : <Sofa size={15} />}
                  {z.nombre}
                  {n > 0 && <span className="rounded-full bg-oro px-1.5 text-[11px] font-bold text-fondo">{n}</span>}
                </Pestana>
              )
            })}
          </div>

          <Leyenda ocupadas={ocupadas} />

          <div className="flex flex-col gap-6">
            {visibles.map((zona) => {
              const suyas = mesas.filter((m) => m.zona_id === zona.id && m.activa)
              return (
                <section key={zona.id}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-suave">
                    {zona.tipo === 'terraza' ? <Sun size={15} className="text-terraza" /> : <Sofa size={15} className="text-oro" />}
                    {zona.nombre}
                    <span className="font-normal normal-case tracking-normal">· {NOMBRE_TIPO_ZONA[zona.tipo]}</span>
                  </h3>
                  {suyas.length === 0 ? (
                    <Vacio>Esta zona no tiene mesas.</Vacio>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(108px,1fr))] sm:gap-3">
                      {suyas.map((m) => {
                        const c = comandaDeMesa.get(m.id)
                        const est: EstadoMesa = !c ? 'libre' : c.estado === 'cuenta' ? 'cobro' : 'ocupada'
                        const total = c ? totalLineas(estado.lineas.filter((l) => l.comanda_id === c.id)) : 0
                        return (
                          <button
                            key={m.id}
                            onClick={() => pulsarMesa(m.id)}
                            disabled={abriendo !== null}
                            className={clsx(
                              'tactil flex min-w-0 flex-col items-center rounded-2xl border p-1.5 pb-2.5 transition active:scale-[0.97] disabled:opacity-60 sm:p-2 sm:pb-3',
                              est === 'libre' && 'border-linea bg-panel/70 hover:border-oro-oscuro hover:bg-panel-2',
                              est === 'ocupada' && 'border-oro/50 bg-oro/10 hover:bg-oro/15',
                              est === 'cobro' && 'border-peligro/50 bg-peligro/10 hover:bg-peligro/15',
                            )}
                            title={`Mesa ${m.numero}`}
                          >
                            <MesaIcono numero={m.numero} capacidad={m.capacidad} estado={est} className="h-auto w-full max-w-[92px]" />
                            {c ? (
                              <>
                                <span className="font-display text-sm font-bold text-oro-claro">{euros(total)}</span>
                                <span className="text-[11px] text-suave">
                                  {est === 'cobro' ? 'Pide la cuenta' : haceCuanto(c.abierta_en)}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-suave">{abriendo === m.id ? 'Abriendo…' : 'Libre'}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Pestana({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'tactil flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
        activa ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
      )}
    >
      {children}
    </button>
  )
}

function Leyenda({ ocupadas }: { ocupadas: number }) {
  const items = [
    { color: 'bg-[#5e8a6c]', texto: 'Libre' },
    { color: 'bg-oro', texto: 'Ocupada' },
    { color: 'bg-peligro', texto: 'Pide la cuenta' },
  ]
  return (
    <div className="mb-5 flex flex-wrap items-center gap-4 text-xs text-suave">
      {items.map((i) => (
        <span key={i.texto} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${i.color}`} />
          {i.texto}
        </span>
      ))}
      <span className="ml-auto font-semibold text-oro-claro">
        {ocupadas} {ocupadas === 1 ? 'mesa ocupada' : 'mesas ocupadas'}
      </span>
    </div>
  )
}
