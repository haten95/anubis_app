# Anubis · Documento de diseño V1

Aplicación web para gestionar el local de shishas **Anubis**: sala y mesas, comandas, cobros, stock, personal, nóminas y proveedores.

> Estado: borrador para revisión. Las decisiones marcadas con **[Supuesto]** se han tomado por defecto y se pueden cambiar (ver §9).

---

## 1. Plataforma y stack

| Aspecto | Decisión |
|---|---|
| Tipo | PWA (aplicación web instalable) |
| Dispositivos | Móvil, tablet, PC y terminales de pago / TPV táctiles (con o sin cajón portamonedas) |
| Frontend | Next.js + React + Tailwind + shadcn/ui **[Supuesto: mismo stack que Olympic Fitness]** |
| Backend | Supabase: Postgres, Auth, RLS (seguridad por rol) y Realtime (comandas en vivo en todos los dispositivos) |
| Hosting | Vercel |
| Idioma | Español |

**Diseño adaptable**
- **Modo TPV / tablet**: botones grandes, pensado para uso táctil rápido con una mano.
- **Modo escritorio**: paneles de gestión (stock, turnos, nóminas, informes).
- **Modo móvil**: el camarero toma comandas desde la mesa.
- **Cajón portamonedas e impresora de tickets**: se dejan preparados como opcionales (fase posterior). La app funciona sin ellos.

---

## 2. Roles y permisos

| Funcionalidad | Dueño | Encargado | Empleado |
|---|:-:|:-:|:-:|
| Configurar el local (salas, terrazas, mesas) | ✅ | ❌ | ❌ |
| Carta y precios | ✅ | ✅ (sin precios) | ❌ |
| Ver mapa de mesas | ✅ | ✅ | ✅ |
| Abrir y editar comandas | ✅ | ✅ | ✅ |
| Anular líneas de una comanda ya enviada | ✅ | ✅ | ❌ |
| Cobrar | ✅ | ✅ | ✅ **[Supuesto]** |
| Abrir y cerrar caja (arqueo) | ✅ | ✅ | ❌ |
| Stock e inventario | ✅ | ✅ | Solo consulta |
| Proveedores y pedidos | ✅ | ✅ | ❌ |
| Turnos y funciones del día | ✅ | ✅ | Solo los suyos |
| Asignar tareas | ✅ | ✅ | Ve y marca las suyas |
| Nóminas | ✅ | ❌ | Solo las suyas |
| Facturación e informes | ✅ | Parcial (del día) | ❌ |
| Gestión de usuarios | ✅ | ❌ | ❌ |

Los permisos se aplican en la base de datos (RLS), no solo en la interfaz.

---

## 3. Configuración del local

El dueño define el espacio de trabajo:

- **Zonas**: tipo *Sala interior* o *Terraza*, con nombre (p. ej. "Sala principal", "Terraza 1"). Se pueden añadir, renombrar, ordenar y desactivar.
- **Mesas** dentro de cada zona: indica cuántas hay y se crean numeradas. La numeración es **acumulativa por tipo**: las salas interiores se numeran seguidas entre sí y las terrazas entre sí (p. ej. Sala 1–10; Terraza 1: 1–5, Terraza 2: 6–8). En pantalla y en el ticket se indica siempre «Sala · Mesa 3» o «Terraza · Mesa 3».
- Cada mesa se muestra como un **icono con su número**. Opcional: capacidad (nº de personas) y colocación en una cuadrícula para que el mapa se parezca al local real.
- Desactivar una mesa la oculta del mapa sin borrar su historial.

---

## 4. Mesas y comandas

### 4.1 Mapa de mesas
Pestañas por zona. Cada mesa muestra su número y su estado por color:

| Estado | Significado |
|---|---|
| Libre | Sin comanda abierta |
| Ocupada | Tiene una comanda abierta |
| Pendiente de cobro | Se ha pedido la cuenta |

