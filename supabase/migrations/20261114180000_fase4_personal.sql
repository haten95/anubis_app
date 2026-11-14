-- =====================================================================
-- Anubis · Fase 4: turnos, funciones del día, tareas, fichaje y nóminas
--
-- Fichaje: registro de jornada obligatorio (art. 34.9 ET). El empleado
-- solo puede fichar entrada/salida; las correcciones las hace el dueño
-- dejando el motivo y quién lo cambió.
-- Nóminas: estimación para preparar los datos; el cálculo oficial lo
-- hace la gestoría.
-- =====================================================================

create type public.funcion_turno as enum ('barra', 'shishas', 'sala');
create type public.estado_nomina as enum ('pendiente', 'pagada');

-- ---------------------------------------------------------------------
-- Turnos (cuadrante)
-- ---------------------------------------------------------------------
create table public.turnos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  fecha       date not null,
  inicio      time not null,
  fin         time not null,           -- si fin <= inicio, el turno acaba al día siguiente
  funcion     public.funcion_turno,    -- barra, shishas o sala (opcional para encargados)
  notas       text check (char_length(notas) <= 200),
  creado_por  uuid references public.usuarios (id) default auth.uid(),
  creado_en   timestamptz not null default now()
);
create index turnos_fecha_idx on public.turnos (fecha);
create index turnos_usuario_fecha_idx on public.turnos (usuario_id, fecha);
create index turnos_creado_por_idx on public.turnos (creado_por);

-- ---------------------------------------------------------------------
-- Tareas del día
-- ---------------------------------------------------------------------
create table public.tareas (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  fecha         date not null,
  descripcion   text not null check (char_length(trim(descripcion)) between 1 and 200),
  hecha         boolean not null default false,
  hecha_en      timestamptz,
  asignada_por  uuid references public.usuarios (id) default auth.uid(),
  creado_en     timestamptz not null default now()
);
create index tareas_usuario_fecha_idx on public.tareas (usuario_id, fecha);
create index tareas_fecha_idx on public.tareas (fecha);
create index tareas_asignada_por_idx on public.tareas (asignada_por);

-- ---------------------------------------------------------------------
-- Fichajes (registro de jornada)
-- ---------------------------------------------------------------------
create table public.fichajes (
  id              bigint generated always as identity primary key,
  usuario_id      uuid not null references public.usuarios (id) on delete cascade,
  entrada         timestamptz not null default now(),
  salida          timestamptz check (salida is null or salida > entrada),
  editado_por     uuid references public.usuarios (id),
  editado_en      timestamptz,
  motivo_edicion  text check (char_length(motivo_edicion) <= 200)
);
-- Solo una jornada abierta por persona
create unique index fichajes_uno_abierto on public.fichajes (usuario_id) where salida is null;
create index fichajes_usuario_entrada_idx on public.fichajes (usuario_id, entrada desc);
create index fichajes_entrada_idx on public.fichajes (entrada desc);
create index fichajes_editado_por_idx on public.fichajes (editado_por);

-- ---------------------------------------------------------------------
-- Datos laborales y nóminas (solo dueño; cada uno ve los suyos)
-- ---------------------------------------------------------------------
create table public.datos_laborales (
  usuario_id              uuid primary key references public.usuarios (id) on delete cascade,
  tipo_contrato           text check (char_length(tipo_contrato) <= 60),
  horas_semanales         numeric(5, 2) check (horas_semanales between 0 and 60),
  salario_base_mensual    numeric(10, 2) check (salario_base_mensual >= 0),  -- si es fijo
  precio_hora             numeric(8, 2) check (precio_hora >= 0),             -- si cobra por horas
  irpf_pct                numeric(5, 2) not null default 2 check (irpf_pct between 0 and 50),
  seguridad_social_pct    numeric(5, 2) not null default 6.48 check (seguridad_social_pct between 0 and 20),
  actualizado_en          timestamptz not null default now()
);

