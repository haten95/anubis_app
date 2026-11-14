-- =====================================================================
-- Anubis · Fase 2: comandas, shisha, cobros, merma, caja y tickets
--
-- Todas las escrituras de servicio pasan por funciones (RPC) que validan
-- rol y reglas de negocio. Las tablas solo permiten lectura directa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Datos del local para el ticket
-- ---------------------------------------------------------------------
create table public.ajustes_local (
  id                boolean primary key default true check (id),
  nombre_comercial  text not null default 'Anubis Shisha Lounge' check (char_length(nombre_comercial) <= 80),
  razon_social      text check (char_length(razon_social) <= 120),
  nif               text check (char_length(nif) <= 20),
  direccion         text check (char_length(direccion) <= 200),
  telefono          text check (char_length(telefono) <= 30),
  pie_ticket        text default 'Gracias por su visita' check (char_length(pie_ticket) <= 200)
);
insert into public.ajustes_local default values;

alter table public.ajustes_local enable row level security;
create policy ajustes_select on public.ajustes_local for select to authenticated
  using ((select private.es_personal()));
create policy ajustes_update on public.ajustes_local for update to authenticated
  using ((select private.es_dueno())) with check ((select private.es_dueno()));
revoke all on public.ajustes_local from anon;
grant select, update on public.ajustes_local to authenticated;

-- ---------------------------------------------------------------------
-- Artículo especial "Cambio de carbón"
-- ---------------------------------------------------------------------
alter table public.articulos add column es_cambio_carbon boolean not null default false;
create unique index articulos_un_carbon on public.articulos (es_cambio_carbon) where es_cambio_carbon;

insert into public.articulos (categoria_id, nombre, descripcion, precio, iva, orden, es_cambio_carbon)
select id, 'Cambio de carbón', 'Se añade desde la shisha servida', 0, 10, 999, true
from public.categorias where es_shisha order by orden limit 1;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.estado_comanda as enum ('abierta', 'cuenta', 'cerrada');
create type public.cierre_comanda as enum ('pagada', 'merma', 'vacia');
create type public.metodo_pago    as enum ('efectivo', 'tarjeta');
create type public.motivo_merma   as enum ('invitacion', 'personal', 'error', 'mal_estado');
create type public.tipo_mov_caja  as enum ('entrada', 'salida');

-- ---------------------------------------------------------------------
-- Caja
-- ---------------------------------------------------------------------
create table public.cajas (
  id                 bigint generated always as identity primary key,
  abierta_por        uuid not null references public.usuarios (id),
  abierta_en         timestamptz not null default now(),
  fondo_inicial      numeric(10, 2) not null check (fondo_inicial >= 0),
  cerrada_por        uuid references public.usuarios (id),
  cerrada_en         timestamptz,
  efectivo_esperado  numeric(10, 2),
  efectivo_contado   numeric(10, 2) check (efectivo_contado >= 0),
  notas              text check (char_length(notas) <= 500)
);
-- Solo una caja abierta a la vez
create unique index cajas_una_abierta on public.cajas ((true)) where cerrada_en is null;

create table public.movimientos_caja (
  id          bigint generated always as identity primary key,
  caja_id     bigint not null references public.cajas (id),
  tipo        public.tipo_mov_caja not null,
  importe     numeric(10, 2) not null check (importe > 0),
  motivo      text not null check (char_length(trim(motivo)) between 1 and 200),
  usuario_id  uuid not null references public.usuarios (id),
  creado_en   timestamptz not null default now()
);
create index movimientos_caja_caja_idx on public.movimientos_caja (caja_id);

-- ---------------------------------------------------------------------
-- Comandas y líneas
-- ---------------------------------------------------------------------
create table public.comandas (
  id           bigint generated always as identity primary key,
  mesa_id      bigint not null references public.mesas (id),
  estado       public.estado_comanda not null default 'abierta',
  cierre       public.cierre_comanda,
  abierta_por  uuid not null references public.usuarios (id),
  abierta_en   timestamptz not null default now(),
  cerrada_por  uuid references public.usuarios (id),
  cerrada_en   timestamptz,
  check ((estado = 'cerrada') = (cierre is not null))
);
-- Regla principal: una sola comanda abierta por mesa
create unique index comandas_una_abierta_por_mesa on public.comandas (mesa_id) where estado <> 'cerrada';
create index comandas_abierta_en_idx on public.comandas (abierta_en desc);

