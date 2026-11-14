'use client'

import clsx from 'clsx'
import { AlertTriangle, ArrowDownLeft, ClipboardCheck, Minus, Package, Pencil, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { useStock } from '@/lib/use-stock'
import { cantidadStock, euros, fechaCorta, parseCantidad } from '@/lib/format'
import {
  NOMBRE_TIPO_MOV,
  NOMBRE_UNIDAD,
  stockBajo,
  type MovimientoStock,
  type ProductoStock,
  type Proveedor,
  type Unidad,
  type Usuario,
} from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Interruptor, Modal, Panel, Selector, Titulo, Vacio } from './ui'
import { ProveedoresView } from './proveedores-view'
import { PedidosView } from './pedidos-view'

type Pestana = 'inventario' | 'pedidos' | 'proveedores' | 'movimientos'

export function StockView({ perfil }: { perfil: Usuario }) {
  const gestor = perfil.rol !== 'empleado'
  const { productos, proveedores, error, recargar } = useStock(gestor)
  const [pestana, setPestana] = useState<Pestana>('inventario')

  if (productos === null) return <Cargando />

  const pestanas: { id: Pestana; nombre: string }[] = gestor
    ? [
        { id: 'inventario', nombre: 'Inventario' },
        { id: 'pedidos', nombre: 'Pedidos' },
        { id: 'proveedores', nombre: 'Proveedores' },
        { id: 'movimientos', nombre: 'Movimientos' },
      ]
    : [{ id: 'inventario', nombre: 'Inventario' }]

  return (
    <div className="aparecer">
      <Titulo>Stock</Titulo>
      <div className="mb-4">
        <Aviso>{error}</Aviso>
      </div>

      {pestanas.length > 1 && (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {pestanas.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={clsx(
                'tactil shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
                pestana === p.id ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave hover:text-texto',
              )}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {pestana === 'inventario' && <Inventario productos={productos} proveedores={proveedores} gestor={gestor} recargar={recargar} />}
      {pestana === 'pedidos' && gestor && <PedidosView productos={productos} proveedores={proveedores} perfil={perfil} />}
      {pestana === 'proveedores' && gestor && <ProveedoresView proveedores={proveedores} productos={productos} recargar={recargar} />}
      {pestana === 'movimientos' && gestor && <Movimientos productos={productos} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------
type Operacion = { tipo: 'entrada' | 'merma' | 'recuento'; producto: ProductoStock }

function Inventario({
  productos,
  proveedores,
  gestor,
  recargar,
}: {
  productos: ProductoStock[]
  proveedores: Proveedor[]
  gestor: boolean
  recargar: () => Promise<void>
}) {
  const [buscar, setBuscar] = useState('')
  const [soloBajos, setSoloBajos] = useState(false)
  const [editando, setEditando] = useState<ProductoStock | 'nuevo' | null>(null)
  const [operacion, setOperacion] = useState<Operacion | null>(null)

  const bajos = productos.filter(stockBajo)
  const valor = productos.reduce((t, p) => t + Math.max(p.stock, 0) * p.coste_unitario, 0)
  const nombreProveedor = new Map(proveedores.map((p) => [p.id, p.nombre]))

  const visibles = productos.filter(
    (p) =>
      (gestor || p.activo) &&
      (!soloBajos || stockBajo(p)) &&
      (!buscar.trim() || p.nombre.toLowerCase().includes(buscar.trim().toLowerCase())),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Dato titulo="Productos" valor={String(productos.filter((p) => p.activo).length)} />
        <Dato titulo="Bajo mínimo" valor={String(bajos.length)} alerta={bajos.length > 0} />
        {gestor && <Dato titulo="Valor del inventario" valor={euros(valor)} detalle="Stock × coste" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar producto…" className="pl-9" />
        </div>
        <button
          onClick={() => setSoloBajos(!soloBajos)}
          className={clsx(
            'tactil inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition',
            soloBajos ? 'border-peligro/60 bg-peligro/10 text-peligro' : 'border-linea text-suave hover:text-texto',
          )}
        >
          <AlertTriangle size={16} /> Bajo mínimo
        </button>
        {gestor && (
          <Boton variante="oro" onClick={() => setEditando('nuevo')}>
            <Plus size={16} /> Producto
          </Boton>
        )}
      </div>

      {visibles.length === 0 ? (
        <Vacio>
          {productos.length === 0
            ? 'Todavía no hay productos. Crea los que quieras controlar: botellas, refrescos, tabaco por sabor, carbón…'
            : 'Ningún producto coincide.'}
        </Vacio>
      ) : (
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y divide-linea">
            {visibles.map((p) => {
              const bajo = stockBajo(p)
              const ref = Math.max(p.stock_minimo * 2, 1)
              const pct = Math.max(0, Math.min(100, (p.stock / ref) * 100))
              return (
                <li key={p.id} className={clsx('flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5', !p.activo && 'opacity-50')}>
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">
                      {p.nombre} {bajo && <Etiqueta tono="peligro">Bajo mínimo</Etiqueta>}
                      {!p.activo && <Etiqueta>Inactivo</Etiqueta>}
                    </p>
                    <p className="text-xs text-suave">
                      Mínimo {cantidadStock(p.stock_minimo, p.unidad)}
                      {p.proveedor_id && nombreProveedor.get(p.proveedor_id) && ` · ${nombreProveedor.get(p.proveedor_id)}`}
                      {gestor && p.coste_unitario > 0 && ` · ${euros(p.coste_unitario)}/${p.unidad}`}
                    </p>
                  </div>
                  <div className="w-36">
                    <p className={clsx('text-right font-display text-lg', bajo ? 'text-peligro' : 'text-oro-claro')}>
                      {cantidadStock(p.stock, p.unidad)}
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-linea">
                      <div className={clsx('h-full rounded-full', bajo ? 'bg-peligro' : 'bg-verde')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {gestor && (
                    <div className="flex items-center gap-1">
                      <BotonIcono titulo="Entrada" onClick={() => setOperacion({ tipo: 'entrada', producto: p })}>
                        <Plus size={16} />
                      </BotonIcono>
                      <BotonIcono titulo="Merma de almacén" onClick={() => setOperacion({ tipo: 'merma', producto: p })}>
                        <Minus size={16} />
                      </BotonIcono>
                      <BotonIcono titulo="Recuento" onClick={() => setOperacion({ tipo: 'recuento', producto: p })}>
                        <ClipboardCheck size={16} />
                      </BotonIcono>
                      <BotonIcono titulo="Editar" onClick={() => setEditando(p)}>
                        <Pencil size={16} />
                      </BotonIcono>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <Modal abierto={editando !== null} titulo={editando === 'nuevo' ? 'Nuevo producto' : 'Editar producto'} onCerrar={() => setEditando(null)}>
        {editando !== null && (
          <FormProducto
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            producto={editando === 'nuevo' ? null : editando}
            proveedores={proveedores}
            onHecho={async () => {
              setEditando(null)
              await recargar()
            }}
          />
        )}
      </Modal>

      <OperacionModal operacion={operacion} onCerrar={() => setOperacion(null)} onHecho={recargar} />
    </div>
  )
}

function BotonIcono({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={titulo} aria-label={titulo} className="tactil rounded-lg p-2.5 text-suave hover:bg-panel-2 hover:text-texto">
      {children}
    </button>
  )
}

function Dato({ titulo, valor, detalle, alerta }: { titulo: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border p-4', alerta ? 'border-peligro/40 bg-peligro/10' : 'border-linea bg-panel/80')}>
      <p className="text-xs uppercase tracking-widest text-suave">{titulo}</p>
      <p className={clsx('mt-1 font-display text-2xl font-bold', alerta ? 'text-peligro' : 'text-oro-claro')}>{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-suave">{detalle}</p>}
    </div>
  )
}

function FormProducto({
  producto,
  proveedores,
  onHecho,
}: {
  producto: ProductoStock | null
  proveedores: Proveedor[]
  onHecho: () => void
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [unidad, setUnidad] = useState<Unidad>(producto?.unidad ?? 'ud')
  const [minimo, setMinimo] = useState(producto ? String(producto.stock_minimo).replace('.', ',') : '0')
  const [coste, setCoste] = useState(producto ? String(producto.coste_unitario).replace('.', ',') : '0')
  const [proveedorId, setProveedorId] = useState<number | ''>(producto?.proveedor_id ?? '')
  const [activo, setActivo] = useState(producto?.activo ?? true)
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const m = parseCantidad(minimo)
    const c = Number(coste.trim().replace(',', '.'))
    if (!nombre.trim()) return setError('Escribe el nombre.')
    if (m === null) return setError('Stock mínimo no válido.')
    if (!Number.isFinite(c) || c < 0) return setError('Coste no válido.')
    const datos = { nombre: nombre.trim(), unidad, stock_minimo: m, coste_unitario: c, proveedor_id: proveedorId === '' ? null : proveedorId, activo }
    const supabase = getSupabase()
    const { error } = producto
      ? await supabase.from('productos_stock').update(datos).eq('id', producto.id)
      : await supabase.from('productos_stock').insert(datos)
    if (error) return setError(mensajeError(error))
    onHecho()
  }

  const costeNum = Number(coste.replace(',', '.'))
  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Tabaco menta, Ron blanco, Carbón…" required autoFocus />
      </Campo>
      <Campo etiqueta="Se cuenta en" ayuda={producto ? 'Cambiar la unidad no convierte el stock que ya hay.' : undefined}>
        <div className="grid grid-cols-3 gap-2">
          {(['ud', 'g', 'ml'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnidad(u)}
              className={clsx(
                'tactil rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                unidad === u ? 'border-oro bg-oro/15 text-oro-claro' : 'border-linea text-suave',
              )}
            >
              {NOMBRE_UNIDAD[u]}
            </button>
          ))}
        </div>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={`Stock mínimo (${unidad})`}>
          <Entrada inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </Campo>
        <Campo
          etiqueta={`Coste por ${unidad} (€)`}
          ayuda={unidad !== 'ud' && costeNum > 0 ? `= ${euros(costeNum * 1000)} por ${unidad === 'g' ? 'kg' : 'litro'}` : undefined}
        >
          <Entrada inputMode="decimal" value={coste} onChange={(e) => setCoste(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Proveedor habitual">
        <Selector value={proveedorId} onChange={(e) => setProveedorId(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">— Sin proveedor —</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      {producto && (
        <div className="flex items-center justify-between rounded-xl bg-fondo/50 px-3.5 py-3">
          <span className="text-sm">Activo</span>
          <Interruptor activo={activo} onCambio={setActivo} etiqueta="Producto activo" />
        </div>
      )}
      {!producto && <p className="text-xs text-suave">El producto empieza con stock 0. Después registra una entrada o haz un recuento.</p>}
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro">
        Guardar
      </Boton>
    </form>
  )
}

function OperacionModal({ operacion, onCerrar, onHecho }: { operacion: Operacion | null; onCerrar: () => void; onHecho: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const [coste, setCoste] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setCantidad('')
    setCoste('')
    setNota('')
    setError('')
  }, [operacion])

  if (!operacion) return null
  const { tipo, producto: p } = operacion
  const titulos = { entrada: 'Entrada de mercancía', merma: 'Merma de almacén', recuento: 'Recuento' }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const c = parseCantidad(cantidad)
    if (c === null || (tipo !== 'recuento' && c <= 0)) return setError('Cantidad no válida.')
    let res: { error: string | null }
    if (tipo === 'entrada') {
      const ct = coste.trim() === '' ? null : Number(coste.replace(',', '.'))
      if (ct !== null && (!Number.isFinite(ct) || ct < 0)) return setError('Coste no válido.')
      res = await rpc('entrada_stock', { p_producto: p.id, p_cantidad: c, p_coste_unitario: ct, p_nota: nota || null })
    } else if (tipo === 'merma') {
      if (!nota.trim()) return setError('Indica el motivo.')
      res = await rpc('merma_almacen', { p_producto: p.id, p_cantidad: c, p_nota: nota })
    } else {
      res = await rpc('recuento_stock', { p_producto: p.id, p_real: c, p_nota: nota || null })
    }
    if (res.error) return setError(res.error)
    onHecho()
    onCerrar()
  }

  const c = parseCantidad(cantidad)
  const resultado = c === null ? null : tipo === 'entrada' ? p.stock + c : tipo === 'merma' ? p.stock - c : c

  return (
    <Modal abierto titulo={`${titulos[tipo]} · ${p.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl bg-fondo/60 px-4 py-3 text-sm">
          <span className="text-suave">Stock actual</span>
          <span className="font-display text-lg">{cantidadStock(p.stock, p.unidad)}</span>
        </div>
        <Campo etiqueta={tipo === 'recuento' ? `Cantidad contada (${p.unidad})` : `Cantidad (${p.unidad})`}>
          <Entrada inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" autoFocus />
        </Campo>
        {tipo === 'entrada' && (
          <Campo etiqueta={`Nuevo coste por ${p.unidad} (€, opcional)`} ayuda={`Actual: ${euros(p.coste_unitario)}`}>
            <Entrada inputMode="decimal" value={coste} onChange={(e) => setCoste(e.target.value)} />
          </Campo>
        )}
        <Campo etiqueta={tipo === 'merma' ? 'Motivo' : 'Nota (opcional)'}>
          <Entrada
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={200}
            placeholder={tipo === 'merma' ? 'Caducado, botella rota…' : tipo === 'entrada' ? 'Compra en el cash…' : 'Inventario semanal'}
          />
        </Campo>
        {resultado !== null && (
          <p className="text-sm text-suave">
            Quedará en <strong className="text-texto">{cantidadStock(resultado, p.unidad)}</strong>
            {tipo === 'recuento' && c !== null && c !== p.stock && ` (${c > p.stock ? '+' : ''}${cantidadStock(c - p.stock, p.unidad)})`}
          </p>
        )}
        <Aviso>{error}</Aviso>
        <Boton type="submit" variante="oro">
          {tipo === 'entrada' ? <ArrowDownLeft size={16} /> : tipo === 'merma' ? <Minus size={16} /> : <ClipboardCheck size={16} />}
          Guardar
        </Boton>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------
function Movimientos({ productos }: { productos: ProductoStock[] }) {
  const [productoId, setProductoId] = useState<number | ''>('')
  const [lista, setLista] = useState<MovimientoStock[] | null>(null)

  const cargar = useCallback(async () => {
    let q = getSupabase().from('movimientos_stock').select('*').order('creado_en', { ascending: false }).limit(200)
    if (productoId !== '') q = q.eq('producto_id', productoId)
    const { data } = await q
    setLista(((data as MovimientoStock[]) ?? []).map((m) => ({ ...m, cantidad: Number(m.cantidad), stock_resultante: Number(m.stock_resultante) })))
  }, [productoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const porId = new Map(productos.map((p) => [p.id, p]))

  return (
    <div className="flex flex-col gap-4">
      <Selector value={productoId} onChange={(e) => setProductoId(e.target.value === '' ? '' : Number(e.target.value))} className="max-w-sm">
        <option value="">Todos los productos</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </Selector>
      {lista === null ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio>Sin movimientos todavía.</Vacio>
      ) : (
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y divide-linea">
            {lista.map((m) => {
              const p = porId.get(m.producto_id)
              const u = p?.unidad ?? 'ud'
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <Package size={16} className="text-suave" />
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{p?.nombre ?? 'Producto'}</p>
                    <p className="text-xs text-suave">
                      {NOMBRE_TIPO_MOV[m.tipo]} · {fechaCorta(m.creado_en)}
                      {m.nota && ` · ${m.nota}`}
                    </p>
                  </div>
                  <span className={clsx('font-display', m.cantidad >= 0 ? 'text-ok' : 'text-peligro')}>
                    {m.cantidad >= 0 ? '+' : ''}
                    {cantidadStock(m.cantidad, u)}
                  </span>
                  <span className="w-24 text-right text-xs text-suave">→ {cantidadStock(m.stock_resultante, u)}</span>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </div>
  )
}
