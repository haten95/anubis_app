'use client'

import clsx from 'clsx'
import { ArrowDown, ArrowUp, Flame, Pencil, Plus, Scale } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { euros, parseImporte } from '@/lib/format'
import { TIPOS_IVA, type Articulo, type Categoria, type ProductoStock, type Sabor, type Usuario } from '@/lib/types'
import { EscandalloModal } from './escandallo-modal'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Interruptor, Modal, Panel, Selector, Titulo, Vacio } from './ui'

type ErrorSupabase = { message?: string; code?: string } | null

export function CartaView({ perfil }: { perfil: Usuario }) {
  const gestor = perfil.rol === 'dueno' || perfil.rol === 'encargado'
  const esDueno = perfil.rol === 'dueno'

  const [categorias, setCategorias] = useState<Categoria[] | null>(null)
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [sabores, setSabores] = useState<Sabor[]>([])
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [escandallo, setEscandallo] = useState<Articulo | null>(null)
  const [catSel, setCatSel] = useState<number | null>(null)
  const [error, setError] = useState('')

  const [editArticulo, setEditArticulo] = useState<Articulo | 'nuevo' | null>(null)
  const [editCategoria, setEditCategoria] = useState<Categoria | 'nueva' | null>(null)
  const [editSabor, setEditSabor] = useState<Sabor | 'nuevo' | null>(null)

  const recargar = useCallback(async () => {
    const supabase = getSupabase()
    const [c, a, s, ps] = await Promise.all([
      supabase.from('categorias').select('*').order('orden').order('id'),
      supabase.from('articulos').select('*').order('orden').order('nombre'),
      supabase.from('sabores').select('*').order('nombre'),
      supabase.from('productos_stock').select('*').order('nombre'),
    ])
    const err = c.error ?? a.error ?? s.error
    if (err) setError(mensajeError(err))
    setCategorias((c.data as Categoria[]) ?? [])
    setArticulos(((a.data as Articulo[]) ?? []).map((x) => ({ ...x, precio: Number(x.precio), iva: Number(x.iva) })))
    setSabores((s.data as Sabor[]) ?? [])
    setProductos(((ps.data as ProductoStock[]) ?? []).map((x) => ({ ...x, stock: Number(x.stock), stock_minimo: Number(x.stock_minimo), coste_unitario: Number(x.coste_unitario) })))
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  /** Ejecuta una escritura, recarga y devuelve el mensaje de error o null */
  const ejecutar = useCallback(
    async (accion: () => PromiseLike<{ error: ErrorSupabase }>) => {
      const { error } = await accion()
      await recargar()
      return error ? mensajeError(error) : null
    },
    [recargar],
  )

  if (categorias === null) return <Cargando />

  const visibles = gestor ? categorias : categorias.filter((c) => c.activa)
  const actual = visibles.find((c) => c.id === catSel) ?? visibles[0]
  const deCategoria = articulos.filter((a) => a.categoria_id === actual?.id && (gestor || a.activo))

  async function moverCategoria(cat: Categoria, dir: -1 | 1) {
    const orden = categorias!.map((c) => c.id)
    const i = orden.indexOf(cat.id)
    if (!orden[i + dir]) return
    ;[orden[i], orden[i + dir]] = [orden[i + dir], orden[i]]
    const err = await ejecutar(async () => {
      for (let k = 0; k < orden.length; k++) {
        const { error } = await getSupabase().from('categorias').update({ orden: k }).eq('id', orden[k])
        if (error) return { error }
      }
      return { error: null }
    })
    setError(err ?? '')
  }

  return (
    <div className="aparecer">
      <Titulo
        accion={
          gestor && (
            <div className="flex gap-2">
              <Boton onClick={() => setEditCategoria('nueva')}>
                <Plus size={16} /> Categoría
              </Boton>
              <Boton variante="oro" onClick={() => setEditArticulo('nuevo')} disabled={!actual}>
                <Plus size={16} /> Artículo
              </Boton>
            </div>
          )
        }
      >
        Carta
      </Titulo>
      <div className="mb-4">
        <Aviso>{error}</Aviso>
      </div>

      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        {/* Categorías */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
          {visibles.map((c, i) => (
            <div key={c.id} className="group flex shrink-0 items-center md:shrink">
              <button
                onClick={() => setCatSel(c.id)}
                className={clsx(
                  'tactil flex flex-1 items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition',
                  actual?.id === c.id ? 'bg-oro/15 text-oro-claro' : 'text-suave hover:bg-panel-2 hover:text-texto',
                  !c.activa && 'line-through opacity-60',
                )}
              >
                {c.es_shisha && <Flame size={15} className="text-oro" />}
                {c.nombre}
                <span className="ml-auto pl-2 text-xs font-normal text-suave">
                  {articulos.filter((a) => a.categoria_id === c.id).length}
                </span>
              </button>
              {gestor && (
                <div className="hidden items-center md:flex md:opacity-0 md:group-hover:opacity-100">
                  <button className="p-1 text-suave hover:text-texto disabled:opacity-30" disabled={i === 0} onClick={() => moverCategoria(c, -1)} aria-label="Subir categoría">
                    <ArrowUp size={14} />
                  </button>
                  <button className="p-1 text-suave hover:text-texto disabled:opacity-30" disabled={i === visibles.length - 1} onClick={() => moverCategoria(c, 1)} aria-label="Bajar categoría">
                    <ArrowDown size={14} />
                  </button>
                  <button className="p-1 text-suave hover:text-texto" onClick={() => setEditCategoria(c)} aria-label="Editar categoría">
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          {/* Artículos */}
          <Panel>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-lg">{actual?.nombre ?? 'Sin categorías'}</h3>
              {gestor && actual && (
                <Boton variante="fantasma" className="md:hidden" onClick={() => setEditCategoria(actual)}>
                  <Pencil size={15} /> Categoría
                </Boton>
              )}
            </div>
            {deCategoria.length === 0 ? (
              <Vacio>{gestor ? 'No hay artículos. Añade el primero con «Artículo».' : 'No hay artículos en esta categoría.'}</Vacio>
            ) : (
              <ul className="divide-y divide-linea">
                {deCategoria.map((a) => (
                  <li key={a.id} className={clsx('flex items-center gap-3 py-3', !a.activo && 'opacity-55')}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {a.nombre} {!a.activo && <Etiqueta tono="peligro">Oculto</Etiqueta>}
                      </p>
                      {a.descripcion && <p className="truncate text-sm text-suave">{a.descripcion}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg text-oro-claro">{euros(a.precio)}</p>
                      <p className="text-[11px] text-suave">IVA {a.iva}%</p>
                    </div>
                    {gestor && (
                      <div className="flex">
                        <Boton variante="fantasma" className="px-2.5" onClick={() => setEscandallo(a)} title="Escandallo (lo que gasta del stock)" aria-label={`Escandallo de ${a.nombre}`}>
                          <Scale size={16} />
                        </Boton>
                        <Boton variante="fantasma" className="px-2.5" onClick={() => setEditArticulo(a)} aria-label={`Editar ${a.nombre}`}>
                          <Pencil size={16} />
                        </Boton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Sabores de shisha */}
          {actual?.es_shisha && (
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg">Sabores</h3>
                  <p className="text-xs text-suave">El color es el que se verá en el dibujo de la cazoleta.</p>
                </div>
                {gestor && (
                  <Boton onClick={() => setEditSabor('nuevo')}>
                    <Plus size={16} /> Sabor
                  </Boton>
                )}
              </div>
              {sabores.length === 0 ? (
                <Vacio>No hay sabores.</Vacio>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sabores
                    .filter((s) => gestor || s.activo)
                    .map((s) => (
                      <button
                        key={s.id}
                        disabled={!gestor}
                        onClick={() => setEditSabor(s)}
                        className={clsx(
                          'tactil flex items-center gap-2 rounded-full border border-linea bg-fondo/50 py-1.5 pl-1.5 pr-3.5 text-sm transition enabled:hover:border-oro-oscuro',
                          !s.activo && 'opacity-50 line-through',
                        )}
                      >
                        <span className="h-6 w-6 rounded-full ring-2 ring-black/30" style={{ background: s.color }} />
                        {s.nombre}
                        {s.marca && <span className="text-xs text-suave">· {s.marca}</span>}
                      </button>
                    ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>

      <Modal abierto={editArticulo !== null} titulo={editArticulo === 'nuevo' ? 'Nuevo artículo' : 'Editar artículo'} onCerrar={() => setEditArticulo(null)}>
        {editArticulo !== null && actual && (
          <FormArticulo
            key={editArticulo === 'nuevo' ? 'nuevo' : editArticulo.id}
            articulo={editArticulo === 'nuevo' ? null : editArticulo}
            categorias={categorias}
            categoriaInicial={actual.id}
            puedeCambiarPrecio={esDueno || editArticulo === 'nuevo'}
            onGuardar={async (datos) => {
              const supabase = getSupabase()
              const err = await ejecutar(() =>
                editArticulo === 'nuevo'
                  ? supabase.from('articulos').insert({ ...datos, orden: deCategoria.length })
                  : supabase.from('articulos').update(datos).eq('id', editArticulo.id),
              )
              if (!err) setEditArticulo(null)
              return err
            }}
          />
        )}
      </Modal>

      <Modal abierto={editCategoria !== null} titulo={editCategoria === 'nueva' ? 'Nueva categoría' : 'Editar categoría'} onCerrar={() => setEditCategoria(null)}>
        {editCategoria !== null && (
          <FormCategoria
            key={editCategoria === 'nueva' ? 'nueva' : editCategoria.id}
            categoria={editCategoria === 'nueva' ? null : editCategoria}
            onGuardar={async (datos) => {
              const supabase = getSupabase()
              const err = await ejecutar(() =>
                editCategoria === 'nueva'
                  ? supabase.from('categorias').insert({ ...datos, orden: categorias.length })
                  : supabase.from('categorias').update(datos).eq('id', editCategoria.id),
              )
              if (!err) setEditCategoria(null)
              return err
            }}
          />
        )}
      </Modal>

      <EscandalloModal
        articulo={escandallo}
        esShisha={!!escandallo && !escandallo.es_cambio_carbon && !!categorias.find((c) => c.id === escandallo.categoria_id)?.es_shisha}
        productos={productos}
        sabores={sabores}
        onCerrar={() => setEscandallo(null)}
        onCambio={recargar}
      />

      <Modal abierto={editSabor !== null} titulo={editSabor === 'nuevo' ? 'Nuevo sabor' : 'Editar sabor'} onCerrar={() => setEditSabor(null)}>
        {editSabor !== null && (
          <FormSabor
            key={editSabor === 'nuevo' ? 'nuevo' : editSabor.id}
            sabor={editSabor === 'nuevo' ? null : editSabor}
            productos={productos}
            onGuardar={async (datos) => {
              const supabase = getSupabase()
              const err = await ejecutar(() =>
                editSabor === 'nuevo'
                  ? supabase.from('sabores').insert(datos)
                  : supabase.from('sabores').update(datos).eq('id', editSabor.id),
              )
              if (!err) setEditSabor(null)
              return err
            }}
          />
        )}
      </Modal>
    </div>
  )
}

type Guardar<T> = (datos: T) => Promise<string | null>

function FilaInterruptor({ texto, ayuda, activo, onCambio }: { texto: string; ayuda?: string; activo: boolean; onCambio: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-fondo/50 px-3.5 py-3">
      <span className="text-sm">
        {texto}
        {ayuda && <span className="block text-xs text-suave">{ayuda}</span>}
      </span>
      <Interruptor activo={activo} onCambio={onCambio} etiqueta={texto} />
    </div>
  )
}

function FormArticulo({
  articulo,
  categorias,
  categoriaInicial,
  puedeCambiarPrecio,
  onGuardar,
}: {
  articulo: Articulo | null
  categorias: Categoria[]
  categoriaInicial: number
  puedeCambiarPrecio: boolean
  onGuardar: Guardar<Omit<Articulo, 'id' | 'orden' | 'es_cambio_carbon' | 'gramos_tabaco'>>
}) {
  const [nombre, setNombre] = useState(articulo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(articulo?.descripcion ?? '')
  const [precio, setPrecio] = useState(articulo ? String(articulo.precio).replace('.', ',') : '')
  const [iva, setIva] = useState(articulo?.iva ?? 10)
  const [categoriaId, setCategoriaId] = useState(articulo?.categoria_id ?? categoriaInicial)
  const [activo, setActivo] = useState(articulo?.activo ?? true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const p = parseImporte(precio)
    if (!nombre.trim()) return setError('Escribe el nombre.')
    if (p === null) return setError('Precio no válido. Usa por ejemplo 12,50.')
    setGuardando(true)
    const err = await onGuardar({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio: p,
      iva,
      categoria_id: categoriaId,
      activo,
    })
    setGuardando(false)
    setError(err ?? '')
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required autoFocus />
      </Campo>
      <Campo etiqueta="Descripción (opcional)">
        <Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Precio (€)" ayuda={puedeCambiarPrecio ? undefined : 'Solo el dueño cambia precios'}>
          <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0,00" disabled={!puedeCambiarPrecio} required />
        </Campo>
        <Campo etiqueta="IVA">
          <Selector value={iva} onChange={(e) => setIva(Number(e.target.value))} disabled={!puedeCambiarPrecio}>
            {TIPOS_IVA.map((t) => (
              <option key={t} value={t}>
                {t}%
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <Campo etiqueta="Categoría">
        <Selector value={categoriaId} onChange={(e) => setCategoriaId(Number(e.target.value))}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <FilaInterruptor texto="Visible en la carta" activo={activo} onCambio={setActivo} />
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </Boton>
    </form>
  )
}

function FormCategoria({ categoria, onGuardar }: { categoria: Categoria | null; onGuardar: Guardar<Pick<Categoria, 'nombre' | 'es_shisha' | 'activa'>> }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [esShisha, setEsShisha] = useState(categoria?.es_shisha ?? false)
  const [activa, setActiva] = useState(categoria?.activa ?? true)
  const [error, setError] = useState('')

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!nombre.trim()) return
        setError((await onGuardar({ nombre: nombre.trim(), es_shisha: esShisha, activa })) ?? '')
      }}
    >
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} required autoFocus />
      </Campo>
      <FilaInterruptor texto="Es de shishas" ayuda="Sus artículos permiten elegir sabores, porcentajes y cambio de carbón." activo={esShisha} onCambio={setEsShisha} />
      <FilaInterruptor texto="Activa" ayuda="Las inactivas no se ven al tomar comandas." activo={activa} onCambio={setActiva} />
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro">
        Guardar
      </Boton>
    </form>
  )
}

const PALETA = ['#22c55e', '#7c3aed', '#facc15', '#ef4444', '#a3e635', '#3b82f6', '#fb923c', '#f43f5e', '#f59e0b', '#06b6d4', '#ec4899', '#a16207']

function FormSabor({ sabor, productos, onGuardar }: { sabor: Sabor | null; productos: ProductoStock[]; onGuardar: Guardar<Omit<Sabor, 'id'>> }) {
  const [nombre, setNombre] = useState(sabor?.nombre ?? '')
  const [marca, setMarca] = useState(sabor?.marca ?? '')
  const [color, setColor] = useState(sabor?.color ?? PALETA[0])
  const [activo, setActivo] = useState(sabor?.activo ?? true)
  const [productoId, setProductoId] = useState<number | '' | 'crear'>(sabor?.producto_id ?? (sabor ? '' : 'crear'))
  const [error, setError] = useState('')

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!nombre.trim()) return
        let producto: number | null = productoId === '' || productoId === 'crear' ? null : productoId
        if (productoId === 'crear') {
          // Crea el producto de stock del tabaco de este sabor (en gramos)
          const { data, error } = await getSupabase()
            .from('productos_stock')
            .insert({ nombre: `Tabaco ${nombre.trim()}${marca.trim() ? ` (${marca.trim()})` : ''}`, unidad: 'g', stock_minimo: 250 })
            .select('id')
            .single()
          if (error) return setError(mensajeError(error))
          producto = data.id as number
        }
        setError((await onGuardar({ nombre: nombre.trim(), marca: marca.trim() || null, color, activo, producto_id: producto })) ?? '')
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} required autoFocus />
        </Campo>
        <Campo etiqueta="Marca (opcional)">
          <Entrada value={marca} onChange={(e) => setMarca(e.target.value)} maxLength={60} />
        </Campo>
      </div>
      <Campo etiqueta="Color en la cazoleta">
        <div className="flex flex-wrap items-center gap-2">
          {PALETA.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={clsx('h-9 w-9 rounded-full ring-offset-2 ring-offset-panel transition', color === c && 'ring-2 ring-oro-claro')}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-linea bg-transparent" aria-label="Otro color" />
        </div>
      </Campo>
      <Campo etiqueta="Tabaco en el stock" ayuda="Para descontar los gramos de este sabor cada vez que se vende una shisha.">
        <Selector value={productoId} onChange={(e) => setProductoId(e.target.value === '' ? '' : e.target.value === 'crear' ? 'crear' : Number(e.target.value))}>
          <option value="">— Sin control de stock —</option>
          <option value="crear">+ Crear producto «Tabaco {nombre.trim() || '…'}» (en gramos)</option>
          {productos
            .filter((p) => p.unidad === 'g')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
        </Selector>
      </Campo>
      <FilaInterruptor texto="Disponible" activo={activo} onCambio={setActivo} />
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro">
        Guardar
      </Boton>
    </form>
  )
}