create table public.nominas (
  id                  bigint generated always as identity primary key,
  usuario_id          uuid not null references public.usuarios (id) on delete cascade,
  mes                 date not null check (extract(day from mes) = 1),
  horas               numeric(7, 2) not null default 0,
  bruto               numeric(10, 2) not null default 0 check (bruto >= 0),
  irpf                numeric(10, 2) not null default 0 check (irpf >= 0),
  seguridad_social    numeric(10, 2) not null default 0 check (seguridad_social >= 0),
  otras_deducciones   numeric(10, 2) not null default 0 check (otras_deducciones >= 0),
  neto                numeric(10, 2) generated always as (bruto - irpf - seguridad_social - otras_deducciones) stored,
  estado              public.estado_nomina not null default 'pendiente',
  pagada_en           timestamptz,
  notas               text check (char_length(notas) <= 300),
  unique (usuario_id, mes)
);
create index nominas_mes_idx on public.nominas (mes);

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.turnos          enable row level security;
alter table public.tareas          enable row level security;
alter table public.fichajes        enable row level security;
alter table public.datos_laborales enable row level security;
alter table public.nominas         enable row level security;

-- Turnos: el empleado ve los suyos; dueño y encargado ven y gestionan todos
create policy turnos_select on public.turnos for select to authenticated
  using ((select private.es_personal()) and (usuario_id = (select auth.uid()) or (select private.es_gestor())));
create policy turnos_insert on public.turnos for insert to authenticated with check ((select private.es_gestor()));
create policy turnos_update on public.turnos for update to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));
create policy turnos_delete on public.turnos for delete to authenticated using ((select private.es_gestor()));

-- Tareas: igual; el empleado las marca como hechas con marcar_tarea()
create policy tareas_select on public.tareas for select to authenticated
  using ((select private.es_personal()) and (usuario_id = (select auth.uid()) or (select private.es_gestor())));
create policy tareas_insert on public.tareas for insert to authenticated with check ((select private.es_gestor()));
create policy tareas_update on public.tareas for update to authenticated
  using ((select private.es_gestor())) with check ((select private.es_gestor()));
create policy tareas_delete on public.tareas for delete to authenticated using ((select private.es_gestor()));

-- Fichajes: lectura propia o de gestor; escritura solo por funciones
create policy fichajes_select on public.fichajes for select to authenticated
  using ((select private.es_personal()) and (usuario_id = (select auth.uid()) or (select private.es_gestor())));

-- Datos laborales y nóminas: el dueño todo; cada uno ve lo suyo
create policy datos_laborales_select on public.datos_laborales for select to authenticated
  using ((select private.es_personal()) and (usuario_id = (select auth.uid()) or (select private.es_dueno())));
create policy datos_laborales_insert on public.datos_laborales for insert to authenticated with check ((select private.es_dueno()));
create policy datos_laborales_update on public.datos_laborales for update to authenticated
  using ((select private.es_dueno())) with check ((select private.es_dueno()));
create policy datos_laborales_delete on public.datos_laborales for delete to authenticated using ((select private.es_dueno()));

create policy nominas_select on public.nominas for select to authenticated
  using ((select private.es_personal()) and (usuario_id = (select auth.uid()) or (select private.es_dueno())));
create policy nominas_update on public.nominas for update to authenticated
  using ((select private.es_dueno()) and estado = 'pendiente') with check ((select private.es_dueno()));
create policy nominas_delete on public.nominas for delete to authenticated
  using ((select private.es_dueno()) and estado = 'pendiente');

revoke all on public.turnos, public.tareas, public.fichajes, public.datos_laborales, public.nominas from anon, authenticated;
grant select, insert, update, delete on public.turnos, public.tareas, public.datos_laborales to authenticated;
grant select on public.fichajes to authenticated;
grant select, delete on public.nominas to authenticated;
grant update (horas, bruto, irpf, seguridad_social, otras_deducciones, notas) on public.nominas to authenticated;

alter publication supabase_realtime add table public.fichajes, public.tareas;

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------

-- Fichar: abre la jornada si no hay una abierta; si la hay, la cierra
create or replace function public.fichar()
returns public.fichajes language plpgsql security definer set search_path = ''
as $$
declare
  f public.fichajes;
begin
  perform private.exigir_personal();
  update public.fichajes set salida = now()
  where usuario_id = auth.uid() and salida is null
  returning * into f;
  if f.id is null then
    insert into public.fichajes (usuario_id) values (auth.uid()) returning * into f;
  end if;
  return f;
