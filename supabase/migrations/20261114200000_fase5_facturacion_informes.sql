-- =====================================================================
-- Anubis · Fase 5: facturación e informes
--
-- · Factura completa (F3) en sustitución de un ticket simplificado.
-- · Rectificativa (R5) que anula un ticket y devuelve el dinero.
-- · Registro de facturación con huella SHA-256 encadenada (base para
--   Verifactu): cada ticket, factura y rectificativa genera un registro
--   inalterable que incluye la huella del anterior.
-- · Informe de ventas (solo dueño). El "día de negocio" va de 06:00 a 06:00
--   para que lo cobrado de madrugada cuente en la noche anterior.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Facturas completas y rectificativas
-- ---------------------------------------------------------------------
create table public.facturas (
  id                 bigint generated always as identity primary key,
  serie              text not null,
  numero             int not null,
  ticket_id          bigint not null unique references public.tickets (id),
  emitida_en         timestamptz not null default now(),
  emitida_por        uuid not null references public.usuarios (id),
  cliente_nombre     text not null check (char_length(trim(cliente_nombre)) between 1 and 120),
  cliente_nif        text not null check (char_length(trim(cliente_nif)) between 5 and 20),
  cliente_direccion  text not null check (char_length(trim(cliente_direccion)) between 1 and 200),
  base               numeric(10, 2) not null,
  cuota_iva          numeric(10, 2) not null,
  total              numeric(10, 2) not null,
  desglose_iva       jsonb not null,
  unique (serie, numero)
);
create index facturas_emitida_por_idx on public.facturas (emitida_por);
create index facturas_emitida_en_idx on public.facturas (emitida_en);

create table public.rectificativas (
  id                 bigint generated always as identity primary key,
  serie              text not null,
  numero             int not null,
  ticket_id          bigint not null unique references public.tickets (id),
  motivo             text not null check (char_length(trim(motivo)) between 1 and 200),
  metodo_devolucion  public.metodo_pago not null,
  caja_id            bigint not null references public.cajas (id),
  emitida_en         timestamptz not null default now(),
  emitida_por        uuid not null references public.usuarios (id),
  base               numeric(10, 2) not null check (base <= 0),
  cuota_iva          numeric(10, 2) not null check (cuota_iva <= 0),
  total              numeric(10, 2) not null check (total < 0),
  desglose_iva       jsonb not null,
  unique (serie, numero)
);
create index rectificativas_caja_idx on public.rectificativas (caja_id);
create index rectificativas_emitida_por_idx on public.rectificativas (emitida_por);
create index rectificativas_emitida_en_idx on public.rectificativas (emitida_en);

-- ---------------------------------------------------------------------
-- Registro de facturación encadenado
-- ---------------------------------------------------------------------
create table public.registros_facturacion (
  id                 bigint generated always as identity primary key,
  tipo               text not null check (tipo in ('F2', 'F3', 'R5')),  -- simplificada, sustitutiva, rectificativa de simplificada
  num_serie          text not null unique,
  nif_emisor         text not null,
  fecha_expedicion   date not null,
  cuota_total        numeric(10, 2) not null,
  importe_total      numeric(10, 2) not null,
  huella_anterior    text,
  fecha_hora_huso    text not null,
  huella             text not null,
  ticket_id          bigint references public.tickets (id),
  factura_id         bigint references public.facturas (id),
  rectificativa_id   bigint references public.rectificativas (id),
  creado_en          timestamptz not null default now()
);
create index registros_ticket_idx on public.registros_facturacion (ticket_id);
create index registros_factura_idx on public.registros_facturacion (factura_id);
create index registros_rectificativa_idx on public.registros_facturacion (rectificativa_id);

-- Cadena canónica sobre la que se calcula la huella (formato de Verifactu)
create or replace function private.cadena_huella(
  p_nif text, p_num_serie text, p_fecha date, p_tipo text, p_cuota numeric, p_total numeric, p_anterior text, p_fecha_hora text
)
returns text language sql immutable set search_path = ''
as $$
  select 'IDEmisorFactura=' || p_nif
      || '&NumSerieFactura=' || p_num_serie
      || '&FechaExpedicionFactura=' || to_char(p_fecha, 'DD-MM-YYYY')
      || '&TipoFactura=' || p_tipo
      || '&CuotaTotal=' || trim(to_char(p_cuota, 'FM999999990.00'))
      || '&ImporteTotal=' || trim(to_char(p_total, 'FM999999990.00'))
      || '&Huella=' || coalesce(p_anterior, '')
      || '&FechaHoraHusoGenRegistro=' || p_fecha_hora
