-- Supabase crea public.rls_auto_enable() (security definer) en los proyectos nuevos.
-- Es para su event trigger interno: no debe poder llamarse desde la API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
