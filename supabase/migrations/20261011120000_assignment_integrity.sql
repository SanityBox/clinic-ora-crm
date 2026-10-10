-- Stage 33 (bug hunt): assignment and system-managed fields.

-- 1. "by assignee" also lists inactive or view-only staff who still hold open tickets (PRD 8.5: the owner
--    reassigns them). Before, their tickets counted in the KPIs but appeared in no row.
create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with open_t as (
    select t.*, t.due_at < now() as is_overdue
    from public.tickets t
    where t.status <> 'closed'
  ),
  today as (
    select (now() at time zone 'Asia/Jerusalem')::date as d
  ),
  last30 as (
    select
      count(*) filter (where a.status = 'cancelled' and a.cancel_reason = 'no_show') as no_shows,
      count(*) filter (where a.status = 'completed') as attended
    from public.appointments a
    where a.starts_at >= now() - interval '30 days' and a.starts_at <= now()
  )
  select jsonb_build_object(
    'new_count', (select count(*) from open_t where status = 'new'),
    'in_progress_count', (select count(*) from open_t where status = 'in_progress'),
    'unassigned_count', (select count(*) from open_t where assignee_id is null),
    'overdue_count', (select count(*) from open_t where is_overdue),
    'today_appointments', (
      select count(*) from public.appointments a, today
      where a.status <> 'cancelled' and (a.starts_at at time zone 'Asia/Jerusalem')::date = today.d),
    'no_show_count', (select no_shows from last30),
    'attended_count', (select attended from last30),
    'no_show_rate', (select case when no_shows + attended = 0 then null
                                 else round(100.0 * no_shows / (no_shows + attended)) end from last30),
    'by_assignee', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.sort, x.name), '[]'::jsonb)
      from (
        select s.id,
               s.full_name || case when s.is_active and s.role <> 'viewer' then ''
                                   when s.is_active then ' (צפייה בלבד)'
                                   else ' (לא פעילה)' end as name,
               0 as sort,
               count(o.id) filter (where o.status = 'new') as new_count,
               count(o.id) filter (where o.status = 'in_progress') as in_progress_count,
               count(o.id) filter (where o.is_overdue) as overdue_count,
               count(o.id) as total
        from public.staff s
        left join open_t o on o.assignee_id = s.id
        group by s.id, s.full_name, s.is_active, s.role
        having (s.is_active and s.role <> 'viewer') or count(o.id) > 0
        union all
        select null, 'לא שויכה', 1,
               count(*) filter (where status = 'new'),
               count(*) filter (where status = 'in_progress'),
               count(*) filter (where is_overdue),
               count(*)
        from open_t where assignee_id is null
      ) x
    )
  );
$$;

-- 2. Fields the system manages cannot be rewritten through the API (the table has a broad update grant for
--    staff). Without this a writer could move due_at to hide an overdue ticket from the owner.
--    Runs before tickets_status (triggers fire in name order), which still sets closed_at when the status changes.
--    A future migration that must recompute due_at disables this trigger for the backfill.
create or replace function public.tickets_protect_system_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ticket_number := old.ticket_number;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.due_at := old.due_at;
  if new.status = old.status then
    new.closed_at := old.closed_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.tickets_protect_system_fields() from public, anon, authenticated;

create trigger tickets_protect before update on public.tickets
  for each row execute function public.tickets_protect_system_fields();