create table public.lineas_comanda (
  id              bigint generated always as identity primary key,
  comanda_id      bigint not null references public.comandas (id),
  articulo_id     bigint not null references public.articulos (id),
  nombre          text not null,
  precio          numeric(10, 2) not null check (precio >= 0),
  iva             numeric(4, 2) not null,
  cantidad        int not null default 1 check (cantidad between 1 and 99),
  notas           text check (char_length(notas) <= 200),
  es_shisha       boolean not null default false,
  linea_padre_id  bigint references public.lineas_comanda (id),
  merma           boolean not null default false,
  anulada         boolean not null default false,
  anulada_por     uuid references public.usuarios (id),
  anulada_en      timestamptz,
  creado_por      uuid not null references public.usuarios (id),
  creado_en       timestamptz not null default now()
);
create index lineas_comanda_comanda_idx on public.lineas_comanda (comanda_id);
create index lineas_comanda_padre_idx on public.lineas_comanda (linea_padre_id);

create table public.lineas_shisha_sabores (
  linea_id    bigint not null references public.lineas_comanda (id),
  sabor_id    bigint not null references public.sabores (id),
  nombre      text not null,
  color       text not null,
  porcentaje  int not null check (porcentaje between 1 and 100),
  orden       int not null default 0,
  primary key (linea_id, sabor_id)
);

-- ---------------------------------------------------------------------
-- Tickets, pagos y mermas
-- ---------------------------------------------------------------------
create table public.tickets (
  id           bigint generated always as identity primary key,
  serie        text not null,
  numero       int not null,
  comanda_id   bigint not null unique references public.comandas (id),
  caja_id      bigint not null references public.cajas (id),
  emitido_en   timestamptz not null default now(),
  emitido_por  uuid not null references public.usuarios (id),
  mesa_texto   text not null,
  lineas       jsonb not null,
  desglose_iva jsonb not null,
  base         numeric(10, 2) not null,
  cuota_iva    numeric(10, 2) not null,
  total        numeric(10, 2) not null check (total > 0),
  unique (serie, numero)
);

create table public.pagos (
  id           bigint generated always as identity primary key,
  comanda_id   bigint not null references public.comandas (id),
  ticket_id    bigint not null references public.tickets (id),
  caja_id      bigint not null references public.cajas (id),
  metodo       public.metodo_pago not null,
  importe      numeric(10, 2) not null check (importe > 0),
  entregado    numeric(10, 2) check (entregado >= importe),
  cambio       numeric(10, 2) not null default 0 check (cambio >= 0),
  cobrado_por  uuid not null references public.usuarios (id),
  creado_en    timestamptz not null default now()
);
create index pagos_caja_idx on public.pagos (caja_id);
create index pagos_ticket_idx on public.pagos (ticket_id);

-- Merma: consumo que NO se cobra. No guarda ningún importe cobrado.
create table public.mermas (
  id              bigint generated always as identity primary key,
  comanda_id      bigint not null references public.comandas (id),
  linea_id        bigint not null unique references public.lineas_comanda (id),
  motivo          public.motivo_merma not null,
  nota            text check (char_length(nota) <= 200),
  valor_carta     numeric(10, 2) not null, -- informativo: lo que habría costado en carta
  autorizada_por  uuid not null references public.usuarios (id),
  creado_en       timestamptz not null default now()
);
create index mermas_creado_en_idx on public.mermas (creado_en);

-- ---------------------------------------------------------------------
-- Seguridad: lectura según rol, escritura solo por funciones
-- ---------------------------------------------------------------------
alter table public.cajas                 enable row level security;
alter table public.movimientos_caja      enable row level security;
alter table public.comandas              enable row level security;
alter table public.lineas_comanda        enable row level security;
alter table public.lineas_shisha_sabores enable row level security;
alter table public.tickets               enable row level security;
alter table public.pagos                 enable row level security;
alter table public.mermas                enable row level security;

