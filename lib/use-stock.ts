'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabase, mensajeError } from './supabase/client'
import { stockBajo, type ProductoStock, type Proveedor } from './types'

function normalizar(p: ProductoStock): ProductoStock {
  return { ...p, stock: Number(p.stock), stock_minimo: Number(p.stock_minimo), coste_unitario: Number(p.coste_unitario) }
}

/** Productos de stock (y proveedores si el rol puede verlos), al día en tiempo real */
export function useStock(conProveedores: boolean) {
  const [productos, setProductos] = useState<ProductoStock[] | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    const supabase = getSupabase()
    const [p, v] = await Promise.all([
      supabase.from('productos_stock').select('*').order('nombre'),
      conProveedores ? supabase.from('proveedores').select('*').order('nombre') : Promise.resolve({ data: [], error: null }),
    ])
    const err = p.error ?? v.error
    setError(err ? mensajeError(err) : '')
    setProductos(((p.data as ProductoStock[]) ?? []).map(normalizar))
    setProveedores((v.data as Proveedor[]) ?? [])
  }, [conProveedores])

  useEffect(() => {
    recargar()
    const supabase = getSupabase()
    const canal = supabase
      .channel('stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos_stock' }, () => recargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [recargar])

  return { productos, proveedores, error, recargar }
}

/** Número de productos bajo mínimo, para el aviso del menú */
export function useAvisosStock() {
  const [bajos, setBajos] = useState(0)
  useEffect(() => {
    const supabase = getSupabase()
    const contar = async () => {
      const { data } = await supabase.from('productos_stock').select('*')
      setBajos(((data as ProductoStock[]) ?? []).map(normalizar).filter(stockBajo).length)
    }
    contar()
    const canal = supabase
      .channel('avisos-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos_stock' }, contar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [])
  return bajos
}
