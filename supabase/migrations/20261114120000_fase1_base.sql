-- =====================================================================
-- Anubis · Fase 1: usuarios y roles, zonas y mesas, carta y sabores
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum ('dueno', 'encargado', 'empleado');
create type public.tipo_zona   as enum ('interior', 'terraza');

-- ---------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------
create table public.usuarios (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 80),
  email      text,
  rol        public.rol_usuario not null default 'empleado',
  -- Un usuario nuevo no puede usar la app hasta que el dueño lo active
  activo     boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- Helpers de rol (security definer para no depender de RLS de usuarios)
create or replace function private.rol_actual()
returns public.rol_usuario
language sql stable security definer set search_path = ''
as $$
  select rol from public.usuarios where id = (select auth.uid()) and activo
$$;

create or replace function private.es_personal()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.rol_actual() is not null $$;

create or replace function private.es_gestor()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.rol_actual() in ('dueno', 'encargado'), false) $$;

create or replace function private.es_dueno()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.rol_actual() = 'dueno', false) $$;

grant execute on function private.rol_actual(), private.es_personal(),
  private.es_gestor(), private.es_dueno() to authenticated;

-- Al registrarse: se crea el perfil. El primer usuario del sistema es el dueño.
create or replace function private.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  hay_dueno boolean;
begin
  -- Evita que dos registros simultáneos se conviertan ambos en dueño
  perform pg_advisory_xact_lock(hashtext('anubis_primer_dueno'));
  select exists (select 1 from public.usuarios where rol = 'dueno') into hay_dueno;

  insert into public.usuarios (id, nombre, email, rol, activo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when hay_dueno then 'empleado'::public.rol_usuario else 'dueno'::public.rol_usuario end,
    not hay_dueno
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function private.crear_perfil_usuario();

-- Solo el dueño cambia rol/activo, y nunca puede quedarse el local sin dueño activo
create or replace function private.proteger_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.rol is distinct from old.rol or new.activo is distinct from old.activo
      or new.email is distinct from old.email or new.id is distinct from old.id)
     and not private.es_dueno() then
    raise exception 'Solo el dueño puede cambiar roles o activar usuarios';
  end if;

  if old.rol = 'dueno' and old.activo and (new.rol <> 'dueno' or not new.activo)
     and not exists (select 1 from public.usuarios
                     where rol = 'dueno' and activo and id <> old.id) then
    raise exception 'Debe quedar al menos un dueño activo';
  end if;
  return new;
end;
$$;

create trigger proteger_usuario
  before update on public.usuarios
  for each row execute function private.proteger_usuario();

alter table public.usuarios enable row level security;

create policy usuarios_select on public.usuarios for select to authenticated
  using (id = (select auth.uid()) or (select private.es_gestor()));

create policy usuarios_update on public.usuarios for update to authenticated
  using (id = (select auth.uid()) or (select private.es_dueno()))
  with check (id = (select auth.uid()) or (select private.es_dueno()));

-- No se borran perfiles: se desactivan (activo = false)

