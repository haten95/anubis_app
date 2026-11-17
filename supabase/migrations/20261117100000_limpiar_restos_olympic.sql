-- Limpieza: se ejecutó por error en este proyecto un SQL de otra app (Olympic Fitness)
-- que dejó dos funciones que no pertenecen a Anubis (y que aquí no funcionan:
-- usan private.es_admin(), el rol 'cliente' y columnas de socios que no existen).
drop function if exists public.actualizar_datos_cliente(uuid, text, text, text, text, text, text);
drop function if exists private.proteger_campos_usuario();
