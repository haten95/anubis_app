-- =====================================================================
-- Optimización: índices para claves foráneas y una sola política de
-- lectura por tabla (las políticas "for all" se dividen en
-- insert/update/delete para no duplicar la de select).
-- =====================================================================

create index if not exists cajas_abierta_por_idx            on public.cajas (abierta_por);
create index if not exists cajas_cerrada_por_idx            on public.cajas (cerrada_por);
create index if not exists comandas_abierta_por_idx         on public.comandas (abierta_por);
create index if not exists comandas_cerrada_por_idx         on public.comandas (cerrada_por);
create index if not exists lineas_comanda_anulada_por_idx   on public.lineas_comanda (anulada_por);
create index if not exists lineas_comanda_articulo_idx      on public.lineas_comanda (articulo_id);
create index if not exists lineas_comanda_creado_por_idx    on public.lineas_comanda (creado_por);
create index if not exists lineas_shisha_sabores_sabor_idx  on public.lineas_shisha_sabores (sabor_id);
create index if not exists mermas_autorizada_por_idx        on public.mermas (autorizada_por);
create index if not exists mermas_comanda_idx               on public.mermas (comanda_id);
create index if not exists movimientos_caja_usuario_idx     on public.movimientos_caja (usuario_id);
create index if not exists movimientos_stock_pedido_idx     on public.movimientos_stock (pedido_id);
create index if not exists movimientos_stock_usuario_idx    on public.movimientos_stock (usuario_id);
create index if not exists pagos_cobrado_por_idx            on public.pagos (cobrado_por);
create index if not exists pagos_comanda_idx                on public.pagos (comanda_id);
create index if not exists pedidos_proveedor_creado_por_idx on public.pedidos_proveedor (creado_por);
create index if not exists sabores_producto_idx             on public.sabores (producto_id);
create index if not exists tickets_caja_idx                 on public.tickets (caja_id);
create index if not exists tickets_emitido_por_idx          on public.tickets (emitido_por);

-- Divide las políticas "for all" de escritura
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('categorias', 'categorias_write', 'private.es_gestor()', null),
      ('articulos', 'articulos_write', 'private.es_gestor()', null),
      ('sabores', 'sabores_write', 'private.es_gestor()', null),
      ('recetas', 'recetas_write', 'private.es_gestor()', null),
      ('proveedores', 'proveedores_write', 'private.es_gestor()', null),
      ('lineas_pedido', 'lineas_pedido_write', 'private.es_gestor()',
        'exists (select 1 from public.pedidos_proveedor p where p.id = pedido_id and p.estado = ''borrador'')')
    ) as v(tabla, politica, rol, extra)
  loop
    execute format('drop policy if exists %I on public.%I', t.politica, t.tabla);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select %s)%s)',
      t.tabla || '_insert', t.tabla, t.rol, coalesce(' and ' || t.extra, ''));
    execute format('create policy %I on public.%I for update to authenticated using ((select %s)%s) with check ((select %s)%s)',
      t.tabla || '_update', t.tabla, t.rol, coalesce(' and ' || t.extra, ''), t.rol, coalesce(' and ' || t.extra, ''));
    execute format('create policy %I on public.%I for delete to authenticated using ((select %s)%s)',
      t.tabla || '_delete', t.tabla, t.rol, coalesce(' and ' || t.extra, ''));
  end loop;
end;
$$;
