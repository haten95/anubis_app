-- =====================================================================
-- La numeración de mesas es acumulativa por tipo de zona:
-- las salas interiores entre sí y las terrazas entre sí.
-- (Sala: 1..10 · Terraza 1: 1..5 · Terraza 2: 6..8 …)
-- =====================================================================

alter table public.mesas add column tipo public.tipo_zona;
update public.mesas m set tipo = z.tipo from public.zonas z where z.id = m.zona_id;
alter table public.mesas alter column tipo set not null;

alter table public.mesas drop constraint mesas_numero_key;

-- Renumera las mesas existentes por tipo (solo afecta a datos de prueba: aún no hay comandas)
update public.mesas m
set numero = r.nuevo
from (
  select id, row_number() over (partition by tipo order by numero) as nuevo
  from public.mesas
) r
where r.id = m.id;

alter table public.mesas add constraint mesas_tipo_numero_key unique (tipo, numero);

-- El tipo de la mesa siempre es el de su zona (no se puede fijar a mano)
create or replace function private.mesa_tipo_desde_zona()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select tipo into new.tipo from public.zonas where id = new.zona_id;
  return new;
end;
$$;

create trigger mesa_tipo_desde_zona
  before insert or update on public.mesas
  for each row execute function private.mesa_tipo_desde_zona();

-- Si una zona cambia de tipo, sus mesas también
create or replace function private.zona_propaga_tipo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.mesas set zona_id = zona_id where zona_id = new.id;
  return new;
end;
$$;

create trigger zona_propaga_tipo
  after update of tipo on public.zonas
  for each row execute function private.zona_propaga_tipo();

-- Crear mesas: siguiente número libre dentro del tipo de la zona
create or replace function public.crear_mesas(p_zona_id bigint, p_cantidad int)
returns setof public.mesas
language plpgsql security invoker set search_path = ''
as $$
declare
  v_tipo public.tipo_zona;
  siguiente int;
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede crear mesas';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100 then
    raise exception 'La cantidad debe estar entre 1 y 100';
  end if;

  select tipo into v_tipo from public.zonas where id = p_zona_id;
  if v_tipo is null then
    raise exception 'La zona no existe';
  end if;

  perform pg_advisory_xact_lock(hashtext('anubis_numeracion_mesas_' || v_tipo::text));
  select coalesce(max(numero), 0) + 1 into siguiente from public.mesas where tipo = v_tipo;

  return query
    insert into public.mesas (zona_id, numero)
    select p_zona_id, siguiente + g
    from generate_series(0, p_cantidad - 1) as g
    returning *;
end;
$$;
