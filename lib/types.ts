export type Rol = 'dueno' | 'encargado' | 'empleado'
export type TipoZona = 'interior' | 'terraza'

export interface Usuario {
  id: string
  nombre: string
  email: string | null
  rol: Rol
  activo: boolean
  creado_en: string
}

export interface Zona {
  id: number
  nombre: string
  tipo: TipoZona
  orden: number
  activa: boolean
}

export interface Mesa {
  id: number
  zona_id: number
  numero: number
  tipo: TipoZona
  capacidad: number | null
  activa: boolean
}

export interface Categoria {
  id: number
  nombre: string
  orden: number
  es_shisha: boolean
  activa: boolean
}

export interface Articulo {
  id: number
  categoria_id: number
  nombre: string
  descripcion: string | null
  precio: number
  iva: number
  orden: number
  activo: boolean
  es_cambio_carbon: boolean
  gramos_tabaco: number | null
}

export interface Sabor {
  id: number
  nombre: string
  marca: string | null
  color: string
  activo: boolean
  producto_id: number | null
}

export const NOMBRE_ROL: Record<Rol, string> = {
  dueno: 'Dueño',
  encargado: 'Encargado',
  empleado: 'Empleado',
}

export const NOMBRE_TIPO_ZONA: Record<TipoZona, string> = {
  interior: 'Sala interior',
  terraza: 'Terraza',
}

export const TIPOS_IVA = [0, 4, 10, 21] as const

// ---------------------------------------------------------------------
// Fase 2: servicio
// ---------------------------------------------------------------------
export type EstadoComanda = 'abierta' | 'cuenta' | 'cerrada'
export type CierreComanda = 'pagada' | 'merma' | 'vacia'
export type MetodoPago = 'efectivo' | 'tarjeta'
export type MotivoMerma = 'invitacion' | 'personal' | 'error' | 'mal_estado'

export interface Comanda {
  id: number
  mesa_id: number
  estado: EstadoComanda
  cierre: CierreComanda | null
  abierta_por: string
  abierta_en: string
  cerrada_en: string | null
}

export interface LineaSabor {
  linea_id: number
  sabor_id: number
  nombre: string
  color: string
  porcentaje: number
  orden: number
}

export interface Linea {
  id: number
  comanda_id: number
  articulo_id: number
  nombre: string
  precio: number
  iva: number
  cantidad: number
  notas: string | null
  es_shisha: boolean
  linea_padre_id: number | null
  merma: boolean
  anulada: boolean
  creado_por: string
  creado_en: string
  sabores?: LineaSabor[]
}

export interface Caja {
  id: number
  abierta_por: string
  abierta_en: string
  fondo_inicial: number
  cerrada_por: string | null
  cerrada_en: string | null
  efectivo_esperado: number | null
  efectivo_contado: number | null
  notas: string | null
}

export interface ResumenCaja {
  caja: Caja
  efectivo: number
  tarjeta: number
  devoluciones?: number
  entradas: number
  salidas: number
  efectivo_esperado: number
  tickets: number
  total_ventas: number
  mermas_valor_carta: number
  mermas_lineas: number
  comandas_abiertas: number
}

export interface LineaTicket {
  nombre: string
  cantidad: number
  precio: number
  importe: number
  iva: number
  sabores: { nombre: string; porcentaje: number }[] | null
}

export interface Ticket {
  id: number
  serie: string
  numero: number
  comanda_id: number
  caja_id: number
  emitido_en: string
  mesa_texto: string
  lineas: LineaTicket[]
  desglose_iva: { iva: number; base: number; cuota: number; total: number }[]
  base: number
  cuota_iva: number
  total: number
}

export interface Pago {
  id: number
  ticket_id: number
  metodo: MetodoPago
  importe: number
  entregado: number | null
  cambio: number
}

export interface AjustesLocal {
  nombre_comercial: string
  razon_social: string | null
  nif: string | null
  direccion: string | null
  telefono: string | null
  pie_ticket: string | null
}

export const NOMBRE_MOTIVO_MERMA: Record<MotivoMerma, string> = {
  invitacion: 'Invitación de la casa',
  personal: 'Consumo de personal',
  error: 'Error o rotura',
  mal_estado: 'Producto en mal estado',
}

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
}

export function textoMesa(tipo: TipoZona, numero: number) {
  return `${tipo === 'terraza' ? 'Terraza' : 'Sala'} · Mesa ${numero}`
}

// ---------------------------------------------------------------------
// Fase 3: stock y proveedores
// ---------------------------------------------------------------------
export type Unidad = 'ud' | 'g' | 'ml'
export type TipoMovStock = 'venta' | 'merma' | 'entrada' | 'merma_almacen' | 'ajuste'
export type EstadoPedido = 'borrador' | 'enviado' | 'recibido' | 'cancelado'

