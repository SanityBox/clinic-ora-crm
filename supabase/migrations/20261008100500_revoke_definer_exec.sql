-- Advisor 0028/0029: trigger and helper functions are not part of the API.
-- Triggers fire regardless of EXECUTE grants; current_staff_role stays callable by signed-in users because RLS policies call it.
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.activity_display_value(text, text) from public, anon, authenticated;
revoke execute on function public.current_staff_role() from public, anon;
grant execute on function public.current_staff_role() to authenticated;
