-- Stage 35: the activity log (★2) also records deletions, so it is known who deleted an appointment or a ticket.
-- The new enum value is only referenced inside the function body, which runs later, so one migration is enough.
alter type public.activity_action add value if not exists 'deleted';

create or replace function public.log_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_customer uuid := (v_old ->> 'customer_id')::uuid;
  v_actor uuid := auth.uid();
  v_label text;
  v_changes jsonb := '{}'::jsonb;
  k text;
  shown text[] := case tg_table_name
    when 'appointments' then array['starts_at', 'treatment_id', 'staff_id', 'status']
    when 'tickets' then array['ticket_number', 'subject', 'status', 'assignee_id']
    else array[]::text[] end;
begin
  -- Deleting a customer (BR-14, a privacy request) takes her appointments and tickets with it. Those are not
  -- logged: by the time the cascade runs she no longer exists, and nothing about her should outlive the deletion.
  if tg_table_name <> 'customers' and not exists (select 1 from public.customers c where c.id = v_customer) then
    return old;
  end if;

  select s.full_name into v_label from public.staff s where s.id = v_actor;
  v_label := coalesce(v_label, nullif(current_setting('app.actor', true), ''), 'מערכת');

  if tg_table_name = 'customers' then
    -- who deleted and when, with no personal data; her earlier log rows go with her (FK cascade)
    v_customer := null;
  else
    foreach k in array shown loop
      v_changes := v_changes || jsonb_build_object(k, jsonb_build_object(
        'from', public.activity_display_value(k, v_old ->> k), 'to', null));
    end loop;
  end if;

  insert into public.activity_log (entity_type, entity_id, customer_id, action, changes, actor_id, actor_label)
  values ((case tg_table_name when 'customers' then 'customer' when 'appointments' then 'appointment' else 'ticket' end)::public.activity_entity,
          old.id, v_customer, 'deleted'::public.activity_action, v_changes,
          case when exists (select 1 from public.staff s where s.id = v_actor) then v_actor end, v_label);
  return old;
end;
$$;

revoke execute on function public.log_deletion() from public, anon, authenticated;

create trigger appointments_deleted after delete on public.appointments
  for each row execute function public.log_deletion();
create trigger tickets_deleted after delete on public.tickets
  for each row execute function public.log_deletion();
create trigger customers_deleted after delete on public.customers
  for each row execute function public.log_deletion();
