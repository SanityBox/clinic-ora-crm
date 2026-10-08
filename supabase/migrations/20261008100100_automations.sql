-- אורה CRM · שלב 2: אוטומציות פנימיות (PRD סעיף 10.1, A1-A6)

-- A1: updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger tickets_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

-- A6: phone is normalized on every write, including writes from the agent
create or replace function public.customers_normalize_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized text := public.normalize_phone(new.phone);
begin
  if normalized is null then
    raise exception 'invalid_phone' using errcode = '22023', hint = 'Israeli phone, e.g. 054-7821390';
  end if;
  new.phone := normalized;
  new.full_name := btrim(new.full_name);
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

create trigger customers_phone before insert or update of phone, full_name, email on public.customers
  for each row execute function public.customers_normalize_phone();

-- A5: leaving "cancelled" clears the reason, so the check constraint never trips on a status change
create or replace function public.appointments_status_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'cancelled' then
    new.cancel_reason := null;
  end if;
  return new;
end;
$$;

create trigger appointments_status before insert or update on public.appointments
  for each row execute function public.appointments_status_rules();

-- A2: closed_at follows the status (BR-10)
create or replace function public.tickets_status_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  if new.subject is null or btrim(new.subject) = '' then
    new.subject := left(regexp_replace(btrim(new.description), '\s+', ' ', 'g'), 60);
  end if;
  return new;
end;
$$;

create trigger tickets_status before insert or update on public.tickets
  for each row execute function public.tickets_status_rules();

-- A3 ★2: activity log. Values are stored display-ready (names, not ids) so the log stays readable
-- even after a staff member or treatment is renamed.
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
  values (v_entity, new.id, v_customer, case tg_op when 'INSERT' then 'created' else 'updated' end, v_changes,
          case when exists (select 1 from public.staff s where s.id = v_actor) then v_actor end, v_label);
  return new;
end;
$$;

create or replace function public.activity_display_value(p_field text, p_value text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_value is null then
    return null;
  end if;
  return case p_field
    when 'assignee_id' then (select full_name from public.staff where id = p_value::uuid)
    when 'staff_id' then (select full_name from public.staff where id = p_value::uuid)
    when 'treatment_id' then (select name from public.treatments where id = p_value::integer)
    when 'starts_at' then to_char(p_value::timestamptz at time zone 'Asia/Jerusalem', 'DD/MM/YYYY HH24:MI')
    else p_value end;
end;
$$;

create trigger customers_activity after insert or update on public.customers
  for each row execute function public.log_activity();
create trigger appointments_activity after insert or update on public.appointments
  for each row execute function public.log_activity();
create trigger tickets_activity after insert or update on public.tickets
  for each row execute function public.log_activity();
