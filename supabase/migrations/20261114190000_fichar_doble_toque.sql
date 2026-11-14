-- Fichar: evita cerrar la jornada por un doble toque accidental.
-- Si la entrada se fichó hace menos de 1 minuto, no se ficha la salida y se avisa.
create or replace function public.fichar()
returns public.fichajes language plpgsql security definer set search_path = ''
as $$
declare
  f public.fichajes;
begin
  perform private.exigir_personal();

  select * into f from public.fichajes where usuario_id = auth.uid() and salida is null for update;

  if f.id is not null then
    if clock_timestamp() - f.entrada < interval '1 minute' then
      raise exception 'Acabas de fichar la entrada. Si quieres fichar la salida, espera un minuto.';
    end if;
    update public.fichajes set salida = clock_timestamp() where id = f.id returning * into f;
  else
    insert into public.fichajes (usuario_id, entrada) values (auth.uid(), clock_timestamp()) returning * into f;
  end if;
  return f;
end;
$$;

revoke execute on function public.fichar() from public, anon;
grant execute on function public.fichar() to authenticated;