export interface Proveedor {
  id: number
  nombre: string
  contacto: string | null
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
}

export interface ProductoStock {
  id: number
  nombre: string
  unidad: Unidad
  stock: number
  stock_minimo: number
  coste_unitario: number
  proveedor_id: number | null
  activo: boolean
}

export interface Receta {
  articulo_id: number
  producto_id: number
  cantidad: number
}

export interface Pedido {
  id: number
  proveedor_id: number
  estado: EstadoPedido
  notas: string | null
  creado_en: string
  enviado_en: string | null
  recibido_en: string | null
}

export interface LineaPedido {
  id: number
  pedido_id: number
  producto_id: number
  cantidad: number
  coste_unitario: number | null
}

export interface MovimientoStock {
  id: number
  producto_id: number
  tipo: TipoMovStock
  cantidad: number
  coste_unitario: number | null
  stock_resultante: number
  nota: string | null
  creado_en: string
}

export const NOMBRE_UNIDAD: Record<Unidad, string> = { ud: 'unidades', g: 'gramos', ml: 'mililitros' }

export const NOMBRE_TIPO_MOV: Record<TipoMovStock, string> = {
  venta: 'Venta',
  merma: 'Merma (comanda)',
  entrada: 'Entrada',
  merma_almacen: 'Merma de almacén',
  ajuste: 'Ajuste por recuento',
}

export const NOMBRE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  recibido: 'Recibido',
  cancelado: 'Cancelado',
}

export function stockBajo(p: ProductoStock) {
  return p.activo && p.stock <= p.stock_minimo
}

// ---------------------------------------------------------------------
// Fase 4: personal
// ---------------------------------------------------------------------
export type FuncionTurno = 'barra' | 'shishas' | 'sala'

export interface Turno {
  id: number
  usuario_id: string
  fecha: string
  inicio: string
  fin: string
  funcion: FuncionTurno | null
  notas: string | null
}

export interface Tarea {
  id: number
  usuario_id: string
  fecha: string
  descripcion: string
  hecha: boolean
  hecha_en: string | null
}

export interface Fichaje {
  id: number
  usuario_id: string
  entrada: string
  salida: string | null
  editado_por: string | null
  editado_en: string | null
  motivo_edicion: string | null
}

export interface DatosLaborales {
  usuario_id: string
  tipo_contrato: string | null
  horas_semanales: number | null
  salario_base_mensual: number | null
  precio_hora: number | null
  irpf_pct: number
  seguridad_social_pct: number
}

export interface Nomina {
  id: number
  usuario_id: string
  mes: string
  horas: number
  bruto: number
  irpf: number
  seguridad_social: number
  otras_deducciones: number
  neto: number
  estado: 'pendiente' | 'pagada'
  pagada_en: string | null
  notas: string | null
}

export const FUNCIONES: Record<FuncionTurno, { nombre: string; color: string; clase: string }> = {
  barra: { nombre: 'Barra', color: '#5cc4b3', clase: 'bg-turquesa/15 text-turquesa border-turquesa/40' },
  shishas: { nombre: 'Shishas', color: '#d9ad50', clase: 'bg-oro/15 text-oro-claro border-oro/40' },
  sala: { nombre: 'Sala', color: '#7cc28f', clase: 'bg-verde/15 text-verde border-verde/40' },
}

// ---------------------------------------------------------------------
// Fase 5: facturación e informes
// ---------------------------------------------------------------------
export interface Factura {
  id: number
  serie: string
  numero: number
  ticket_id: number
  emitida_en: string
  cliente_nombre: string
  cliente_nif: string
  cliente_direccion: string
  base: number
  cuota_iva: number
  total: number
}

export interface Rectificativa {
  id: number
  serie: string
  numero: number
  ticket_id: number
  motivo: string
  metodo_devolucion: MetodoPago
  emitida_en: string
  base: number
  cuota_iva: number
  total: number
}

export interface InformeVentas {
  resumen: {
    ventas: number
    base: number
    iva: number
    tickets: number
    ticket_medio: number
    anulaciones: number
    importe_anulado: number
    efectivo: number
    tarjeta: number
    coste: number
    mermas_valor: number
    mermas_coste: number
    mermas_lineas: number
    shishas: number
  }
  por_dia: { dia: string; ventas: number; tickets: number }[]
  por_hora: { hora: number; ventas: number; tickets: number }[]
  productos: { nombre: string; unidades: number; importe: number }[]
  categorias: { nombre: string; unidades: number; importe: number }[]
  personal: { nombre: string; tickets: number; ventas: number }[]
  sabores: { nombre: string; color: string; shishas: number; cargas: number }[]
}

export function numeroDoc(d: { serie: string; numero: number }) {
  return `${d.serie}-${String(d.numero).padStart(5, '0')}`
}