create policy cajas_select on public.cajas for select to authenticated using ((select private.es_personal()));
create policy movimientos_caja_select on public.movimientos_caja for select to authenticated using ((select private.es_gestor()));
create policy comandas_select on public.comandas for select to authenticated using ((select private.es_personal()));
create policy lineas_select on public.lineas_comanda for select to authenticated using ((select private.es_personal()));
create policy lineas_sabores_select on public.lineas_shisha_sabores for select to authenticated using ((select private.es_personal()));
create policy tickets_select on public.tickets for select to authenticated using ((select private.es_personal()));
create policy pagos_select on public.pagos for select to authenticated using ((select private.es_personal()));
create policy mermas_select on public.mermas for select to authenticated using ((select private.es_gestor()));

revoke all on public.cajas, public.movimientos_caja, public.comandas, public.lineas_comanda,
  public.lineas_shisha_sabores, public.tickets, public.pagos, public.mermas from anon, authenticated;
grant select on public.cajas, public.movimientos_caja, public.comandas, public.lineas_comanda,
  public.lineas_shisha_sabores, public.tickets, public.pagos, public.mermas to authenticated;

alter publication supabase_realtime add table public.comandas, public.lineas_comanda, public.cajas;

-- ---------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------
create or replace function private.exigir_personal()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_personal() then
    raise exception 'No tienes acceso' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.exigir_gestor()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_gestor() then
    raise exception 'Solo el dueño o el encargado pueden hacer esto' using errcode = '42501';
  end if;
end;
$$;

-- Devuelve la comanda bloqueada para escribir; falla si está cerrada
create or replace function private.comanda_editable(p_comanda bigint)
returns public.comandas language plpgsql security definer set search_path = ''
as $$
declare
  c public.comandas;
begin
  select * into c from public.comandas where id = p_comanda for update;
  if c.id is null then
    raise exception 'La comanda no existe';
  end if;
  if c.estado = 'cerrada' then
    raise exception 'La comanda ya está cerrada';
  end if;
  return c;
end;
$$;

-- Total a cobrar: líneas no anuladas y que no son merma
create or replace function private.total_comanda(p_comanda bigint)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(precio * cantidad), 0)::numeric(10, 2)
  from public.lineas_comanda
  where comanda_id = p_comanda and not anulada and not merma
$$;

create or replace function private.caja_abierta()
returns public.cajas language sql stable security definer set search_path = ''
as $$ select * from public.cajas where cerrada_en is null limit 1 $$;

-- ---------------------------------------------------------------------
-- Comandas
-- ---------------------------------------------------------------------
create or replace function public.abrir_comanda(p_mesa bigint)
returns public.comandas language plpgsql security definer set search_path = ''
as $$
declare
  c public.comandas;
begin
  perform private.exigir_personal();
  if not exists (select 1 from public.mesas m join public.zonas z on z.id = m.zona_id
                 where m.id = p_mesa and m.activa and z.activa) then
    raise exception 'La mesa no existe o está desactivada';
  end if;
  begin
    insert into public.comandas (mesa_id, abierta_por) values (p_mesa, auth.uid()) returning * into c;
  exception when unique_violation then
    raise exception 'Esta mesa ya tiene una comanda abierta. Ciérrala antes de abrir otra.';
  end;
  return c;
end;
$$;

create or replace function public.anadir_linea(p_comanda bigint, p_articulo bigint, p_cantidad int default 1, p_notas text default null)
returns public.lineas_comanda language plpgsql security definer set search_path = ''
as $$
declare
  a record;
  l public.lineas_comanda;
  v_notas text := nullif(trim(p_notas), '');
begin
  perform private.exigir_personal();
  perform private.comanda_editable(p_comanda);
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 99 then
    raise exception 'Cantidad no válida';
  end if;

  select ar.*, ca.es_shisha into a
  from public.articulos ar join public.categorias ca on ca.id = ar.categoria_id
  where ar.id = p_articulo and ar.activo and ca.activa;
  if a.id is null then
    raise exception 'El artículo no está disponible';
  end if;
  if a.es_shisha or a.es_cambio_carbon then
    raise exception 'Las shishas y los cambios de carbón se añaden desde su propio botón';
  end if;

  -- Si ya hay una línea igual sin notas, suma la cantidad
  if v_notas is null then
    update public.lineas_comanda
    set cantidad = least(cantidad + p_cantidad, 99)
    where id = (select id from public.lineas_comanda
                where comanda_id = p_comanda and articulo_id = p_articulo and notas is null
                  and not anulada and not merma and precio = a.precio
                order by id limit 1)
    returning * into l;
    if l.id is not null then
      return l;
    end if;
  end if;

  insert into public.lineas_comanda (comanda_id, articulo_id, nombre, precio, iva, cantidad, notas, creado_por)
  values (p_comanda, p_articulo, a.nombre, a.precio, a.iva, p_cantidad, v_notas, auth.uid())
  returning * into l;
  return l;
