-- אורה CRM · שלב 30: קריאה חורגת = פתוחה מעל 2 ימי עסקים (BR-11), כמו באבחון בשאלה 1
-- 48 hours flagged a Thursday ticket as overdue on Saturday, while the clinic is closed.
-- Business days are Sun-Thu (Israel time). Holidays are not covered yet (needs a holiday calendar, PRD roadmap).

create or replace function public.ticket_due_at(p_created timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_created at time zone 'Asia/Jerusalem';
  v_days integer := 0;
begin
  -- opened on Friday or Saturday: the clock starts on Sunday at 09:00
  while extract(dow from v_local) in (5, 6) loop
    v_local := date_trunc('day', v_local) + interval '1 day 9 hours';
  end loop;
  while v_days < 2 loop
    v_local := v_local + interval '1 day';
    if extract(dow from v_local) not in (5, 6) then
      v_days := v_days + 1;
    end if;
  end loop;
  return v_local at time zone 'Asia/Jerusalem';
end;
$$;

alter table public.tickets add column due_at timestamptz;

-- created_at never changes, so due_at is set once on insert
create or replace function public.set_ticket_due_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.due_at := public.ticket_due_at(coalesce(new.created_at, now()));
  return new;
end;
$$;

create trigger tickets_due_at before insert on public.tickets
  for each row execute function public.set_ticket_due_at();

-- backfill without touching updated_at (it would mark every ticket as edited now)
alter table public.tickets disable trigger tickets_updated_at;
update public.tickets set due_at = public.ticket_due_at(created_at);
alter table public.tickets enable trigger tickets_updated_at;
alter table public.tickets alter column due_at set not null;
create index tickets_open_due_idx on public.tickets (due_at) where status <> 'closed';

revoke execute on function public.set_ticket_due_at() from public, anon, authenticated;

-- same as in 20261008100200_permissions, overdue now uses due_at
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
        select s.id, s.full_name as name, 0 as sort,
               count(o.id) filter (where o.status = 'new') as new_count,
               count(o.id) filter (where o.status = 'in_progress') as in_progress_count,
               count(o.id) filter (where o.is_overdue) as overdue_count,
               count(o.id) as total
        from public.staff s
        left join open_t o on o.assignee_id = s.id
        where s.is_active and s.role <> 'viewer'
        group by s.id, s.full_name
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
