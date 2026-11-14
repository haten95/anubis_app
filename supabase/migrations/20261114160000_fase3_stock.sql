-- =====================================================================
-- Anubis · Fase 3: stock, escandallos, proveedores y pedidos
--
-- El stock se descuenta solo al cerrar una comanda (cobrada o en merma),
-- según la receta de cada artículo y, en las shishas, los gramos de
-- tabaco repartidos por el porcentaje de cada sabor.
-- La cantidad en stock solo cambia mediante movimientos (nunca a mano).
-- =====================================================================

create type public.unidad_stock   as enum ('ud', 'g', 'ml');
create type public.tipo_mov_stock as enum ('venta', 'merma', 'entrada', 'merma_almacen', 'ajuste');
create type public.estado_pedido  as enum ('borrador', 'enviado', 'recibido', 'cancelado');

-- ---------------------------------------------------------------------
-- Proveedores y productos
-- ---------------------------------------------------------------------
create table public.proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 80),
  contacto   text check (char_length(contacto) <= 80),
  email      text check (email is null or (char_length(email) <= 120 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  telefono   text check (char_length(telefono) <= 30),
  notas      text check (char_length(notas) <= 500),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table public.productos_stock (
  id              bigint generated always as identity primary key,
  nombre          text not null check (char_length(trim(nombre)) between 1 and 80),
  unidad          public.unidad_stock not null default 'ud',
  stock           numeric(12, 3) not null default 0,
  stock_minimo    numeric(12, 3) not null default 0 check (stock_minimo >= 0),
  coste_unitario  numeric(12, 4) not null default 0 check (coste_unitario >= 0),
  proveedor_id    bigint references public.proveedores (id) on delete set null,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);
create unique index productos_stock_nombre_idx on public.productos_stock (lower(nombre));
create index productos_stock_proveedor_idx on public.productos_stock (proveedor_id);

-- Escandallo: qué productos consume cada artículo de la carta
create table public.recetas (
  articulo_id  bigint not null references public.articulos (id) on delete cascade,
  producto_id  bigint not null references public.productos_stock (id) on delete restrict,
  cantidad     numeric(12, 3) not null check (cantidad > 0),
  primary key (articulo_id, producto_id)
);
create index recetas_producto_idx on public.recetas (producto_id);

-- Shisha: gramos de tabaco por carga, y producto de stock de cada sabor
alter table public.articulos add column gramos_tabaco numeric(6, 1)
  check (gramos_tabaco is null or gramos_tabaco between 1 and 100);
alter table public.sabores add column producto_id bigint references public.productos_stock (id) on delete set null;

-- Coste real de lo que se fue en merma (orientativo)
alter table public.mermas add column coste numeric(10, 2);

-- ---------------------------------------------------------------------
-- Pedidos a proveedor
-- ---------------------------------------------------------------------
create table public.pedidos_proveedor (
  id           bigint generated always as identity primary key,
  proveedor_id bigint not null references public.proveedores (id),
  estado       public.estado_pedido not null default 'borrador',
  notas        text check (char_length(notas) <= 500),
  creado_por   uuid not null default auth.uid() references public.usuarios (id),
  creado_en    timestamptz not null default now(),
  enviado_en   timestamptz,
  recibido_en  timestamptz
);
create index pedidos_proveedor_idx on public.pedidos_proveedor (proveedor_id);

create table public.lineas_pedido (
  id              bigint generated always as identity primary key,
  pedido_id       bigint not null references public.pedidos_proveedor (id) on delete cascade,
  producto_id     bigint not null references public.productos_stock (id),
  cantidad        numeric(12, 3) not null check (cantidad > 0),
  coste_unitario  numeric(12, 4) check (coste_unitario >= 0),
  unique (pedido_id, producto_id)
);
create index lineas_pedido_producto_idx on public.lineas_pedido (producto_id);

-- ---------------------------------------------------------------------
-- Movimientos de stock (historial inalterable)
-- ---------------------------------------------------------------------
create table public.movimientos_stock (
  id                bigint generated always as identity primary key,
  producto_id       bigint not null references public.productos_stock (id),
  tipo              public.tipo_mov_stock not null,
  cantidad          numeric(12, 3) not null,          -- con signo: + entra, − sale
  coste_unitario    numeric(12, 4),
  stock_resultante  numeric(12, 3) not null,
  comanda_id        bigint references public.comandas (id),
  pedido_id         bigint references public.pedidos_proveedor (id),
  nota              text check (char_length(nota) <= 200),
  usuario_id        uuid references public.usuarios (id),
  creado_en         timestamptz not null default now()
);
create index movimientos_stock_producto_idx on public.movimientos_stock (producto_id, creado_en desc);
create index movimientos_stock_fecha_idx on public.movimientos_stock (creado_en desc);
create index movimientos_stock_comanda_idx on public.movimientos_stock (comanda_id);

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.proveedores        enable row level security;
alter table public.productos_stock    enable row level security;
alter table public.recetas            enable row level security;
alter table public.pedidos_proveedor  enable row level security;
alter table public.lineas_pedido      enable row level security;
alter table public.movimientos_stock  enable row level security;

create policy proveedores_select on public.proveedores for select to authenticated using ((select private.es_gestor()));
create policy proveedores_write on public.proveedores for all to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));