end;
$$;

-- p_sabores: [{"sabor_id": 1, "porcentaje": 50}, ...] (de 1 a 4 sabores, suma 100)
create or replace function public.anadir_shisha(p_comanda bigint, p_articulo bigint, p_sabores jsonb, p_notas text default null)
returns public.lineas_comanda language plpgsql security definer set search_path = ''
as $$
declare
  a public.articulos;
  l public.lineas_comanda;
  n int;
  suma int;
begin
  perform private.exigir_personal();
  perform private.comanda_editable(p_comanda);

  select ar.* into a
  from public.articulos ar join public.categorias ca on ca.id = ar.categoria_id
  where ar.id = p_articulo and ar.activo and ca.activa and ca.es_shisha and not ar.es_cambio_carbon;
  if a.id is null then
    raise exception 'Esa shisha no está disponible';
  end if;

  if jsonb_typeof(p_sabores) <> 'array' then
    raise exception 'Sabores no válidos';
  end if;
  select count(*), coalesce(sum((e ->> 'porcentaje')::int), 0)
  into n, suma
  from jsonb_array_elements(p_sabores) e;

  if n < 1 or n > 4 then
    raise exception 'Elige entre 1 y 4 sabores';
  end if;
  if suma <> 100 then
    raise exception 'Los porcentajes deben sumar 100%% (ahora suman %)', suma || '%';
  end if;
  if exists (select 1 from jsonb_array_elements(p_sabores) e where (e ->> 'porcentaje')::int < 1) then
    raise exception 'Cada sabor debe tener al menos un 1%%';
  end if;
  if (select count(distinct (e ->> 'sabor_id')::bigint) from jsonb_array_elements(p_sabores) e) <> n then
    raise exception 'Hay sabores repetidos';
  end if;
  if (select count(*) from public.sabores s
      where s.activo and s.id in (select (e ->> 'sabor_id')::bigint from jsonb_array_elements(p_sabores) e)) <> n then
    raise exception 'Algún sabor no está disponible';
  end if;

  insert into public.lineas_comanda (comanda_id, articulo_id, nombre, precio, iva, cantidad, notas, es_shisha, creado_por)
  values (p_comanda, p_articulo, a.nombre, a.precio, a.iva, 1, nullif(trim(p_notas), ''), true, auth.uid())
  returning * into l;

  insert into public.lineas_shisha_sabores (linea_id, sabor_id, nombre, color, porcentaje, orden)
  select l.id, s.id, s.nombre, s.color, (e.valor ->> 'porcentaje')::int, e.ord
  from jsonb_array_elements(p_sabores) with ordinality as e(valor, ord)
  join public.sabores s on s.id = (e.valor ->> 'sabor_id')::bigint;

  return l;
end;
$$;

create or replace function public.cambio_carbon(p_linea_shisha bigint)
returns public.lineas_comanda language plpgsql security definer set search_path = ''
as $$
declare
  s public.lineas_comanda;
  a public.articulos;
  l public.lineas_comanda;
begin
  perform private.exigir_personal();
  select * into s from public.lineas_comanda where id = p_linea_shisha;
  if s.id is null or not s.es_shisha or s.anulada then
    raise exception 'La shisha no existe o está anulada';
  end if;
  perform private.comanda_editable(s.comanda_id);

  select * into a from public.articulos where es_cambio_carbon;
  if a.id is null then
    raise exception 'Falta el artículo «Cambio de carbón» en la carta';
  end if;

  insert into public.lineas_comanda (comanda_id, articulo_id, nombre, precio, iva, cantidad, linea_padre_id, merma, creado_por)
  values (s.comanda_id, a.id, a.nombre, a.precio, a.iva, 1, s.id, s.merma, auth.uid())
  returning * into l;

  -- Si la shisha es merma (p. ej. invitación), su cambio de carbón también
  if s.merma then
    insert into public.mermas (comanda_id, linea_id, motivo, nota, valor_carta, autorizada_por)
    select m.comanda_id, l.id, m.motivo, m.nota, l.precio, auth.uid()
    from public.mermas m where m.linea_id = s.id;
  end if;
  return l;