En la mesa también se ve el importe acumulado y el tiempo desde que se abrió.

### 4.2 Regla principal
**Cada mesa tiene como máximo una comanda abierta.** No se puede abrir otra hasta que la actual esté **cobrada y cerrada**. La base de datos lo garantiza (índice único parcial), así que tampoco puede pasar si dos dispositivos lo intentan a la vez.

Operaciones de mesa: abrir comanda, **cambiar de mesa** y **juntar mesas** **[Supuesto, útil en sala]**.

### 4.3 Panel de comanda
Desde **Comandas** se elige la mesa y se abre su panel con las categorías de la carta:

- Cocktails
- **Shisha**
- Refrescos
- Agua
- Combinados
- Batidos
- Smoothies
- Zumos
- Vinos
- Cervezas
- (categorías configurables por el dueño)

Cada línea lleva producto, cantidad, precio, notas ("sin hielo") y quién la añadió.

### 4.4 Shisha
- Se eligen **uno o varios sabores** del catálogo de tabacos.
- Cada sabor lleva un **porcentaje**. La suma tiene que ser **100 %**: la app propone un reparto a partes iguales y se ajusta con deslizadores.
- **Dibujo de la cazoleta**: junto a los deslizadores aparece una cazoleta dibujada (SVG) vista desde arriba que se rellena en tiempo real con los sabores elegidos. Cada sabor ocupa un sector circular proporcional a su porcentaje y tiene su propio color, con el nombre y el % en una leyenda.
  - Ejemplo: 50 % menta, 30 % uva y 20 % limón se ven como media cazoleta verde, un 30 % morado y un 20 % amarillo, igual que se cargaría la cazoleta real.
  - Se puede ajustar arrastrando directamente las divisiones entre sectores de la cazoleta, además de con los deslizadores.
  - Mientras la suma no llega al 100 %, la parte que falta se ve vacía y no se puede añadir la shisha a la comanda.
  - Se ve en grande al montar la shisha y en miniatura en la línea de la comanda, para que quien la prepare sepa de un vistazo cómo cargarla.
  - Cada sabor tiene un color asignado en el catálogo (configurable), así que un sabor se ve siempre del mismo color.
- Opciones de cazoleta o base si las hay (p. ej. base de fruta, con su suplemento).
- **Cambio de carbón**: botón en la shisha ya servida. Añade una línea "Cambio de carbón" ligada a esa shisha, con precio configurable (puede ser 0 €), y se registra la hora para saber cuántos cambios lleva.
- Stock: cada shisha descuenta gramos de tabaco según los porcentajes y la carga configurada (p. ej. 20 g) y carbón por cada cambio.

---

## 5. Cobros y caja

### 5.1 Métodos de pago
| Método | Funcionamiento |
|---|---|
| **Efectivo** | Se introduce lo entregado y la app calcula **el cambio a devolver**. Botones rápidos: 5, 10, 20, 50 € e "importe exacto". |
| **Tarjeta** | Se registra el cobro. La integración directa con el datáfono queda para más adelante. |
| **Merma** | Lo consumido **no se cobra**. Ver §5.2. |

Se permite **pago mixto** (p. ej. una parte en efectivo y otra con tarjeta) y **dividir la cuenta** por líneas o a partes iguales **[Supuesto]**. Las líneas sueltas también se pueden pasar a merma (p. ej. una copa invitada dentro de una cuenta que sí se paga).

Al confirmar el cierre se marca la casilla correspondiente: **Pagado en efectivo**, **Pagado con tarjeta** o **Merma**. La comanda se cierra y la mesa queda libre.

### 5.2 Merma
Sirve para cerrar lo que se ha servido sin que nadie lo pague:

| Motivo | Ejemplo |
|---|---|
| Invitación de la casa | Chupito o shisha a un cliente habitual |
| Consumo de personal | La bebida del turno de un camarero |
| Error o rotura | Cóctel mal hecho, copa rota, comanda equivocada |
| Producto en mal estado | Tabaco seco, fruta estropeada |