-- Los empleados pueden consultar el stock
create policy productos_select on public.productos_stock for select to authenticated using ((select private.es_personal()));
create policy productos_insert on public.productos_stock for insert to authenticated with check ((select private.es_gestor()));
create policy productos_update on public.productos_stock for update to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));
create policy productos_delete on public.productos_stock for delete to authenticated using ((select private.es_gestor()));

create policy recetas_select on public.recetas for select to authenticated using ((select private.es_personal()));
create policy recetas_write on public.recetas for all to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));

create policy pedidos_select on public.pedidos_proveedor for select to authenticated using ((select private.es_gestor()));
create policy pedidos_insert on public.pedidos_proveedor for insert to authenticated with check ((select private.es_gestor()));
create policy pedidos_update on public.pedidos_proveedor for update to authenticated
  using ((select private.es_gestor()) and estado = 'borrador') with check ((select private.es_gestor()));
create policy pedidos_delete on public.pedidos_proveedor for delete to authenticated
  using ((select private.es_gestor()) and estado = 'borrador');

-- Las líneas solo se tocan mientras el pedido está en borrador
create policy lineas_pedido_select on public.lineas_pedido for select to authenticated using ((select private.es_gestor()));
create policy lineas_pedido_write on public.lineas_pedido for all to authenticated
  using ((select private.es_gestor()) and exists (select 1 from public.pedidos_proveedor p where p.id = pedido_id and p.estado = 'borrador'))
  with check ((select private.es_gestor()) and exists (select 1 from public.pedidos_proveedor p where p.id = pedido_id and p.estado = 'borrador'));

create policy movimientos_stock_select on public.movimientos_stock for select to authenticated using ((select private.es_gestor()));

revoke all on public.proveedores, public.productos_stock, public.recetas, public.pedidos_proveedor,
  public.lineas_pedido, public.movimientos_stock from anon, authenticated;

grant select, insert, update, delete on public.proveedores, public.recetas, public.lineas_pedido to authenticated;
grant select, delete on public.productos_stock, public.pedidos_proveedor to authenticated;
-- El stock no se puede escribir directamente: solo por movimientos
grant insert (nombre, unidad, stock_minimo, coste_unitario, proveedor_id, activo) on public.productos_stock to authenticated;
grant update (nombre, unidad, stock_minimo, coste_unitario, proveedor_id, activo) on public.productos_stock to authenticated;
-- El estado del pedido cambia solo por funciones
grant insert (proveedor_id, notas) on public.pedidos_proveedor to authenticated;
grant update (proveedor_id, notas) on public.pedidos_proveedor to authenticated;
grant select on public.movimientos_stock to authenticated;

alter publication supabase_realtime add table public.productos_stock;

-- ---------------------------------------------------------------------
-- Núcleo: aplicar un movimiento de stock
-- ---------------------------------------------------------------------
create or replace function private.aplicar_movimiento(
  p_producto bigint, p_tipo public.tipo_mov_stock, p_cantidad numeric,
  p_comanda bigint default null, p_pedido bigint default null, p_nota text default null
)
returns numeric  -- coste del movimiento (valor absoluto)
language plpgsql security definer set search_path = ''
as $$
declare
  v_stock numeric;
  v_coste numeric;
begin
  update public.productos_stock
  set stock = stock + p_cantidad
  where id = p_producto
  returning stock, coste_unitario into v_stock, v_coste;

  if v_stock is null then
    raise exception 'El producto de stock no existe';
  end if;

  insert into public.movimientos_stock (producto_id, tipo, cantidad, coste_unitario, stock_resultante, comanda_id, pedido_id, nota, usuario_id)
  values (p_producto, p_tipo, p_cantidad, v_coste, v_stock, p_comanda, p_pedido, nullif(trim(p_nota), ''), auth.uid());

  return round(abs(p_cantidad) * v_coste, 2);
end;
$$;

-- Descuenta el stock de una comanda al cerrarse (cobrada o en merma)
create or replace function private.descontar_stock_comanda()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  l record;
  r record;
  v_tipo public.tipo_mov_stock;
  v_coste numeric;
  v_gramos numeric;
begin
  if not (new.estado = 'cerrada' and old.estado <> 'cerrada' and new.cierre in ('pagada', 'merma')) then
    return new;
  end if;

  for l in
    select * from public.lineas_comanda where comanda_id = new.id and not anulada
  loop
    v_tipo := case when l.merma then 'merma'::public.tipo_mov_stock else 'venta'::public.tipo_mov_stock end;
    v_coste := 0;

    -- Escandallo del artículo
    for r in select producto_id, cantidad from public.recetas where articulo_id = l.articulo_id loop
      v_coste := v_coste + private.aplicar_movimiento(r.producto_id, v_tipo, -(r.cantidad * l.cantidad), new.id, null, l.nombre);
    end loop;

    -- Tabaco de la shisha según el porcentaje de cada sabor
    if l.es_shisha then
      select gramos_tabaco into v_gramos from public.articulos where id = l.articulo_id;
      if v_gramos is not null then
        for r in
          select s.producto_id, ls.porcentaje
          from public.lineas_shisha_sabores ls
          join public.sabores s on s.id = ls.sabor_id
          where ls.linea_id = l.id and s.producto_id is not null
        loop
          v_coste := v_coste + private.aplicar_movimiento(
            r.producto_id, v_tipo, -round(v_gramos * r.porcentaje / 100.0, 3), new.id, null, l.nombre);
        end loop;
      end if;
    end if;

    if l.merma then
      update public.mermas set coste = v_coste where linea_id = l.id;
    end if;
  end loop;

  return new;
