'use client'

import { Flame, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { cantidadStock, euros, parseCantidad } from '@/lib/format'
import type { Articulo, ProductoStock, Receta, Sabor } from '@/lib/types'
import { Aviso, Boton, Campo, Entrada, Modal, Selector, Vacio } from './ui'

/**
 * Escandallo de un artículo: qué productos de stock gasta cada unidad vendida.
 * En las shishas, además, los gramos de tabaco por carga (se reparten entre los sabores según su %).
 */
export function EscandalloModal({
  articulo,
  esShisha,
  productos,
  sabores,
  onCerrar,
  onCambio,
}: {
  articulo: Articulo | null
  esShisha: boolean
  productos: ProductoStock[]
  sabores: Sabor[]
  onCerrar: () => void
  onCambio: () => void
}) {
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [nuevo, setNuevo] = useState<number | ''>('')
  const [cantidad, setCantidad] = useState('')
  const [gramos, setGramos] = useState('')
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState('')

  const cargar = useCallback(async () => {
    if (!articulo) return
    const { data, error } = await getSupabase().from('recetas').select('*').eq('articulo_id', articulo.id)
    if (error) setError(mensajeError(error))
    setRecetas(((data as Receta[]) ?? []).map((r) => ({ ...r, cantidad: Number(r.cantidad) })))
  }, [articulo])

  useEffect(() => {
    setError('')
    setGuardado('')
    setNuevo('')
    setCantidad('')
    setGramos(articulo?.gramos_tabaco ? String(articulo.gramos_tabaco).replace('.', ',') : '')
    cargar()
  }, [articulo, cargar])

  if (!articulo) return null

  const porId = new Map(productos.map((p) => [p.id, p]))
  const elegido = nuevo === '' ? null : porId.get(nuevo)

  async function anadir() {
    const c = parseCantidad(cantidad)
    if (nuevo === '' || c === null || c <= 0) return setError('Elige un producto y una cantidad mayor que 0.')
    const { error } = await getSupabase()
      .from('recetas')
      .upsert({ articulo_id: articulo!.id, producto_id: nuevo, cantidad: c })
    if (error) return setError(mensajeError(error))
    setNuevo('')
    setCantidad('')
    setError('')
    cargar()
  }

  async function quitar(productoId: number) {
    const { error } = await getSupabase().from('recetas').delete().eq('articulo_id', articulo!.id).eq('producto_id', productoId)
    if (error) return setError(mensajeError(error))
    cargar()
  }

  async function guardarGramos() {
    const g = gramos.trim() === '' ? null : parseCantidad(gramos)
    if (gramos.trim() !== '' && (g === null || g < 1 || g > 100)) return setError('Los gramos por carga deben estar entre 1 y 100.')
    const { error } = await getSupabase().from('articulos').update({ gramos_tabaco: g }).eq('id', articulo!.id)
    if (error) return setError(mensajeError(error))
    setGuardado('Gramos guardados.')
    onCambio()
  }

  // Coste estimado: receta + tabaco al coste medio de los sabores con producto
  const costeReceta = recetas.reduce((t, r) => t + r.cantidad * (porId.get(r.producto_id)?.coste_unitario ?? 0), 0)
  const tabacos = sabores.map((s) => (s.producto_id ? porId.get(s.producto_id) : undefined)).filter((p): p is ProductoStock => !!p)
  const costeGramo = tabacos.length ? tabacos.reduce((t, p) => t + p.coste_unitario, 0) / tabacos.length : 0
  const g = parseCantidad(gramos) ?? 0
  const coste = costeReceta + (esShisha ? g * costeGramo : 0)
  const margen = articulo.precio > 0 ? ((articulo.precio / (1 + articulo.iva / 100) - coste) / (articulo.precio / (1 + articulo.iva / 100))) * 100 : null

  return (
    <Modal abierto titulo={`Escandallo · ${articulo.nombre}`} onCerrar={onCerrar}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-suave">
          Lo que se gasta del almacén por cada unidad vendida. Se descuenta solo al cobrar (o al cerrar como merma).
        </p>

        {esShisha && (
          <div className="rounded-2xl border border-oro/30 bg-oro/5 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-oro-claro">
              <Flame size={16} /> Tabaco por carga
            </p>
            <div className="flex items-end gap-2">
              <Campo etiqueta="Gramos por cazoleta">
                <Entrada inputMode="decimal" value={gramos} onChange={(e) => setGramos(e.target.value)} placeholder="20" className="w-28" />
              </Campo>
              <Boton onClick={guardarGramos}>Guardar</Boton>
            </div>
            <p className="mt-2 text-xs text-suave">
              Se reparten según el % de cada sabor (p. ej. 20 g al 50/50 = 10 g de cada uno). Cada sabor debe tener su producto de tabaco
              (Carta → Shisha → editar sabor).
              {sabores.filter((s) => s.activo && !s.producto_id).length > 0 &&
                ` Sin producto ahora: ${sabores.filter((s) => s.activo && !s.producto_id).map((s) => s.nombre).join(', ')}.`}
            </p>
          </div>
        )}

        {recetas.length === 0 ? (
          <Vacio>{esShisha ? 'Añade lo que gasta además del tabaco (carbón, papel de aluminio…).' : 'Sin productos. Añade lo que lleva (p. ej. 50 ml de ron, 1 lata de cola).'}</Vacio>
        ) : (
          <ul className="divide-y divide-linea rounded-2xl border border-linea">
            {recetas.map((r) => {
              const p = porId.get(r.producto_id)
              return (
                <li key={r.producto_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 font-semibold">{p?.nombre ?? 'Producto'}</span>
                  <span className="font-display text-oro-claro">{p ? cantidadStock(r.cantidad, p.unidad) : r.cantidad}</span>
                  <button onClick={() => quitar(r.producto_id)} className="rounded-lg p-2 text-suave hover:bg-peligro/10 hover:text-peligro" aria-label="Quitar">
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {productos.length === 0 ? (
          <Aviso tono="info">Primero crea productos en Stock → Inventario.</Aviso>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Campo etiqueta="Producto">
              <Selector value={nuevo} onChange={(e) => setNuevo(e.target.value === '' ? '' : Number(e.target.value))} className="min-w-48">
                <option value="">— Elige —</option>
                {productos
                  .filter((p) => p.activo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </Selector>
            </Campo>
            <Campo etiqueta={`Cantidad${elegido ? ` (${elegido.unidad})` : ''}`}>
              <Entrada inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-24" />
            </Campo>
            <Boton onClick={anadir}>
              <Plus size={16} /> Añadir
            </Boton>
          </div>
        )}

        {coste > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fondo/60 px-4 py-3 text-sm">
            <span className="text-suave">Coste aproximado por unidad</span>
            <span className="font-display text-lg">
              {euros(coste)}
              {margen !== null && <span className="ml-2 text-xs text-suave">· margen {Math.round(margen)}% sin IVA</span>}
            </span>
          </div>
        )}

        <Aviso>{error}</Aviso>
        <Aviso tono="ok">{guardado}</Aviso>
      </div>
    </Modal>
  )
}
