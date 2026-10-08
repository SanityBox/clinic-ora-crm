-- אורה CRM · שלב 2: הרשאות ותפקידים (PRD סעיף 7)
-- Deny by default: RLS on every table, the role is read from public.staff on every request,
-- so a role change or deactivation applies immediately.

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff where id = auth.uid() and is_active;
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.current_staff_role() is not null;
$$;

create or replace function public.can_write()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.current_staff_role() in ('admin', 'staff'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.current_staff_role() = 'admin', false);
$$;

alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.treatments enable row level security;
alter table public.appointments enable row level security;
alter table public.tickets enable row level security;
alter table public.activity_log enable row level security;

-- staff: everyone active sees the team (needed for "assignee" lists); only an admin changes it.
-- Rows are created by the auth trigger, never from the client.
create policy staff_select on public.staff for select to authenticated
  using (public.is_active_staff() or id = auth.uid());
create policy staff_update on public.staff for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy customers_select on public.customers for select to authenticated using (public.is_active_staff());
create policy customers_insert on public.customers for insert to authenticated with check (public.can_write());
create policy customers_update on public.customers for update to authenticated using (public.can_write()) with check (public.can_write());
create policy customers_delete on public.customers for delete to authenticated using (public.is_admin());

create policy treatments_select on public.treatments for select to authenticated using (public.is_active_staff());
create policy treatments_insert on public.treatments for insert to authenticated with check (public.is_admin());
create policy treatments_update on public.treatments for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy appointments_select on public.appointments for select to authenticated using (public.is_active_staff());
create policy appointments_insert on public.appointments for insert to authenticated with check (public.can_write());
create policy appointments_update on public.appointments for update to authenticated using (public.can_write()) with check (public.can_write());
create policy appointments_delete on public.appointments for delete to authenticated using (public.is_admin());

create policy tickets_select on public.tickets for select to authenticated using (public.is_active_staff());
create policy tickets_insert on public.tickets for insert to authenticated with check (public.can_write());
create policy tickets_update on public.tickets for update to authenticated using (public.can_write()) with check (public.can_write());
create policy tickets_delete on public.tickets for delete to authenticated using (public.is_admin());

-- The log is written only by the security-definer trigger; nobody edits or deletes it.
create policy activity_log_select on public.activity_log for select to authenticated using (public.is_active_staff());

-- Anonymous visitors get nothing from the tables.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on public.customers, public.appointments, public.tickets to authenticated;
grant select, update on public.staff to authenticated;
grant select, insert, update on public.treatments to authenticated;
grant select on public.activity_log, public.customer_overview to authenticated;
grant usage on sequence public.ticket_number_seq to authenticated;

-- A4: a new Auth user becomes an inactive viewer until an admin activates them.
-- Sign-up metadata is user-controlled, so it never decides the role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff (id, full_name, email, role, is_active)
  values (new.id,
          coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
          new.email, 'viewer', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- BR-12: an admin cannot lock themselves out, and at least one active admin always remains.
create or replace function public.staff_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = auth.uid() and (new.role <> 'admin' or not new.is_active) and old.role = 'admin' then
    raise exception 'cannot_demote_self' using errcode = '42501';
  end if;
  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active)
     and not exists (select 1 from public.staff s where s.role = 'admin' and s.is_active and s.id <> old.id) then
    raise exception 'last_admin' using errcode = '42501';
  end if;
  if new.email is distinct from old.email or new.id is distinct from old.id then
    raise exception 'immutable_field' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger staff_guard before update on public.staff
  for each row execute function public.staff_guard();

-- Dashboard numbers (PRD 5.2). security invoker: RLS decides what is counted.
create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with open_t as (
    select t.*, t.created_at < now() - interval '48 hours' as is_overdue
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

revoke execute on function public.dashboard_stats() from anon, public;
grant execute on function public.dashboard_stats() to authenticated;
