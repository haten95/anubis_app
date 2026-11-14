# Anubis · Gestión del local

PWA para el local de shishas Anubis. Diseño completo en [`docs/Documento de diseño V1.md`](docs/Documento%20de%20diseño%20V1.md).

## Fase 1 (hecha)
- Login y registro. El **primer usuario que se registra es el dueño**; el resto entra como empleado pendiente hasta que el dueño lo active.
- Roles dueño / encargado / empleado con seguridad en la base de datos (RLS).
- **Local**: salas interiores y terrazas, mesas numeradas (número único en todo el local), capacidad, activar/desactivar.
- **Sala**: mapa de mesas por zona, en tiempo real.
- **Carta**: categorías (con las 10 iniciales), artículos con precio e IVA, sabores de shisha con su color para la cazoleta. El encargado edita la carta pero no los precios.
- **Equipo**: activar cuentas y asignar roles.

## Fase 2 (hecha)
- Comandas por mesa en tiempo real, una abierta por mesa; notas, cantidades, cambiar de mesa, «pide la cuenta».
- Shisha con cazoleta dibujada: sabores y porcentajes (deben sumar 100 %), arrastrando o con deslizadores; cambios de carbón.
- Cobro en efectivo (con cambio), tarjeta o mixto; factura simplificada imprimible con desglose de IVA.
- Merma (solo dueño/encargado): no se cobra, no factura, solo orientativa.
- Caja: apertura, entradas/salidas, arqueo con descuadre, tickets y mermas del turno.

## Fase 3 (hecha)
- Stock: productos en unidades, gramos o ml; mínimo con aviso en el menú; entradas, mermas de almacén y recuentos.
- Escandallos: qué gasta cada artículo. En las shishas, gramos por carga repartidos según el % de cada sabor.
- El stock se descuenta solo al cerrar la comanda (cobrada o en merma). La merma guarda su coste real.
- Proveedores y pedidos: sugerencia con lo que está bajo mínimo, envío por email o WhatsApp con el texto ya escrito, recepción que suma al stock y actualiza costes.

## Fase 4 (hecha)
- **Personal → Mi día** (todos): fichar entrada/salida, turno y función de hoy (barra, shishas, sala), tareas con casilla, semana y nóminas propias.
- **Cuadrante** (dueño/encargado): semana por persona, función de cada día, horarios rápidos y «copiar semana anterior».
- **Tareas**: asignar por persona y día; se ven en tiempo real.
- **Fichajes**: quién está trabajando, horas fichadas frente a planificadas, correcciones del dueño con motivo y CSV del registro de jornada.
- **Nóminas** (dueño): datos laborales, cálculo orientativo del mes (fijo o por horas fichadas), ajustes, pagada/pendiente y CSV para la gestoría.
- «Cuentas y roles» (activar trabajadores) está ahora dentro de Personal.

## Fase 5 (hecha)
- **Caja → Tickets y facturas**: buscar tickets, reimprimir, factura completa con datos del cliente (serie F, sustituye al ticket) y anulación con factura rectificativa (serie R) que descuenta la devolución de la caja.
- **Registro de facturación**: cada documento genera un registro inalterable con huella SHA-256 encadenada (formato Verifactu) y el dueño puede comprobar la integridad. El envío a la AEAT queda para un proveedor certificado.
- **Informes** (dueño): ventas, tickets, ticket medio, margen según escandallos, métodos de pago, mermas, anulaciones; gráficos por día y por hora; lo más vendido, sabores, categorías y personal. El día de negocio va de 06:00 a 06:00.
- **Excel**: resumen, desgloses y libro de facturas emitidas por tipo de IVA para la gestoría.
- En el móvil, si no caben todas las secciones, aparece «Más».

## Puesta en marcha
1. Crea un proyecto en Supabase y ejecuta en el SQL Editor, por orden, los archivos de `supabase/migrations/`.
2. Copia `.env.example` a `.env.local` y rellena la URL y la clave publicable.
3. `corepack pnpm install` y `corepack pnpm dev`.
4. Regístrate: esa cuenta será la del dueño.

Tests: `corepack pnpm test`.
