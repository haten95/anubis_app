'use client'

import clsx from 'clsx'
import { Ban, Mail, MessageCircle, PackageCheck, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { rpc } from '@/lib/use-servicio'
import { cantidadStock, cantidadSugerida, euros, fechaCorta, parseCantidad } from '@/lib/format'
import { enlaceEmail, enlaceWhatsapp, telefonoWhatsapp, textoPedido } from '@/lib/contacto'
import {
  NOMBRE_ESTADO_PEDIDO,
  stockBajo,
  type LineaPedido,
  type Pedido,
  type ProductoStock,
  type Proveedor,
  type Usuario,
} from '@/lib/types'
import { Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Panel, Selector, Vacio } from './ui'

export function PedidosView({ productos, proveedores, perfil }: { productos: ProductoStock[]; proveedores: Proveedor[]; perfil: Usuario }) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [lineas, setLineas] = useState<LineaPedido[]>([])
  const [abierto, setAbierto] = useState<number | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    const supabase = getSupabase()
    const p = await supabase.from('pedidos_proveedor').select('*').order('creado_en', { ascending: false }).limit(60)
    const lista = (p.data as Pedido[]) ?? []
    const l = lista.length
      ? await supabase.from('lineas_pedido').select('*').in('pedido_id', lista.map((x) => x.id)).order('id')
      : { data: [], error: null }
    const err = p.error ?? l.error
    setError(err ? mensajeError(err) : '')
    setPedidos(lista)
    setLineas(((l.data as LineaPedido[]) ?? []).map((x) => ({ ...x, cantidad: Number(x.cantidad), coste_unitario: x.coste_unitario === null ? null : Number(x.coste_unitario) })))
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  if (pedidos === null) return <Cargando />

  const nombreProv = new Map(proveedores.map((p) => [p.id, p]))
  const bajos = productos.filter(stockBajo)
  const pedidoAbierto = pedidos.find((p) => p.id === abierto) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-suave">
          {bajos.length > 0 ? `${bajos.length} productos bajo mínimo.` : 'Todo el stock está por encima del mínimo.'}
        </p>
        <Boton variante="oro" onClick={() => setNuevo(true)} disabled={proveedores.length === 0}>
          <Plus size={16} /> Nuevo pedido
        </Boton>
      </div>
      {proveedores.length === 0 && <Aviso tono="info">Primero añade un proveedor en la pestaña «Proveedores».</Aviso>}
      <Aviso>{error}</Aviso>

      {pedidos.length === 0 ? (
        <Vacio>Todavía no hay pedidos.</Vacio>
      ) : (
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y divide-linea">
            {pedidos.map((p) => {
              const suyas = lineas.filter((l) => l.pedido_id === p.id)
              return (
                <li key={p.id}>
                  <button onClick={() => setAbierto(p.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-panel-2/60 sm:px-5">
                    <div className="min-w-40 flex-1">
                      <p className="font-semibold">
                        Pedido #{p.id} · {nombreProv.get(p.proveedor_id)?.nombre ?? 'Proveedor'}
                      </p>
                      <p className="text-xs text-suave">
                        {fechaCorta(p.creado_en)} · {suyas.length} {suyas.length === 1 ? 'producto' : 'productos'}
                      </p>
                    </div>
                    <EstadoPedido estado={p.estado} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <NuevoPedidoModal
        abierto={nuevo}
        proveedores={proveedores.filter((p) => p.activo)}
        productos={productos}
        onCerrar={() => setNuevo(false)}
        onCreado={async (id) => {
          setNuevo(false)
          await recargar()
          setAbierto(id)
        }}
      />

      {pedidoAbierto && (
        <DetallePedido
          pedido={pedidoAbierto}
          proveedor={nombreProv.get(pedidoAbierto.proveedor_id) ?? null}
          lineas={lineas.filter((l) => l.pedido_id === pedidoAbierto.id)}
          productos={productos}
          perfil={perfil}
          recargar={recargar}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  )
}

function EstadoPedido({ estado }: { estado: Pedido['estado'] }) {
  const tono = estado === 'recibido' ? 'ok' : estado === 'enviado' ? 'oro' : estado === 'cancelado' ? 'peligro' : 'neutro'
  return <Etiqueta tono={tono}>{NOMBRE_ESTADO_PEDIDO[estado]}</Etiqueta>
}

function NuevoPedidoModal({
  abierto,
  proveedores,
  productos,
  onCerrar,
  onCreado,
}: {
  abierto: boolean
  proveedores: Proveedor[]
  productos: ProductoStock[]
  onCerrar: () => void
  onCreado: (id: number) => void
}) {
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [conBajos, setConBajos] = useState(true)
  const [error, setError] = useState('')

  const sugeridos = productos.filter((p) => p.proveedor_id === proveedorId && stockBajo(p))

  async function crear() {
    if (proveedorId === '') return setError('Elige un proveedor.')
    const supabase = getSupabase()
    const { data, error } = await supabase.from('pedidos_proveedor').insert({ proveedor_id: proveedorId }).select('id').single()
    if (error || !data) return setError(mensajeError(error))
    if (conBajos && sugeridos.length) {
      const { error: e2 } = await supabase.from('lineas_pedido').insert(
        sugeridos.map((p) => ({
          pedido_id: data.id,
          producto_id: p.id,
          cantidad: cantidadSugerida(p.stock, p.stock_minimo),
          coste_unitario: p.coste_unitario || null,
        })),
      )
      if (e2) return setError(mensajeError(e2))
    }
    setProveedorId('')
    setError('')
    onCreado(data.id as number)
  }

  return (
    <Modal abierto={abierto} titulo="Nuevo pedido" onCerrar={onCerrar}>
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Proveedor">
          <Selector value={proveedorId} onChange={(e) => setProveedorId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">— Elige —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        {proveedorId !== '' && (
          <label className="flex items-start gap-3 rounded-xl bg-fondo/50 px-3.5 py-3 text-sm">
            <input type="checkbox" checked={conBajos} onChange={(e) => setConBajos(e.target.checked)} className="mt-1 h-4 w-4 accent-[#d9ad50]" />
            <span>
              Añadir los productos de este proveedor que están bajo mínimo
              <span className="block text-xs text-suave">
                {sugeridos.length === 0 ? 'Ahora mismo no hay ninguno.' : sugeridos.map((p) => p.nombre).join(', ')}
              </span>
            </span>
          </label>
        )}
        <Aviso>{error}</Aviso>
        <Boton variante="oro" onClick={crear}>
          <Sparkles size={16} /> Crear pedido
        </Boton>
      </div>
    </Modal>
  )
}

function DetallePedido({
  pedido,
  proveedor,
  lineas,
  productos,
  perfil,
  recargar,
  onCerrar,
}: {
  pedido: Pedido
  proveedor: Proveedor | null
  lineas: LineaPedido[]
  productos: ProductoStock[]
  perfil: Usuario
  recargar: () => Promise<void>
  onCerrar: () => void
}) {
  const [error, setError] = useState('')
  const [nuevoProducto, setNuevoProducto] = useState<number | ''>('')
  const [recibiendo, setRecibiendo] = useState(false)
  const [recibido, setRecibido] = useState<Record<number, { cantidad: string; coste: string }>>({})
  const [notas, setNotas] = useState(pedido.notas ?? '')
  const [local, setLocal] = useState('Anubis')

  useEffect(() => {
    getSupabase()
      .from('ajustes_local')
      .select('nombre_comercial')
      .maybeSingle()
      .then(({ data }) => data?.nombre_comercial && setLocal(data.nombre_comercial as string))
  }, [])

  const porId = new Map(productos.map((p) => [p.id, p]))
  const borrador = pedido.estado === 'borrador'
  const pendiente = pedido.estado === 'borrador' || pedido.estado === 'enviado'
  const total = lineas.reduce((t, l) => t + l.cantidad * (l.coste_unitario ?? 0), 0)

  async function ejecutar(fn: () => PromiseLike<{ error: { message?: string; code?: string } | string | null }>) {
    setError('')
    const { error } = await fn()
    if (error) setError(typeof error === 'string' ? error : mensajeError(error))
    await recargar()
    return !error
  }

  const texto = textoPedido({
    local,
    contacto: proveedor?.contacto ?? null,
    lineas: lineas.map((l) => ({ nombre: porId.get(l.producto_id)?.nombre ?? 'Producto', cantidad: l.cantidad, unidad: porId.get(l.producto_id)?.unidad ?? 'ud' })),
    notas: notas.trim() || null,
    firma: `${perfil.nombre} · ${local}`,
  })
  const wa = telefonoWhatsapp(proveedor?.telefono ?? null)

  async function enviadoPor(enlace: string, nuevaVentana: boolean) {
    if (borrador && notas !== (pedido.notas ?? '')) await getSupabase().from('pedidos_proveedor').update({ notas: notas.trim() || null }).eq('id', pedido.id)
    if (nuevaVentana) window.open(enlace, '_blank', 'noopener,noreferrer')
    else window.location.href = enlace
    if (borrador) await ejecutar(() => rpc('marcar_pedido_enviado', { p_pedido: pedido.id }))
  }

  function empezarRecepcion() {
    setRecibido(
      Object.fromEntries(
        lineas.map((l) => [l.producto_id, { cantidad: String(l.cantidad).replace('.', ','), coste: l.coste_unitario !== null ? String(l.coste_unitario).replace('.', ',') : '' }]),
      ),
    )
    setRecibiendo(true)
  }

  async function confirmarRecepcion() {
    const datos: { producto_id: number; cantidad: number; coste_unitario: number | null }[] = []
    for (const l of lineas) {
      const r = recibido[l.producto_id]
      const c = parseCantidad(r?.cantidad ?? '')
      if (c === null) return setError(`Cantidad no válida en ${porId.get(l.producto_id)?.nombre}.`)
      const coste = r?.coste.trim() ? Number(r.coste.replace(',', '.')) : null
      if (coste !== null && (!Number.isFinite(coste) || coste < 0)) return setError(`Coste no válido en ${porId.get(l.producto_id)?.nombre}.`)
      datos.push({ producto_id: l.producto_id, cantidad: c, coste_unitario: coste })
    }
    if (await ejecutar(() => rpc('recibir_pedido', { p_pedido: pedido.id, p_lineas: datos }))) {
      setRecibiendo(false)
      onCerrar()
    }
  }

  return (
    <Modal abierto titulo={`Pedido #${pedido.id} · ${proveedor?.nombre ?? ''}`} onCerrar={onCerrar} ancho="grande">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-suave">
          <EstadoPedido estado={pedido.estado} />
          <span>Creado {fechaCorta(pedido.creado_en)}</span>
          {pedido.enviado_en && <span>· Enviado {fechaCorta(pedido.enviado_en)}</span>}
          {pedido.recibido_en && <span>· Recibido {fechaCorta(pedido.recibido_en)}</span>}
        </div>

        {lineas.length === 0 ? (
          <Vacio>Añade los productos que quieres pedir.</Vacio>
        ) : (
          <ul className="divide-y divide-linea rounded-2xl border border-linea">
            {lineas.map((l) => {
              const p = porId.get(l.producto_id)
              const u = p?.unidad ?? 'ud'
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-36 flex-1">
                    <p className="font-semibold">{p?.nombre ?? 'Producto'}</p>
                    {p && <p className="text-xs text-suave">En stock: {cantidadStock(p.stock, u)}</p>}
                  </div>
                  {recibiendo ? (
                    <>
                      <Campo etiqueta={`Recibido (${u})`}>
                        <Entrada
                          inputMode="decimal"
                          className="w-28"
                          value={recibido[l.producto_id]?.cantidad ?? ''}
                          onChange={(e) => setRecibido({ ...recibido, [l.producto_id]: { ...recibido[l.producto_id], cantidad: e.target.value } })}
                        />
                      </Campo>
                      <Campo etiqueta={`€ por ${u}`}>
                        <Entrada
                          inputMode="decimal"
                          className="w-28"
                          value={recibido[l.producto_id]?.coste ?? ''}
                          onChange={(e) => setRecibido({ ...recibido, [l.producto_id]: { ...recibido[l.producto_id], coste: e.target.value } })}
                        />
                      </Campo>
                    </>
                  ) : borrador ? (
                    <>
                      <Entrada
                        inputMode="decimal"
                        className="w-24"
                        defaultValue={String(l.cantidad).replace('.', ',')}
                        aria-label="Cantidad"
                        onBlur={async (e) => {
                          const c = parseCantidad(e.target.value)
                          if (c === null || c <= 0 || c === l.cantidad) return
                          await ejecutar(() => getSupabase().from('lineas_pedido').update({ cantidad: c }).eq('id', l.id))
                        }}
                      />
                      <span className="w-6 text-sm text-suave">{u}</span>
                      <button
                        onClick={() => ejecutar(() => getSupabase().from('lineas_pedido').delete().eq('id', l.id))}
                        className="rounded-lg p-2 text-suave hover:bg-peligro/10 hover:text-peligro"
                        aria-label="Quitar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <span className="font-display">{cantidadStock(l.cantidad, u)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {borrador && (
          <div className="flex flex-wrap items-end gap-2">
            <Selector value={nuevoProducto} onChange={(e) => setNuevoProducto(e.target.value === '' ? '' : Number(e.target.value))} className="min-w-48 flex-1">
              <option value="">Añadir producto…</option>
              {productos
                .filter((p) => p.activo && !lineas.some((l) => l.producto_id === p.id))
                .sort((a, b) => Number(b.proveedor_id === pedido.proveedor_id) - Number(a.proveedor_id === pedido.proveedor_id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {stockBajo(p) ? ' (bajo mínimo)' : ''}
                  </option>
                ))}
            </Selector>
            <Boton
              disabled={nuevoProducto === ''}
              onClick={async () => {
                const p = porId.get(nuevoProducto as number)!
                const ok = await ejecutar(() =>
                  getSupabase()
                    .from('lineas_pedido')
                    .insert({ pedido_id: pedido.id, producto_id: p.id, cantidad: cantidadSugerida(p.stock, p.stock_minimo), coste_unitario: p.coste_unitario || null }),
                )
                if (ok) setNuevoProducto('')
              }}
            >
              <Plus size={16} /> Añadir
            </Boton>
          </div>
        )}

        {total > 0 && <p className="text-right text-sm text-suave">Importe estimado: <strong className="text-texto">{euros(total)}</strong></p>}

        {borrador && (
          <Campo etiqueta="Notas para el proveedor (opcional)">
            <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Entregar antes del viernes…" />
          </Campo>
        )}

        <Aviso>{error}</Aviso>

        {pendiente && !recibiendo && lineas.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl bg-fondo/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-suave">Enviar al proveedor</p>
            <div className="flex flex-wrap gap-2">
              <Boton
                disabled={!proveedor?.email}
                onClick={() => enviadoPor(enlaceEmail(proveedor!.email!, `Pedido ${local} #${pedido.id}`, texto), false)}
                title={proveedor?.email ? undefined : 'El proveedor no tiene email'}
              >
                <Mail size={16} /> Por email
              </Boton>
              <Boton disabled={!wa} onClick={() => enviadoPor(enlaceWhatsapp(wa!, texto), true)} title={wa ? undefined : 'El proveedor no tiene teléfono válido'}>
                <MessageCircle size={16} /> Por WhatsApp
              </Boton>
              {borrador && (
                <Boton variante="fantasma" onClick={() => ejecutar(() => rpc('marcar_pedido_enviado', { p_pedido: pedido.id }))}>
                  <Send size={16} /> Marcar como enviado
                </Boton>
              )}
            </div>
            <p className="text-xs text-suave">Se abre tu correo o WhatsApp con el pedido ya escrito; solo tienes que darle a enviar.</p>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {pendiente && !recibiendo && (
              <Boton
                variante="peligro"
                onClick={async () => {
                  if (!confirm('¿Cancelar este pedido?')) return
                  if (await ejecutar(() => rpc('cancelar_pedido', { p_pedido: pedido.id }))) onCerrar()
                }}
              >
                <Ban size={16} /> Cancelar
              </Boton>
            )}
            {borrador && (
              <Boton
                variante="fantasma"
                onClick={async () => {
                  if (!confirm('¿Borrar este borrador?')) return
                  if (await ejecutar(() => getSupabase().from('pedidos_proveedor').delete().eq('id', pedido.id))) onCerrar()
                }}
              >
                <Trash2 size={16} /> Borrar
              </Boton>
            )}
          </div>
          {pendiente && lineas.length > 0 && (
            recibiendo ? (
              <div className="flex gap-2">
                <Boton variante="fantasma" onClick={() => setRecibiendo(false)}>
                  Volver
                </Boton>
                <Boton variante="oro" onClick={confirmarRecepcion}>
                  <PackageCheck size={16} /> Confirmar recepción
                </Boton>
              </div>
            ) : (
              <Boton variante="oro" onClick={empezarRecepcion}>
                <PackageCheck size={16} /> Recibir mercancía
              </Boton>
            )
          )}
        </div>
        {recibiendo && (
          <p className={clsx('text-xs text-suave')}>
            Ajusta lo que ha llegado de verdad (0 si no ha venido). Se suma al stock y se actualiza el coste de cada producto.
          </p>
        )}
      </div>
    </Modal>
  )
}
