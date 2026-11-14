'use client'

import clsx from 'clsx'
import { Check, Flame, Scale, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { euros } from '@/lib/format'
import { fijarPorcentaje, MAX_SABORES, PASO, repartoIgual, suma, type Porcion } from '@/lib/shisha'
import type { Articulo, Sabor } from '@/lib/types'
import { Aviso, Boton, Campo, Entrada, Modal } from './ui'
import { CazoletaEditable } from './cazoleta'

export function ShishaModal({
  articulo,
  sabores,
  onCerrar,
  onConfirmar,
}: {
  articulo: Articulo | null
  sabores: Sabor[]
  onCerrar: () => void
  onConfirmar: (porciones: Porcion[], notas: string) => Promise<string | null>
}) {
  const [porciones, setPorciones] = useState<Porcion[]>([])
  const [notas, setNotas] = useState('')
  const [buscar, setBuscar] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Empieza de cero cada vez que se abre
  useEffect(() => {
    if (articulo) {
      setPorciones([])
      setNotas('')
      setBuscar('')
      setError('')
    }
  }, [articulo])

  const porId = new Map(sabores.map((s) => [s.id, s]))
  const elegidos = porciones.map((p) => porId.get(p.saborId)!).filter(Boolean)
  const total = suma(porciones)

  function alternar(s: Sabor) {
    setError('')
    const ya = porciones.findIndex((p) => p.saborId === s.id)
    let nuevas: Porcion[]
    if (ya >= 0) nuevas = porciones.filter((_, i) => i !== ya)
    else if (porciones.length >= MAX_SABORES) return setError(`Máximo ${MAX_SABORES} sabores por cazoleta.`)
    else nuevas = [...porciones, { saborId: s.id, porcentaje: 0 }]
    // Al añadir o quitar sabores se reparte a partes iguales; luego se ajusta a mano
    const reparto = repartoIgual(nuevas.length)
    setPorciones(nuevas.map((p, i) => ({ ...p, porcentaje: reparto[i] })))
  }

  async function confirmar() {
    if (porciones.length === 0) return setError('Elige al menos un sabor.')
    if (total !== 100) return setError(`La cazoleta tiene que llegar al 100 % (ahora ${total} %).`)
    setEnviando(true)
    const err = await onConfirmar(porciones, notas)
    setEnviando(false)
    setError(err ?? '')
  }

  const filtrados = sabores.filter(
    (s) => !buscar.trim() || `${s.nombre} ${s.marca ?? ''}`.toLowerCase().includes(buscar.trim().toLowerCase()),
  )

  return (
    <Modal abierto={articulo !== null} titulo={`${articulo?.nombre ?? 'Shisha'} · ${euros(articulo?.precio ?? 0)}`} onCerrar={onCerrar} ancho="grande">
      <div className="grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start">
        {/* Cazoleta y ajuste fino */}
        <div className="flex flex-col gap-4 md:sticky md:top-0">
        <div className="flex justify-center rounded-2xl bg-fondo/60 py-3">
          <CazoletaEditable
            porciones={porciones}
            colores={elegidos.map((s) => s.color)}
            nombres={elegidos.map((s) => s.nombre)}
            onCambio={setPorciones}
            tamano={220}
          />
        </div>

        {/* Ajuste fino por sabor */}
        {porciones.length > 0 && (
          <div className="flex flex-col gap-3">
            {porciones.map((p, i) => {
              const s = porId.get(p.saborId)
              if (!s) return null
              return (
                <div key={p.saborId} className="flex items-center gap-3">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="w-24 shrink-0 truncate text-sm font-semibold">{s.nombre}</span>
                  <input
                    type="range"
                    min={PASO}
                    max={100}
                    step={PASO}
                    value={p.porcentaje}
                    onChange={(e) => setPorciones(fijarPorcentaje(porciones, i, Number(e.target.value)))}
                    className="h-8 flex-1"
                    style={{ accentColor: s.color }}
                    aria-label={`Porcentaje de ${s.nombre}`}
                  />
                  <span className="w-12 text-right font-display text-sm text-oro-claro">{p.porcentaje}%</span>
                  <button onClick={() => alternar(s)} className="rounded-lg p-1.5 text-suave hover:text-peligro" aria-label={`Quitar ${s.nombre}`}>
                    <X size={15} />
                  </button>
                </div>
              )
            })}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={clsx('text-sm font-semibold', total === 100 ? 'text-ok' : 'text-oro-claro')}>
                {total === 100 ? '100 % · lista para cargar' : `${total} % · faltan ${100 - total} %`}
              </span>
              {porciones.length > 1 && (
                <Boton variante="fantasma" className="px-2.5 py-1.5 text-xs" onClick={() => {
                  const r = repartoIgual(porciones.length)
                  setPorciones(porciones.map((p, i) => ({ ...p, porcentaje: r[i] })))
                }}>
                  <Scale size={14} /> Repartir igual
                </Boton>
              )}
            </div>
          </div>
        )}

        </div>

        {/* Sabores, nota y confirmar */}
        <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-suave">
              Sabores <span className="text-xs">({porciones.length}/{MAX_SABORES})</span>
            </p>
            {sabores.length > 8 && (
              <Entrada value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" className="max-w-40 py-1.5" />
            )}
          </div>
          {sabores.length === 0 ? (
            <p className="text-sm text-suave">No hay sabores. Añádelos en Carta → Shisha.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filtrados.map((s) => {
                const activo = porciones.some((p) => p.saborId === s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => alternar(s)}
                    className={clsx(
                      'tactil flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition',
                      activo ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-texto hover:border-oro-oscuro',
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: s.color }}>
                      {activo && <Check size={14} className="text-black/70" />}
                    </span>
                    {s.nombre}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <Campo etiqueta="Nota (opcional)">
          <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={200} placeholder="Suave, con hielo en la base…" />
        </Campo>

        <Aviso>{error}</Aviso>
        <Boton variante="oro" className="py-4 text-base" onClick={confirmar} disabled={enviando || total !== 100}>
          <Flame size={18} /> {enviando ? 'Añadiendo…' : 'Añadir a la comanda'}
        </Boton>
        </div>
      </div>
    </Modal>
  )
}