-- ---------------------------------------------------------------------
-- Zonas y mesas
-- ---------------------------------------------------------------------
create table public.zonas (
  id         bigint generated always as identity primary key,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 60),
  tipo       public.tipo_zona not null,
  orden      int not null default 0,
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table public.mesas (
  id         bigint generated always as identity primary key,
  zona_id    bigint not null references public.zonas (id) on delete restrict,
  -- El número de mesa es único en todo el local
  numero     int not null unique check (numero between 1 and 999),
  capacidad  int check (capacidad between 1 and 50),
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create index mesas_zona_idx on public.mesas (zona_id);

-- Crea N mesas en una zona a partir del siguiente número libre del local
create or replace function public.crear_mesas(p_zona_id bigint, p_cantidad int)
returns setof public.mesas
language plpgsql security invoker set search_path = ''
as $$
declare
  siguiente int;
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede crear mesas';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100 then
    raise exception 'La cantidad debe estar entre 1 y 100';
  end if;

  perform pg_advisory_xact_lock(hashtext('anubis_numeracion_mesas'));
  select coalesce(max(numero), 0) + 1 into siguiente from public.mesas;

  return query
    insert into public.mesas (zona_id, numero)
    select p_zona_id, siguiente + g
    from generate_series(0, p_cantidad - 1) as g
    returning *;
end;
$$;
revoke execute on function public.crear_mesas(bigint, int) from public, anon;
grant execute on function public.crear_mesas(bigint, int) to authenticated;

alter table public.zonas enable row level security;
alter table public.mesas enable row level security;

create policy zonas_select on public.zonas for select to authenticated
  using ((select private.es_personal()));
create policy zonas_insert on public.zonas for insert to authenticated
  with check ((select private.es_dueno()));
create policy zonas_update on public.zonas for update to authenticated
  using ((select private.es_dueno())) with check ((select private.es_dueno()));
create policy zonas_delete on public.zonas for delete to authenticated
  using ((select private.es_dueno()));

create policy mesas_select on public.mesas for select to authenticated
  using ((select private.es_personal()));
create policy mesas_insert on public.mesas for insert to authenticated
  with check ((select private.es_dueno()));
create policy mesas_update on public.mesas for update to authenticated
  using ((select private.es_dueno())) with check ((select private.es_dueno()));
create policy mesas_delete on public.mesas for delete to authenticated
  using ((select private.es_dueno()));

-- ---------------------------------------------------------------------
-- Carta: categorías, artículos y sabores de shisha
-- ---------------------------------------------------------------------
create table public.categorias (
  id         bigint generated always as identity primary key,
  nombre     text not null unique check (char_length(trim(nombre)) between 1 and 40),
  orden      int not null default 0,
  es_shisha  boolean not null default false,
  activa     boolean not null default true
);

create table public.articulos (
  id           bigint generated always as identity primary key,
  categoria_id bigint not null references public.categorias (id) on delete restrict,
  nombre       text not null check (char_length(trim(nombre)) between 1 and 80),
  descripcion  text check (char_length(descripcion) <= 300),
  precio       numeric(10, 2) not null check (precio >= 0),
  iva          numeric(4, 2) not null default 10 check (iva in (0, 4, 10, 21)),
  orden        int not null default 0,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create index articulos_categoria_idx on public.articulos (categoria_id);

create table public.sabores (
  id      bigint generated always as identity primary key,
  nombre  text not null check (char_length(trim(nombre)) between 1 and 60),
  marca   text check (char_length(marca) <= 60),
  -- Color con el que se pinta el sabor en el dibujo de la cazoleta
  color   text not null default '#8b5cf6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  activo  boolean not null default true,
  unique nulls not distinct (nombre, marca)
);

-- El encargado gestiona la carta, pero solo el dueño cambia precios e IVA
create or replace function private.proteger_precios()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.precio is distinct from old.precio or new.iva is distinct from old.iva)
     and not private.es_dueno() then
    raise exception 'Solo el dueño puede cambiar precios';
  end if;
  return new;
end;
$$;

create trigger proteger_precios
  before update on public.articulos
  for each row execute function private.proteger_precios();

alter table public.categorias enable row level security;
alter table public.articulos  enable row level security;
alter table public.sabores    enable row level security;

create policy categorias_select on public.categorias for select to authenticated
  using ((select private.es_personal()));
create policy categorias_write on public.categorias for all to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));

create policy articulos_select on public.articulos for select to authenticated
  using ((select private.es_personal()));
create policy articulos_write on public.articulos for all to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));

create policy sabores_select on public.sabores for select to authenticated
  using ((select private.es_personal()));
create policy sabores_write on public.sabores for all to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));

-- ---------------------------------------------------------------------
-- Permisos de la API (anon no ve nada)
-- ---------------------------------------------------------------------
revoke all on public.usuarios, public.zonas, public.mesas,
  public.categorias, public.articulos, public.sabores from anon;
grant select, update on public.usuarios to authenticated;
grant select, insert, update, delete on public.zonas, public.mesas,
  public.categorias, public.articulos, public.sabores to authenticated;

-- Tiempo real para el mapa de mesas
alter publication supabase_realtime add table public.zonas, public.mesas;

-- ---------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------
insert into public.categorias (nombre, orden, es_shisha) values
  ('Shisha', 1, true),
  ('Cocktails', 2, false),
  ('Refrescos', 3, false),
  ('Agua', 4, false),
  ('Combinados', 5, false),
  ('Batidos', 6, false),
  ('Smoothies', 7, false),
  ('Zumos', 8, false),
  ('Vinos', 9, false),
  ('Cervezas', 10, false);

insert into public.sabores (nombre, color) values
  ('Menta', '#22c55e'),
  ('Uva', '#7c3aed'),
  ('Limón', '#facc15'),
  ('Sandía', '#ef4444'),
  ('Melón', '#a3e635'),
  ('Arándano', '#3b82f6'),
  ('Melocotón', '#fb923c'),
  ('Doble manzana', '#84cc16'),
  ('Fresa', '#f43f5e'),
  ('Mango', '#f59e0b');