$$;

create or replace function private.huella(p_cadena text)
returns text language sql immutable set search_path = ''
as $$ select upper(encode(sha256(convert_to(p_cadena, 'UTF8')), 'hex')) $$;

create or replace function private.registrar_factura(
  p_tipo text, p_num_serie text, p_fecha timestamptz, p_cuota numeric, p_total numeric,
  p_ticket bigint, p_factura bigint, p_rectificativa bigint
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_nif text;
  v_anterior text;
  v_fecha_hora text;
  v_zona text := current_setting('timezone');
  v_fecha date;
begin
  perform pg_advisory_xact_lock(hashtext('anubis_registro_facturacion'));
  select coalesce(nullif(trim(nif), ''), 'SIN-NIF') into v_nif from public.ajustes_local limit 1;
  select huella into v_anterior from public.registros_facturacion order by id desc limit 1;

  perform set_config('timezone', 'Europe/Madrid', true);
  v_fecha_hora := to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS') || to_char(clock_timestamp(), 'TZH:TZM');
  v_fecha := p_fecha::date;
  perform set_config('timezone', v_zona, true);

  insert into public.registros_facturacion
    (tipo, num_serie, nif_emisor, fecha_expedicion, cuota_total, importe_total, huella_anterior, fecha_hora_huso, huella,
     ticket_id, factura_id, rectificativa_id)
  values
    (p_tipo, p_num_serie, coalesce(v_nif, 'SIN-NIF'), v_fecha, p_cuota, p_total, v_anterior, v_fecha_hora,
     private.huella(private.cadena_huella(coalesce(v_nif, 'SIN-NIF'), p_num_serie, v_fecha, p_tipo, p_cuota, p_total, v_anterior, v_fecha_hora)),
     p_ticket, p_factura, p_rectificativa);
end;
$$;

create or replace function private.registrar_ticket() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar_factura('F2', new.serie || '-' || new.numero, new.emitido_en, new.cuota_iva, new.total, new.id, null, null);
  return new;
end; $$;

create or replace function private.registrar_factura_completa() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar_factura('F3', new.serie || '-' || new.numero, new.emitida_en, new.cuota_iva, new.total, null, new.id, null);
  return new;
end; $$;

create or replace function private.registrar_rectificativa() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.registrar_factura('R5', new.serie || '-' || new.numero, new.emitida_en, new.cuota_iva, new.total, null, null, new.id);
  return new;
end; $$;

create trigger registrar_ticket after insert on public.tickets for each row execute function private.registrar_ticket();
create trigger registrar_factura after insert on public.facturas for each row execute function private.registrar_factura_completa();
create trigger registrar_rectificativa after insert on public.rectificativas for each row execute function private.registrar_rectificativa();

-- Lo emitido no se puede modificar ni borrar
create or replace function private.impedir_cambios()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Los documentos de facturación no se pueden modificar ni borrar. Usa una factura rectificativa.';
end;
$$;

create trigger tickets_inalterables before update or delete on public.tickets for each row execute function private.impedir_cambios();
create trigger facturas_inalterables before update or delete on public.facturas for each row execute function private.impedir_cambios();
create trigger rectificativas_inalterables before update or delete on public.rectificativas for each row execute function private.impedir_cambios();
create trigger registros_inalterables before update or delete on public.registros_facturacion for each row execute function private.impedir_cambios();

-- Comprueba la cadena completa: recalcula cada huella y su enlace con la anterior
create or replace function public.verificar_registro_facturacion()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  r record;
  v_anterior text := null;
  v_total int := 0;
  v_mal int := 0;
  v_primero_mal text := null;
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede verificar el registro' using errcode = '42501';
  end if;
  for r in select * from public.registros_facturacion order by id loop
    v_total := v_total + 1;
    if r.huella_anterior is distinct from v_anterior
       or r.huella <> private.huella(private.cadena_huella(r.nif_emisor, r.num_serie, r.fecha_expedicion, r.tipo,
                                                           r.cuota_total, r.importe_total, r.huella_anterior, r.fecha_hora_huso)) then
      v_mal := v_mal + 1;
      v_primero_mal := coalesce(v_primero_mal, r.num_serie);
    end if;
    v_anterior := r.huella;
  end loop;
  return jsonb_build_object('registros', v_total, 'erroneos', v_mal, 'primero_erroneo', v_primero_mal, 'ultima_huella', v_anterior);
end;
$$;

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.facturas              enable row level security;
alter table public.rectificativas        enable row level security;
alter table public.registros_facturacion enable row level security;

create policy facturas_select on public.facturas for select to authenticated using ((select private.es_gestor()));
create policy rectificativas_select on public.rectificativas for select to authenticated using ((select private.es_gestor()));
create policy registros_select on public.registros_facturacion for select to authenticated using ((select private.es_dueno()));

revoke all on public.facturas, public.rectificativas, public.registros_facturacion from anon, authenticated;
grant select on public.facturas, public.rectificativas, public.registros_facturacion to authenticated;

-- ---------------------------------------------------------------------
-- Emitir factura completa a partir de un ticket
-- ---------------------------------------------------------------------
create or replace function public.emitir_factura(p_ticket bigint, p_nombre text, p_nif text, p_direccion text)
returns public.facturas language plpgsql security definer set search_path = ''
as $$
declare
  t public.tickets;
  f public.facturas;
  v_serie text := 'F' || to_char(now() at time zone 'Europe/Madrid', 'YYYY');
  v_numero int;
begin
  perform private.exigir_gestor();
  select * into t from public.tickets where id = p_ticket;
  if t.id is null then
    raise exception 'El ticket no existe';
  end if;
  if exists (select 1 from public.rectificativas where ticket_id = p_ticket) then
    raise exception 'Este ticket está anulado con una rectificativa';
  end if;
  if exists (select 1 from public.facturas where ticket_id = p_ticket) then
    raise exception 'Este ticket ya tiene factura';
  end if;
  if nullif(trim(p_nombre), '') is null or nullif(trim(p_nif), '') is null or nullif(trim(p_direccion), '') is null then
    raise exception 'Faltan los datos del cliente (nombre, NIF y dirección)';
  end if;

  perform pg_advisory_xact_lock(hashtext('anubis_facturas_' || v_serie));
  select coalesce(max(numero), 0) + 1 into v_numero from public.facturas where serie = v_serie;

  insert into public.facturas (serie, numero, ticket_id, emitida_por, cliente_nombre, cliente_nif, cliente_direccion, base, cuota_iva, total, desglose_iva)
  values (v_serie, v_numero, t.id, auth.uid(), trim(p_nombre), upper(trim(p_nif)), trim(p_direccion), t.base, t.cuota_iva, t.total, t.desglose_iva)
  returning * into f;
  return f;
end;
$$;

-- ---------------------------------------------------------------------
-- Rectificativa: anula un ticket entero y registra la devolución en la caja abierta
-- ---------------------------------------------------------------------
create or replace function public.rectificar_ticket(p_ticket bigint, p_motivo text, p_metodo public.metodo_pago)
returns public.rectificativas language plpgsql security definer set search_path = ''
as $$
declare
  t public.tickets;
  k public.cajas;
  r public.rectificativas;
  v_serie text := 'R' || to_char(now() at time zone 'Europe/Madrid', 'YYYY');
  v_numero int;
begin
  perform private.exigir_gestor();
  select * into t from public.tickets where id = p_ticket;
  if t.id is null then
    raise exception 'El ticket no existe';
  end if;
  if exists (select 1 from public.rectificativas where ticket_id = p_ticket) then
    raise exception 'Este ticket ya está anulado';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Indica el motivo de la anulación';
  end if;
  k := private.caja_abierta();
  if k.id is null then
    raise exception 'Abre la caja para poder devolver el dinero';
  end if;

  perform pg_advisory_xact_lock(hashtext('anubis_rectificativas_' || v_serie));
  select coalesce(max(numero), 0) + 1 into v_numero from public.rectificativas where serie = v_serie;

  insert into public.rectificativas (serie, numero, ticket_id, motivo, metodo_devolucion, caja_id, emitida_por, base, cuota_iva, total, desglose_iva)
  values (
    v_serie, v_numero, t.id, trim(p_motivo), p_metodo, k.id, auth.uid(), -t.base, -t.cuota_iva, -t.total,
    (select jsonb_agg(jsonb_build_object('iva', d -> 'iva', 'base', -(d ->> 'base')::numeric, 'cuota', -(d ->> 'cuota')::numeric, 'total', -(d ->> 'total')::numeric))
     from jsonb_array_elements(t.desglose_iva) d)
  )
  returning * into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- Caja: el resumen descuenta las devoluciones
-- ---------------------------------------------------------------------
create or replace function public.resumen_caja(p_caja bigint default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  k public.cajas;
  v_efectivo numeric; v_tarjeta numeric; v_entradas numeric; v_salidas numeric;
  v_dev_efectivo numeric; v_dev_tarjeta numeric;
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

  select coalesce(-sum(total) filter (where metodo_devolucion = 'efectivo'), 0),
         coalesce(-sum(total) filter (where metodo_devolucion = 'tarjeta'), 0)
  into v_dev_efectivo, v_dev_tarjeta from public.rectificativas where caja_id = k.id;

  select coalesce(sum(importe) filter (where tipo = 'entrada'), 0),
         coalesce(sum(importe) filter (where tipo = 'salida'), 0)
  into v_entradas, v_salidas from public.movimientos_caja where caja_id = k.id;

  select count(*) into v_tickets from public.tickets where caja_id = k.id;

  select coalesce(sum(valor_carta), 0), count(*) into v_mermas, v_n_mermas
  from public.mermas where creado_en >= k.abierta_en and creado_en <= coalesce(k.cerrada_en, now());

  select count(*) into v_abiertas from public.comandas where estado <> 'cerrada';

  return jsonb_build_object(
    'caja', to_jsonb(k),
    'efectivo', v_efectivo - v_dev_efectivo,
    'tarjeta', v_tarjeta - v_dev_tarjeta,
    'devoluciones', v_dev_efectivo + v_dev_tarjeta,
    'entradas', v_entradas,
    'salidas', v_salidas,
    'efectivo_esperado', k.fondo_inicial + v_efectivo - v_dev_efectivo + v_entradas - v_salidas,
    'tickets', v_tickets,
    'total_ventas', v_efectivo + v_tarjeta - v_dev_efectivo - v_dev_tarjeta,
    'mermas_valor_carta', v_mermas,
    'mermas_lineas', v_n_mermas,
    'comandas_abiertas', v_abiertas
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Informe de ventas (solo dueño)
-- ---------------------------------------------------------------------
create or replace function private.dia_negocio(p timestamptz)
returns date language sql immutable set search_path = ''
as $$ select ((p at time zone 'Europe/Madrid') - interval '6 hours')::date $$;

create or replace function public.informe_ventas(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede ver los informes' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 400 then
    raise exception 'Rango de fechas no válido (máximo 400 días)';
  end if;

  with
  t as (  -- tickets válidos (no anulados) del periodo
    select tk.* from public.tickets tk
    where private.dia_negocio(tk.emitido_en) between p_desde and p_hasta
      and not exists (select 1 from public.rectificativas r where r.ticket_id = tk.id)
  ),
  rect as (
    select r.* from public.rectificativas r where private.dia_negocio(r.emitida_en) between p_desde and p_hasta
  ),
  lin as (  -- líneas cobradas de esos tickets
    select l.*, a.categoria_id from public.lineas_comanda l
    join t on t.comanda_id = l.comanda_id
    join public.articulos a on a.id = l.articulo_id
    where not l.anulada and not l.merma
  ),
  coste as (
    select coalesce(sum(-m.cantidad * coalesce(m.coste_unitario, 0)), 0) as total
    from public.movimientos_stock m join t on t.comanda_id = m.comanda_id
    where m.tipo = 'venta'
  ),
  mer as (
    select coalesce(sum(valor_carta), 0) as valor, coalesce(sum(coste), 0) as coste, count(*) as lineas
    from public.mermas where private.dia_negocio(creado_en) between p_desde and p_hasta
  ),
  pag as (
    select p.metodo, sum(p.importe) as importe from public.pagos p join t on t.id = p.ticket_id group by p.metodo
  )
  select jsonb_build_object(
    'resumen', jsonb_build_object(
      'ventas', (select coalesce(sum(total), 0) from t),
      'base', (select coalesce(sum(base), 0) from t),
      'iva', (select coalesce(sum(cuota_iva), 0) from t),
      'tickets', (select count(*) from t),
      'ticket_medio', (select coalesce(round(avg(total), 2), 0) from t),
      'anulaciones', (select count(*) from rect),
      'importe_anulado', (select coalesce(-sum(total), 0) from rect),
      'efectivo', (select coalesce(sum(importe), 0) from pag where metodo = 'efectivo'),
      'tarjeta', (select coalesce(sum(importe), 0) from pag where metodo = 'tarjeta'),
      'coste', (select round(total, 2) from coste),
      'mermas_valor', (select valor from mer),
      'mermas_coste', (select coste from mer),
      'mermas_lineas', (select lineas from mer),
      'shishas', (select coalesce(sum(cantidad), 0) from lin where es_shisha)
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'ventas', coalesce(x.ventas, 0), 'tickets', coalesce(x.n, 0)) order by d), '[]')
      from generate_series(p_desde, p_hasta, interval '1 day') g(d)
      left join (select private.dia_negocio(emitido_en) as dia, sum(total) as ventas, count(*) as n from t group by 1) x on x.dia = g.d::date
    ),
    'por_hora', (
      select coalesce(jsonb_agg(jsonb_build_object('hora', h, 'ventas', coalesce(x.ventas, 0), 'tickets', coalesce(x.n, 0)) order by h), '[]')
      from generate_series(0, 23) h
      left join (select extract(hour from emitido_en at time zone 'Europe/Madrid')::int as hora, sum(total) as ventas, count(*) as n from t group by 1) x on x.hora = h
    ),
    'productos', (
      select coalesce(jsonb_agg(x.fila order by x.importe desc), '[]') from (
        select jsonb_build_object('nombre', nombre, 'unidades', sum(cantidad), 'importe', sum(precio * cantidad)) as fila, sum(precio * cantidad) as importe
        from lin group by nombre
      ) x
    ),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', c.nombre, 'unidades', x.u, 'importe', x.i) order by x.i desc), '[]')
      from (select categoria_id, sum(cantidad) as u, sum(precio * cantidad) as i from lin group by categoria_id) x
      join public.categorias c on c.id = x.categoria_id
    ),
    'personal', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', u.nombre, 'tickets', x.n, 'ventas', x.v) order by x.v desc), '[]')
      from (select emitido_por, count(*) as n, sum(total) as v from t group by emitido_por) x
      join public.usuarios u on u.id = x.emitido_por
    ),
    'sabores', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', x.nombre, 'color', x.color, 'shishas', x.n, 'cargas', x.cargas) order by x.cargas desc), '[]')
      from (
        select s.nombre, max(s.color) as color, count(*) as n, round(sum(s.porcentaje) / 100.0, 2) as cargas
        from public.lineas_shisha_sabores s join lin on lin.id = s.linea_id
        group by s.nombre
      ) x
    )
  ) into v;
  return v;
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
    'emitir_factura(bigint,text,text,text)',
    'rectificar_ticket(bigint,text,public.metodo_pago)',
    'verificar_registro_facturacion()',
    'informe_ventas(date,date)',
    'resumen_caja(bigint)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- Los tickets ya emitidos antes de esta migración entran en el registro, en orden
do $$
declare
  t record;
begin
  for t in select * from public.tickets order by id loop
    perform private.registrar_factura('F2', t.serie || '-' || t.numero, t.emitido_en, t.cuota_iva, t.total, t.id, null, null);
  end loop;
end;
$$;
