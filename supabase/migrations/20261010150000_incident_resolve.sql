-- אורה CRM · שלב 28: תקלה נשארת בבאנר עד שמישהי מסמנת "טופל" (לא נעלמת אחרי 24 שעות)
-- A Friday-noon incident must still be on screen on Sunday morning, when the clinic reopens.

alter table public.integration_incidents
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.staff (id) on delete set null;

create index integration_incidents_open_idx on public.integration_incidents (created_at desc) where resolved_at is null;

-- Staff can only mark an incident as handled; no general update policy on the table.
create or replace function public.resolve_incident(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_write() then
    raise exception 'אין הרשאה לפעולה הזו' using errcode = '42501';
  end if;
  update public.integration_incidents
  set resolved_at = now(), resolved_by = auth.uid()
  where id = p_id and resolved_at is null;
end;
$$;

revoke execute on function public.resolve_incident(bigint) from public, anon;
grant execute on function public.resolve_incident(bigint) to authenticated;