end;
$$;

-- Puede quitar unidades/anular: dueño o encargado siempre;
-- el empleado solo sus propias líneas durante los 5 primeros minutos.
create or replace function private.puede_corregir(l public.lineas_comanda)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.es_gestor()
      or (l.creado_por = auth.uid() and l.creado_en > now() - interval '5 minutes')
$$;

create or replace function public.cambiar_cantidad(p_linea bigint, p_cantidad int)
returns public.lineas_comanda language plpgsql security definer set search_path = ''
as $$
declare
  l public.lineas_comanda;
begin
  perform private.exigir_personal();
  select * into l from public.lineas_comanda where id = p_linea;
  if l.id is null or l.anulada then
    raise exception 'La línea no existe';
  end if;
  perform private.comanda_editable(l.comanda_id);
  if l.es_shisha or l.linea_padre_id is not null then
    raise exception 'La cantidad de una shisha o de un cambio de carbón no se cambia: añade otra o anúlala';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 99 then
    raise exception 'Cantidad no válida';
  end if;
  if p_cantidad < l.cantidad and not private.puede_corregir(l) then
    raise exception 'Solo el dueño o el encargado pueden quitar unidades pasados 5 minutos';
  end if;
  if l.merma then
    raise exception 'Quita primero la merma de esta línea';
  end if;

  update public.lineas_comanda set cantidad = p_cantidad where id = p_linea returning * into l;
  return l;
end;
$$;