end;
$$;

create trigger descontar_stock_al_cerrar
  after update of estado on public.comandas
  for each row execute function private.descontar_stock_comanda();

-- ---------------------------------------------------------------------
-- Operaciones de almacén
-- ---------------------------------------------------------------------
create or replace function public.entrada_stock(p_producto bigint, p_cantidad numeric, p_coste_unitario numeric default null, p_nota text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.exigir_gestor();
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que 0';
  end if;
  if p_coste_unitario is not null then
    if p_coste_unitario < 0 then
      raise exception 'Coste no válido';
    end if;
    update public.productos_stock set coste_unitario = p_coste_unitario where id = p_producto;
  end if;
  perform private.aplicar_movimiento(p_producto, 'entrada', p_cantidad, null, null, coalesce(p_nota, 'Entrada manual'));
end;
$$;

create or replace function public.merma_almacen(p_producto bigint, p_cantidad numeric, p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.exigir_gestor();
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que 0';
  end if;
  if nullif(trim(p_nota), '') is null then
    raise exception 'Indica el motivo (caducado, roto…)';
  end if;
  perform private.aplicar_movimiento(p_producto, 'merma_almacen', -p_cantidad, null, null, p_nota);
end;
$$;

-- Recuento físico: deja el stock en la cantidad contada y registra la diferencia
create or replace function public.recuento_stock(p_producto bigint, p_real numeric, p_nota text default null)
returns numeric language plpgsql security definer set search_path = ''
as $$
declare
  v_actual numeric;
  v_dif numeric;
begin
  perform private.exigir_gestor();
  if p_real is null or p_real < 0 then
    raise exception 'Cantidad contada no válida';
  end if;
  select stock into v_actual from public.productos_stock where id = p_producto for update;
  if v_actual is null then
    raise exception 'El producto no existe';
  end if;
  v_dif := p_real - v_actual;
  if v_dif <> 0 then
    perform private.aplicar_movimiento(p_producto, 'ajuste', v_dif, null, null, coalesce(nullif(trim(p_nota), ''), 'Recuento'));
  end if;
  return v_dif;
end;
$$;

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create or replace function public.marcar_pedido_enviado(p_pedido bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.exigir_gestor();
  if not exists (select 1 from public.lineas_pedido where pedido_id = p_pedido) then
    raise exception 'El pedido no tiene productos';
  end if;
  update public.pedidos_proveedor set estado = 'enviado', enviado_en = now()
  where id = p_pedido and estado = 'borrador';
  if not found then
    raise exception 'Solo se puede enviar un pedido en borrador';
  end if;
end;
$$;

create or replace function public.cancelar_pedido(p_pedido bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.exigir_gestor();
  update public.pedidos_proveedor set estado = 'cancelado'
  where id = p_pedido and estado in ('borrador', 'enviado');
  if not found then
    raise exception 'Este pedido ya no se puede cancelar';
  end if;
end;
$$;

-- p_lineas: [{"producto_id": 1, "cantidad": 10, "coste_unitario": 1.25}, ...] (lo realmente recibido)
create or replace function public.recibir_pedido(p_pedido bigint, p_lineas jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  e jsonb;
  v_cant numeric;
  v_coste numeric;
begin
  perform private.exigir_gestor();
  perform 1 from public.pedidos_proveedor where id = p_pedido and estado in ('borrador', 'enviado') for update;
  if not found then
    raise exception 'Este pedido ya está recibido o cancelado';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'Líneas no válidas';
  end if;

  for e in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (e ->> 'cantidad')::numeric;
    v_coste := (e ->> 'coste_unitario')::numeric;
    if v_cant is null or v_cant < 0 then
      raise exception 'Cantidad recibida no válida';
    end if;
    if v_cant = 0 then
      continue;
    end if;
    if v_coste is not null and v_coste >= 0 then
      update public.productos_stock set coste_unitario = v_coste where id = (e ->> 'producto_id')::bigint;
    end if;
    perform private.aplicar_movimiento((e ->> 'producto_id')::bigint, 'entrada', v_cant, null, p_pedido, 'Pedido recibido');
  end loop;

  update public.pedidos_proveedor set estado = 'recibido', recibido_en = now() where id = p_pedido;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'entrada_stock(bigint,numeric,numeric,text)',
    'merma_almacen(bigint,numeric,text)',
    'recuento_stock(bigint,numeric,text)',
    'marcar_pedido_enviado(bigint)',
    'cancelar_pedido(bigint)',
    'recibir_pedido(bigint,jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