Cómo funciona:
- **No se introduce ningún importe recibido** ni se calcula cambio, porque no entra dinero.
- **No genera ticket ni factura** y no suma en la facturación.
- **Sí descuenta stock** y guarda el **coste** de lo consumido (y su precio de carta, a título informativo).
- El **motivo es obligatorio** y se registra quién la autorizó. Solo pueden marcarla el **dueño y el encargado**.
- El dueño tiene un **informe de mermas** orientativo: coste perdido por día, motivo, producto y trabajador.

> **Límite legal.** Merma solo sirve para lo que **de verdad no se cobra**. Si un cliente paga y se registra como merma, son ventas ocultas, que es lo que prohíbe la Ley 11/2021 (art. 201 bis LGT). Esa ley sanciona tanto al negocio como a quien desarrolla el software. Por eso la merma no admite importes cobrados. Además, en el arqueo el efectivo esperado no la incluye, así que cualquier dinero cobrado por una merma aparece como descuadre.

### 5.3 Caja
- **Apertura** con fondo inicial.
- **Cierre / arqueo**: efectivo esperado frente a contado, descuadre, totales por método de pago y, aparte, el coste total de las mermas del turno (solo informativo).
- Entradas y salidas manuales de efectivo (p. ej. pagar a un repartidor), siempre con motivo.

### 5.4 Facturación
- Ticket o **factura simplificada** por cada cobro, con numeración correlativa.
- Factura completa con datos fiscales del cliente cuando la pida.
- **Verifactu**: el registro de facturación tiene que cumplir el reglamento. Se propone integrarlo mediante un proveedor certificado en una fase posterior. Mientras tanto, las facturas no se pueden editar ni borrar: solo **rectificar**.

---

## 6. Gestión del negocio

### 6.1 Stock e inventario
- Productos con unidad (unidad, gramos, ml), coste, stock actual y **stock mínimo** (con alerta).
- Descuento automático al cobrar, usando la receta o escandallo de cada artículo de la carta (p. ej. un mojito descuenta ron, menta, lima…).
- Entradas de mercancía (desde pedidos a proveedor), mermas (desde la comanda, §5.2, o directas desde el almacén) y recuentos de inventario con ajuste.
- Historial de movimientos.

### 6.2 Proveedores
- Ficha con nombre, contacto, email, teléfono y productos que suministra.
- **Pedido por email**: genera el pedido (p. ej. a partir del stock bajo mínimos) y lo envía por correo.
- **WhatsApp**: queda para más adelante (WhatsApp Business API). En la V1, como mucho, un enlace `wa.me` con el pedido ya redactado.

### 6.3 Personal y turnos
- Fichas de trabajadores con rol (encargado o empleado).
- **Cuadrante semanal** de turnos: día, hora de inicio y hora de fin.
- **Función del día** en cada turno de un empleado: **Barra**, **Shishas** o **Sala**.
- **Tareas**: el dueño o el encargado asigna tareas concretas a un trabajador en un día (p. ej. "limpiar cachimbas", "inventario de tabaco"). El empleado las ve en su inicio y las marca como hechas.
- Opcional: fichaje de entrada y salida **[Supuesto: el registro horario es obligatorio en España, así que conviene incluirlo]**.

### 6.4 Nóminas
- Datos por trabajador: salario base, tipo de contrato y horas.
- Cálculo a partir de horas trabajadas o fichadas y extras. Registro mensual de cada nómina (bruto, retenciones, neto y estado pagada / pendiente).
- Cada empleado ve las suyas.
- **Alcance**: la app registra y prepara los datos. El cálculo oficial (Seguridad Social, IRPF) lo hace la gestoría, que puede recibir una exportación a Excel.

### 6.5 Informes (dueño)
Ventas por día, franja horaria, producto, camarero y método de pago. Sabores de shisha más vendidos. Coste frente a venta. Informe de mermas (coste por motivo, producto y trabajador), separado de la facturación. Exportación a Excel.