create or replace function public.anular_linea(p_linea bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  l public.lineas_comanda;
begin
  perform private.exigir_personal();
  select * into l from public.lineas_comanda where id = p_linea;
  if l.id is null or l.anulada then
    raise exception 'La línea no existe o ya está anulada';
  end if;
  perform private.comanda_editable(l.comanda_id);
  if not private.puede_corregir(l) then
    raise exception 'Solo el dueño o el encargado pueden anular pasados 5 minutos';
  end if;

  -- Anular una línea quita también su merma y sus cambios de carbón
  delete from public.mermas where linea_id in (select id from public.lineas_comanda where id = p_linea or linea_padre_id = p_linea);
  update public.lineas_comanda
  set anulada = true, merma = false, anulada_por = auth.uid(), anulada_en = now()
  where (id = p_linea or linea_padre_id = p_linea) and not anulada;
end;
$$;

create or replace function public.pedir_cuenta(p_comanda bigint, p_pedida boolean)
returns public.comandas language plpgsql security definer set search_path = ''
as $$
declare
  c public.comandas;
begin
  perform private.exigir_personal();
  perform private.comanda_editable(p_comanda);
  update public.comandas
  set estado = case when p_pedida then 'cuenta'::public.estado_comanda else 'abierta'::public.estado_comanda end
  where id = p_comanda returning * into c;
  return c;
end;
$$;

create or replace function public.mover_comanda(p_comanda bigint, p_mesa_destino bigint)
returns public.comandas language plpgsql security definer set search_path = ''
as $$
declare
  c public.comandas;
begin
  perform private.exigir_personal();
  perform private.comanda_editable(p_comanda);
  if not exists (select 1 from public.mesas m join public.zonas z on z.id = m.zona_id
                 where m.id = p_mesa_destino and m.activa and z.activa) then
    raise exception 'La mesa de destino no existe o está desactivada';
  end if;
  begin
    update public.comandas set mesa_id = p_mesa_destino where id = p_comanda returning * into c;
  exception when unique_violation then
    raise exception 'La mesa de destino ya tiene una comanda abierta';
  end;
  return c;
end;
$$;

-- Cierra una comanda sin nada que cobrar (abierta por error)
create or replace function public.cerrar_comanda_vacia(p_comanda bigint)
returns public.comandas language plpgsql security definer set search_path = ''
as $$
declare
  c public.comandas;
begin
  perform private.exigir_personal();
  perform private.comanda_editable(p_comanda);
  if exists (select 1 from public.lineas_comanda where comanda_id = p_comanda and not anulada) then
    raise exception 'La comanda tiene consumiciones: cóbrala o pásala a merma';
  end if;
  update public.comandas
  set estado = 'cerrada', cierre = 'vacia', cerrada_por = auth.uid(), cerrada_en = now()
  where id = p_comanda returning * into c;
  return c;
end;
$$;

-- ---------------------------------------------------------------------
-- Merma (consumo que no se cobra: no admite importes cobrados)
-- ---------------------------------------------------------------------
create or replace function public.marcar_merma(p_linea bigint, p_motivo public.motivo_merma, p_nota text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  l public.lineas_comanda;
begin
  perform private.exigir_gestor();
  select * into l from public.lineas_comanda where id = p_linea;
  if l.id is null or l.anulada then
    raise exception 'La línea no existe o está anulada';
  end if;
  if l.merma then
    raise exception 'Esta línea ya es merma';
  end if;
  perform private.comanda_editable(l.comanda_id);

  -- Una shisha en merma arrastra sus cambios de carbón
  update public.lineas_comanda set merma = true
  where (id = p_linea or linea_padre_id = p_linea) and not anulada and not merma;

  insert into public.mermas (comanda_id, linea_id, motivo, nota, valor_carta, autorizada_por)
  select comanda_id, id, p_motivo, nullif(trim(p_nota), ''), precio * cantidad, auth.uid()
  from public.lineas_comanda
  where (id = p_linea or linea_padre_id = p_linea) and not anulada
  on conflict (linea_id) do nothing;
end;
$$;

create or replace function public.quitar_merma(p_linea bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  l public.lineas_comanda;
begin
  perform private.exigir_gestor();
  select * into l from public.lineas_comanda where id = p_linea;
  if l.id is null or not l.merma then
    raise exception 'Esta línea no es merma';
  end if;
  perform private.comanda_editable(l.comanda_id);

  delete from public.mermas where linea_id in (select id from public.lineas_comanda where id = p_linea or linea_padre_id = p_linea);
  update public.lineas_comanda set merma = false where id = p_linea or linea_padre_id = p_linea;
end;
$$;

-- Pasa a merma todo lo pendiente y cierra la comanda sin cobro ni ticket
create or replace function public.cerrar_como_merma(p_comanda bigint, p_motivo public.motivo_merma, p_nota text default null)
returns public.comandas language plpgsql security definer set search_path = ''
as $$
declare
  c public.comandas;
begin
  perform private.exigir_gestor();
  perform private.comanda_editable(p_comanda);
  if not exists (select 1 from public.lineas_comanda where comanda_id = p_comanda and not anulada) then
    raise exception 'La comanda está vacía';
  end if;

  insert into public.mermas (comanda_id, linea_id, motivo, nota, valor_carta, autorizada_por)
  select comanda_id, id, p_motivo, nullif(trim(p_nota), ''), precio * cantidad, auth.uid()
  from public.lineas_comanda
  where comanda_id = p_comanda and not anulada and not merma;

  update public.lineas_comanda set merma = true where comanda_id = p_comanda and not anulada;

  update public.comandas
  set estado = 'cerrada', cierre = 'merma', cerrada_por = auth.uid(), cerrada_en = now()
  where id = p_comanda returning * into c;
  return c;
end;
$$;

-- ---------------------------------------------------------------------
-- Cobro
-- p_pagos: [{"metodo": "efectivo", "importe": 20.5, "entregado": 50}, {"metodo": "tarjeta", "importe": 10}]
-- ---------------------------------------------------------------------
create or replace function public.cobrar_comanda(p_comanda bigint, p_pagos jsonb)
returns public.tickets language plpgsql security definer set search_path = ''
as $$
declare
  c public.comandas;
  caja public.cajas;
  v_total numeric(10, 2);
  v_suma numeric(10, 2);
  v_serie text := 'T' || to_char(now() at time zone 'Europe/Madrid', 'YYYY');
  v_numero int;
  v_mesa text;
  v_lineas jsonb;
  v_desglose jsonb;
  v_base numeric(10, 2);
  t public.tickets;
  p jsonb;
  v_importe numeric(10, 2);
  v_entregado numeric(10, 2);
begin
  perform private.exigir_personal();
  c := private.comanda_editable(p_comanda);

  caja := private.caja_abierta();
  if caja.id is null then
    raise exception 'No hay ninguna caja abierta. El dueño o el encargado tiene que abrirla.';
  end if;

  v_total := private.total_comanda(p_comanda);
  if v_total <= 0 then
    raise exception 'No hay nada que cobrar. Si todo es merma, ciérrala como merma.';
  end if;

  if jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'Indica cómo se paga';
  end if;

  v_suma := 0;
  for p in select * from jsonb_array_elements(p_pagos) loop
    if p ->> 'metodo' not in ('efectivo', 'tarjeta') then
      raise exception 'Método de pago no válido';
    end if;
    v_importe := (p ->> 'importe')::numeric(10, 2);
    if v_importe is null or v_importe <= 0 then
      raise exception 'Importe de pago no válido';
    end if;
    if p ->> 'metodo' = 'efectivo' and (p ->> 'entregado') is not null
       and (p ->> 'entregado')::numeric(10, 2) < v_importe then
      raise exception 'El efectivo entregado no llega al importe';
    end if;
    v_suma := v_suma + v_importe;
  end loop;

  if v_suma <> v_total then
    raise exception 'Los pagos suman % € y el total es % €', v_suma, v_total;
  end if;

  -- Texto de la mesa para el ticket
  select case z.tipo when 'terraza' then 'Terraza' else 'Sala' end || ' · Mesa ' || m.numero
  into v_mesa
  from public.mesas m join public.zonas z on z.id = m.zona_id where m.id = c.mesa_id;

  -- Detalle de lo cobrado
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', l.nombre,
           'cantidad', l.cantidad,
           'precio', l.precio,
           'importe', l.precio * l.cantidad,
           'iva', l.iva,
           'sabores', (select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'porcentaje', s.porcentaje) order by s.orden)
                       from public.lineas_shisha_sabores s where s.linea_id = l.id)
         ) order by l.id), '[]'::jsonb)
  into v_lineas
  from public.lineas_comanda l
  where l.comanda_id = p_comanda and not l.anulada and not l.merma;

  -- Desglose de IVA (precios con IVA incluido)
  select jsonb_agg(jsonb_build_object('iva', iva, 'base', base, 'cuota', total - base, 'total', total) order by iva),
         sum(base)
  into v_desglose, v_base
  from (
    select iva, sum(precio * cantidad) as total,
           round(sum(precio * cantidad) / (1 + iva / 100), 2) as base
    from public.lineas_comanda
    where comanda_id = p_comanda and not anulada and not merma
    group by iva
  ) d;

  -- Numeración correlativa sin huecos por serie
  perform pg_advisory_xact_lock(hashtext('anubis_tickets_' || v_serie));
  select coalesce(max(numero), 0) + 1 into v_numero from public.tickets where serie = v_serie;

  insert into public.tickets (serie, numero, comanda_id, caja_id, emitido_por, mesa_texto, lineas, desglose_iva, base, cuota_iva, total)
  values (v_serie, v_numero, p_comanda, caja.id, auth.uid(), v_mesa, v_lineas, v_desglose, v_base, v_total - v_base, v_total)
  returning * into t;

  for p in select * from jsonb_array_elements(p_pagos) loop
    v_importe := (p ->> 'importe')::numeric(10, 2);
    v_entregado := case when p ->> 'metodo' = 'efectivo'
                        then coalesce((p ->> 'entregado')::numeric(10, 2), v_importe) end;
    insert into public.pagos (comanda_id, ticket_id, caja_id, metodo, importe, entregado, cambio, cobrado_por)
    values (p_comanda, t.id, caja.id, (p ->> 'metodo')::public.metodo_pago, v_importe, v_entregado,
            coalesce(v_entregado - v_importe, 0), auth.uid());
  end loop;

  update public.comandas
  set estado = 'cerrada', cierre = 'pagada', cerrada_por = auth.uid(), cerrada_en = now()
  where id = p_comanda;

  return t;