end;
$$;

-- Corrección de un fichaje por el dueño (queda registrado quién y por qué)
create or replace function public.corregir_fichaje(p_fichaje bigint, p_entrada timestamptz, p_salida timestamptz, p_motivo text)
returns public.fichajes language plpgsql security definer set search_path = ''
as $$
declare
  f public.fichajes;
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede corregir fichajes' using errcode = '42501';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Indica el motivo de la corrección';
  end if;
  if p_entrada is null or (p_salida is not null and p_salida <= p_entrada) then
    raise exception 'La salida debe ser posterior a la entrada';
  end if;
  update public.fichajes
  set entrada = p_entrada, salida = p_salida, editado_por = auth.uid(), editado_en = now(), motivo_edicion = trim(p_motivo)
  where id = p_fichaje
  returning * into f;
  if f.id is null then
    raise exception 'El fichaje no existe';
  end if;
  return f;
end;
$$;

-- El empleado marca sus propias tareas (y el gestor cualquiera)
create or replace function public.marcar_tarea(p_tarea bigint, p_hecha boolean)
returns public.tareas language plpgsql security definer set search_path = ''
as $$
declare
  t public.tareas;
begin
  perform private.exigir_personal();
  update public.tareas
  set hecha = p_hecha, hecha_en = case when p_hecha then now() end
  where id = p_tarea and (usuario_id = auth.uid() or private.es_gestor())
  returning * into t;
  if t.id is null then
    raise exception 'La tarea no existe o no es tuya';
  end if;
  return t;
end;
$$;

-- Horas trabajadas (fichadas) por una persona en un intervalo
create or replace function private.horas_fichadas(p_usuario uuid, p_desde timestamptz, p_hasta timestamptz)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(round(sum(extract(epoch from (least(coalesce(salida, now()), p_hasta) - greatest(entrada, p_desde)))) / 3600.0, 2), 0)
  from public.fichajes
  where usuario_id = p_usuario and entrada < p_hasta and coalesce(salida, now()) > p_desde
$$;

-- Genera (o recalcula las pendientes) las nóminas de un mes para quien tenga datos laborales
-- Bruto = salario fijo si lo tiene; si no, horas fichadas × precio/hora.
create or replace function public.generar_nominas(p_mes date)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_desde timestamptz := (v_mes::timestamp at time zone 'Europe/Madrid');
  v_hasta timestamptz := ((v_mes + interval '1 month')::timestamp at time zone 'Europe/Madrid');
  d record;
  v_horas numeric;
  v_bruto numeric;
  n int := 0;
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede generar nóminas' using errcode = '42501';
  end if;

  for d in
    select dl.* from public.datos_laborales dl
    join public.usuarios u on u.id = dl.usuario_id
    where u.activo
  loop
    v_horas := private.horas_fichadas(d.usuario_id, v_desde, v_hasta);
    v_bruto := round(coalesce(d.salario_base_mensual, v_horas * coalesce(d.precio_hora, 0)), 2);

    insert into public.nominas (usuario_id, mes, horas, bruto, irpf, seguridad_social)
    values (d.usuario_id, v_mes, v_horas, v_bruto,
            round(v_bruto * d.irpf_pct / 100, 2), round(v_bruto * d.seguridad_social_pct / 100, 2))
    on conflict (usuario_id, mes) do update
      set horas = excluded.horas, bruto = excluded.bruto, irpf = excluded.irpf, seguridad_social = excluded.seguridad_social
      where public.nominas.estado = 'pendiente';
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.pagar_nomina(p_nomina bigint, p_pagada boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede marcar nóminas' using errcode = '42501';
  end if;
  update public.nominas
  set estado = case when p_pagada then 'pagada'::public.estado_nomina else 'pendiente'::public.estado_nomina end,
      pagada_en = case when p_pagada then now() end
  where id = p_nomina;
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
    'fichar()',
    'corregir_fichaje(bigint,timestamptz,timestamptz,text)',
    'marcar_tarea(bigint,boolean)',
    'generar_nominas(date)',
    'pagar_nomina(bigint,boolean)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