---

## 7. Modelo de datos (borrador)

| Tabla | Contenido |
|---|---|
| `usuarios` | id (auth), nombre, rol (dueno/encargado/empleado), activo |
| `zonas` | nombre, tipo (interior/terraza), orden, activa |
| `mesas` | zona_id, tipo (copiado de la zona), numero (único por tipo), capacidad, activa |
| `categorias` | nombre, orden, es_shisha |
| `articulos` | categoria_id, nombre, precio, iva, activo |
| `sabores` | nombre, marca, color (para el dibujo de la cazoleta), producto_stock_id |
| `comandas` | mesa_id, estado (abierta/pendiente_cobro/cerrada/anulada), abierta_por, abierta_en, cerrada_en. **Índice único parcial: 1 abierta por mesa** |
| `lineas_comanda` | comanda_id, articulo_id, cantidad, precio_unitario, notas, linea_padre_id (carbón → shisha), estado |
| `lineas_shisha_sabores` | linea_id, sabor_id, porcentaje (la suma por línea = 100) |
| `pagos` | comanda_id, metodo (efectivo/tarjeta), importe, entregado, cambio, cobrado_por |
| `mermas` | comanda_id o linea_id (o directa desde almacén), motivo, coste, precio_carta (informativo), autorizada_por, fecha. **Sin importe cobrado** |
| `facturas` | serie, número correlativo, comanda_id, totales, hash encadenado (Verifactu) |
| `cajas` / `movimientos_caja` | aperturas, cierres, arqueos, entradas y salidas |
| `productos_stock` / `recetas` / `movimientos_stock` | inventario y escandallos |
| `proveedores` / `pedidos_proveedor` / `lineas_pedido` | compras |
| `turnos` | usuario_id, fecha, inicio, fin, funcion (barra/shishas/sala) |
| `tareas` | usuario_id, fecha, descripcion, hecha, asignada_por |
| `fichajes` | usuario_id, entrada, salida |
| `nominas` | usuario_id, mes, bruto, retenciones, neto, estado |

---

## 8. Fases de desarrollo

| Fase | Contenido | Resultado |
|---|---|---|
| **1. Base** | Proyecto, Auth y roles, configuración del local (zonas y mesas), carta y categorías | El dueño monta su local y su carta |
| **2. Servicio** | Mapa de mesas en tiempo real, comandas, shisha con sabores, % sobre el dibujo de la cazoleta y carbón, cobro (efectivo con cambio, tarjeta), merma, caja y arqueo, tickets | **Se puede trabajar una noche real** |
| **3. Stock** | Inventario, escandallos, descuento automático, alertas, proveedores y pedido por email | Control de existencias |
| **4. Personal** | Turnos, funciones del día, tareas, fichaje, nóminas | Gestión del equipo |
| **5. Facturación e informes** | Facturas, Verifactu (proveedor certificado), informes, exportación a Excel | Cumplimiento y análisis |
| **6. Extras** | WhatsApp Business, impresora de tickets y cajón, datáfono integrado, modo sin conexión | Integraciones |

---

## 9. Decisiones pendientes

1. ¿Alguien más que el dueño y el encargado puede marcar mermas? ¿Hace falta un tope (p. ej. un máximo al día por trabajador)?
2. ¿Pueden cobrar los empleados o solo el encargado y el dueño?
3. ¿Los precios cambian según la zona (p. ej. terraza más cara) o por horario (happy hour)?
4. ¿Cuántos dispositivos a la vez y de qué tipo (marca y modelo del TPV)? ¿Hay impresora de tickets?
5. ¿El cambio de carbón se cobra? ¿Cuánto?
6. ¿Una o varias cargas de shisha (normal o premium) con precios distintos?
7. ¿Hace falta que funcione sin conexión a internet?
8. ¿El dueño gestiona un solo local o podrían ser varios en el futuro?