end;
$$;

-- ---------------------------------------------------------------------
-- Caja
-- ---------------------------------------------------------------------
create or replace function public.abrir_caja(p_fondo numeric)
returns public.cajas language plpgsql security definer set search_path = ''
as $$
declare
  k public.cajas;
begin
  perform private.exigir_gestor();
  if p_fondo is null or p_fondo < 0 then
    raise exception 'Fondo inicial no válido';
  end if;
  begin
    insert into public.cajas (abierta_por, fondo_inicial) values (auth.uid(), p_fondo) returning * into k;
  exception when unique_violation then
    raise exception 'Ya hay una caja abierta';
  end;
  return k;
end;
$$;

create or replace function public.movimiento_caja(p_tipo public.tipo_mov_caja, p_importe numeric, p_motivo text)
returns public.movimientos_caja language plpgsql security definer set search_path = ''
as $$
declare
  k public.cajas;
  m public.movimientos_caja;
begin
  perform private.exigir_gestor();
  k := private.caja_abierta();
  if k.id is null then
    raise exception 'No hay ninguna caja abierta';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Indica el motivo';
  end if;
  insert into public.movimientos_caja (caja_id, tipo, importe, motivo, usuario_id)
  values (k.id, p_tipo, p_importe, trim(p_motivo), auth.uid()) returning * into m;
  return m;
