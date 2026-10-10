-- אורה CRM · שלב 27א: תיקון ממצאים מהבדיקה מחדש של שלבים 1–3 (docs/plans/2026-10-10-audit-stages-1-3.md)
-- 1. CLAUDE.md: every closed list is an enum. activity_log used text + check.
-- 2. Playbook stage 01: every table that is edited from the UI has created_at and updated_at (staff, treatments did not).

create type public.activity_entity as enum ('customer', 'appointment', 'ticket');
create type public.activity_action as enum ('created', 'updated');

alter table public.activity_log drop constraint if exists activity_log_entity_type_check;
alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log
  alter column entity_type type public.activity_entity using entity_type::public.activity_entity,
  alter column action type public.activity_action using action::public.activity_action;

-- same function as in 20261008100100_automations, with explicit enum casts in the insert
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := case tg_table_name
    when 'customers' then 'customer'
    when 'appointments' then 'appointment'
    else 'ticket' end;
  -- via jsonb: plpgsql fails on new.customer_id for the customers table even in an untaken branch
  v_customer uuid := coalesce((to_jsonb(new) ->> 'customer_id')::uuid, new.id);
  v_actor uuid := auth.uid();
  v_label text;
  v_changes jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb := to_jsonb(new);
  k text;
  tracked text[] := case tg_table_name
    when 'customers' then array['full_name', 'phone', 'email', 'source', 'marketing_consent', 'notes']
    when 'appointments' then array['treatment_id', 'staff_id', 'starts_at', 'duration_minutes', 'status', 'cancel_reason', 'notes']
    else array['subject', 'description', 'status', 'assignee_id', 'priority', 'source'] end;
begin
  select s.full_name into v_label from public.staff s where s.id = v_actor;
  v_label := coalesce(v_label, nullif(current_setting('app.actor', true), ''), 'מערכת');

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    foreach k in array tracked loop
      if v_old -> k is distinct from v_new -> k then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object(
          'from', public.activity_display_value(k, v_old ->> k),
          'to', public.activity_display_value(k, v_new ->> k)));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into public.activity_log (entity_type, entity_id, customer_id, action, changes, actor_id, actor_label)
  values (v_entity::public.activity_entity, new.id, v_customer,
          (case tg_op when 'INSERT' then 'created' else 'updated' end)::public.activity_action, v_changes,
          case when exists (select 1 from public.staff s where s.id = v_actor) then v_actor end, v_label);
  return new;
end;
$$;

alter table public.staff add column updated_at timestamptz not null default now();
alter table public.treatments
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();
create trigger treatments_updated_at before update on public.treatments
  for each row execute function public.set_updated_at();
