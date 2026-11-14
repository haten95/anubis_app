'use client'

import { Mail, MessageCircle, Pencil, Phone, Plus, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getSupabase, mensajeError } from '@/lib/supabase/client'
import { telefonoWhatsapp } from '@/lib/contacto'
import type { ProductoStock, Proveedor } from '@/lib/types'
import { Aviso, Boton, Campo, Entrada, Etiqueta, Interruptor, Modal, Panel, Vacio } from './ui'

export function ProveedoresView({
  proveedores,
  productos,
  recargar,
}: {
  proveedores: Proveedor[]
  productos: ProductoStock[]
  recargar: () => Promise<void>
}) {
  const [editando, setEditando] = useState<Proveedor | 'nuevo' | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Boton variante="oro" onClick={() => setEditando('nuevo')}>
          <Plus size={16} /> Proveedor
        </Boton>
      </div>

      {proveedores.length === 0 ? (
        <Vacio>Añade tus proveedores (bebidas, tabaco, carbón…) para poder hacerles pedidos desde la app.</Vacio>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {proveedores.map((p) => {
            const suyos = productos.filter((x) => x.proveedor_id === p.id)
            const wa = telefonoWhatsapp(p.telefono)
            return (
              <Panel key={p.id} className={p.activo ? '' : 'opacity-60'}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-verde/15 text-verde">
                    <Truck size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg">{p.nombre}</h3>
                    <p className="truncate text-sm text-suave">{[p.contacto, p.email, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Etiqueta>{suyos.length} productos</Etiqueta>
                      {!p.activo && <Etiqueta tono="peligro">Inactivo</Etiqueta>}
                    </div>
                  </div>
                  <button onClick={() => setEditando(p)} className="rounded-lg p-2 text-suave hover:bg-panel-2 hover:text-texto" aria-label="Editar proveedor">
                    <Pencil size={16} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-linea px-3 py-2 text-xs font-semibold text-suave hover:text-texto">
                      <Mail size={14} /> Email
                    </a>
                  )}
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-linea px-3 py-2 text-xs font-semibold text-suave hover:text-texto"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                  {p.telefono && (
                    <a href={`tel:${p.telefono.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg border border-linea px-3 py-2 text-xs font-semibold text-suave hover:text-texto">
                      <Phone size={14} /> Llamar
                    </a>
                  )}
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      <Modal abierto={editando !== null} titulo={editando === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'} onCerrar={() => setEditando(null)}>
        {editando !== null && (
          <FormProveedor
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            proveedor={editando === 'nuevo' ? null : editando}
            onHecho={async () => {
              setEditando(null)
              await recargar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function FormProveedor({ proveedor, onHecho }: { proveedor: Proveedor | null; onHecho: () => void }) {
  const [d, setD] = useState({
    nombre: proveedor?.nombre ?? '',
    contacto: proveedor?.contacto ?? '',
    email: proveedor?.email ?? '',
    telefono: proveedor?.telefono ?? '',
    notas: proveedor?.notas ?? '',
  })
  const [activo, setActivo] = useState(proveedor?.activo ?? true)
  const [error, setError] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!d.nombre.trim()) return setError('Escribe el nombre.')
    const datos = {
      nombre: d.nombre.trim(),
      contacto: d.contacto.trim() || null,
      email: d.email.trim() || null,
      telefono: d.telefono.trim() || null,
      notas: d.notas.trim() || null,
      activo,
    }
    const supabase = getSupabase()
    const { error } = proveedor
      ? await supabase.from('proveedores').update(datos).eq('id', proveedor.id)
      : await supabase.from('proveedores').insert(datos)
    if (error) return setError(error.code === '23514' ? 'Revisa el email: no parece válido.' : mensajeError(error))
    onHecho()
  }

  const campo = (k: keyof typeof d, etiqueta: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <Campo etiqueta={etiqueta}>
      <Entrada value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} {...extra} />
    </Campo>
  )

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      {campo('nombre', 'Nombre', { maxLength: 80, required: true, autoFocus: true, placeholder: 'Distribuciones Nilo' })}
      {campo('contacto', 'Persona de contacto', { maxLength: 80 })}
      <div className="grid gap-3 sm:grid-cols-2">
        {campo('email', 'Email', { type: 'email', maxLength: 120 })}
        {campo('telefono', 'Teléfono / WhatsApp', { type: 'tel', maxLength: 30, placeholder: '612 345 678' })}
      </div>
      {campo('notas', 'Notas', { maxLength: 500, placeholder: 'Reparte martes y viernes, pedido mínimo 100 €…' })}
      {proveedor && (
        <div className="flex items-center justify-between rounded-xl bg-fondo/50 px-3.5 py-3">
          <span className="text-sm">Activo</span>
          <Interruptor activo={activo} onCambio={setActivo} etiqueta="Proveedor activo" />
        </div>
      )}
      <Aviso>{error}</Aviso>
      <Boton type="submit" variante="oro">
        Guardar
      </Boton>
    </form>
  )
}