end;
$$;

-- Resumen de una caja (la abierta si p_caja es null)
create or replace function public.resumen_caja(p_caja bigint default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  k public.cajas;
  v_efectivo numeric; v_tarjeta numeric; v_entradas numeric; v_salidas numeric;
  v_tickets int; v_mermas numeric; v_n_mermas int; v_abiertas int;
begin
  perform private.exigir_gestor();
  if p_caja is null then
    k := private.caja_abierta();
  else
    select * into k from public.cajas where id = p_caja;
  end if;
  if k.id is null then
    return null;
  end if;

  select coalesce(sum(importe) filter (where metodo = 'efectivo'), 0),
         coalesce(sum(importe) filter (where metodo = 'tarjeta'), 0)
  into v_efectivo, v_tarjeta from public.pagos where caja_id = k.id;

  select coalesce(sum(importe) filter (where tipo = 'entrada'), 0),
         coalesce(sum(importe) filter (where tipo = 'salida'), 0)
  into v_entradas, v_salidas from public.movimientos_caja where caja_id = k.id;

  select count(*) into v_tickets from public.tickets where caja_id = k.id;

  select coalesce(sum(valor_carta), 0), count(*) into v_mermas, v_n_mermas
  from public.mermas where creado_en >= k.abierta_en and creado_en <= coalesce(k.cerrada_en, now());

  select count(*) into v_abiertas from public.comandas where estado <> 'cerrada';

  return jsonb_build_object(
    'caja', to_jsonb(k),
    'efectivo', v_efectivo,
    'tarjeta', v_tarjeta,
    'entradas', v_entradas,
    'salidas', v_salidas,
    'efectivo_esperado', k.fondo_inicial + v_efectivo + v_entradas - v_salidas,
    'tickets', v_tickets,
    'total_ventas', v_efectivo + v_tarjeta,
    'mermas_valor_carta', v_mermas,
    'mermas_lineas', v_n_mermas,
    'comandas_abiertas', v_abiertas
  );
end;
$$;

create or replace function public.cerrar_caja(p_contado numeric, p_notas text default null)
returns public.cajas language plpgsql security definer set search_path = ''
as $$
declare
  k public.cajas;
  r jsonb;
begin
  perform private.exigir_gestor();
  k := private.caja_abierta();
  if k.id is null then
    raise exception 'No hay ninguna caja abierta';
  end if;
  if p_contado is null or p_contado < 0 then
    raise exception 'Indica el efectivo contado';
  end if;
  r := public.resumen_caja(k.id);
  update public.cajas
  set cerrada_por = auth.uid(), cerrada_en = now(),
      efectivo_esperado = (r ->> 'efectivo_esperado')::numeric,
      efectivo_contado = p_contado,
      notas = nullif(trim(p_notas), '')
  where id = k.id returning * into k;
  return k;
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
    'abrir_comanda(bigint)',
    'anadir_linea(bigint,bigint,int,text)',
    'anadir_shisha(bigint,bigint,jsonb,text)',
    'cambio_carbon(bigint)',
    'cambiar_cantidad(bigint,int)',
    'anular_linea(bigint)',
    'pedir_cuenta(bigint,boolean)',
    'mover_comanda(bigint,bigint)',
    'cerrar_comanda_vacia(bigint)',
    'marcar_merma(bigint,public.motivo_merma,text)',
    'quitar_merma(bigint)',
    'cerrar_como_merma(bigint,public.motivo_merma,text)',
    'cobrar_comanda(bigint,jsonb)',
    'abrir_caja(numeric)',
    'movimiento_caja(public.tipo_mov_caja,numeric,text)',
    'resumen_caja(bigint)',
    'cerrar_caja(numeric,text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
