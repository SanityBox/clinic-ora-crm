-- אורה CRM · ממשק לסוכן השירות (PRD סעיף 10.2, שאלה 5 במבחן)
-- n8n calls these two functions through the Supabase REST API with header x-agent-key.
-- Only the sha256 of that key is stored here; the key itself lives in the n8n credential vault.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.integration_keys (
  id integer generated always as identity primary key,
  name text not null unique,
  key_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function private.agent_key_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k text := coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-agent-key', '');
begin
  if length(k) < 24 then
    return false;
  end if;
  return exists (
    select 1 from private.integration_keys
    where is_active and key_hash = encode(sha256(convert_to(k, 'UTF8')), 'hex'));
end;
$$;

-- Route A: open a service ticket. Returns ok=true and the ticket number only after the insert succeeded.
create or replace function public.agent_create_ticket(p_name text, p_phone text, p_description text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_customer public.customers%rowtype;
  v_created boolean := false;
  v_ticket public.tickets%rowtype;
begin
  if not private.agent_key_ok() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;
  if v_desc is null then
    return jsonb_build_object('ok', false, 'error', 'missing_description');
  end if;

  perform set_config('app.actor', 'סוכן AI', true);

  select * into v_customer from public.customers where phone = v_phone;
  if not found then
    insert into public.customers (full_name, phone, source)
    values (coalesce(v_name, 'לקוחה מהסוכן'), v_phone, 'ai_agent')
    returning * into v_customer;
    v_created := true;
  end if;

  insert into public.tickets (customer_id, description, status, source, reported_name, priority)
  values (v_customer.id, left(v_desc, 2000), 'new', 'ai_agent', v_name, 'normal')
  returning * into v_ticket;

  return jsonb_build_object(
    'ok', true,
    'ticket_id', v_ticket.id,
    'ticket_number', v_ticket.ticket_number,
    'status', 'חדשה',
    'customer_id', v_customer.id,
    'customer_created', v_created);
end;
$$;

-- Route B: the customer's next appointment (BR-08): nearest future, not cancelled.
create or replace function public.agent_next_appointment(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_customer public.customers%rowtype;
  v_row record;
  v_local timestamp;
begin
  if not private.agent_key_ok() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select * into v_customer from public.customers where phone = v_phone;
  if not found then
    return jsonb_build_object('ok', true, 'customer_found', false, 'has_appointment', false);
  end if;

  select a.starts_at, t.name as treatment, s.full_name as therapist
  into v_row
  from public.appointments a
  join public.treatments t on t.id = a.treatment_id
  left join public.staff s on s.id = a.staff_id
  where a.customer_id = v_customer.id
    and a.status <> 'cancelled'
    and a.starts_at > now()
  order by a.starts_at
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'customer_found', true, 'has_appointment', false,
                              'first_name', split_part(v_customer.full_name, ' ', 1));
  end if;

  v_local := v_row.starts_at at time zone 'Asia/Jerusalem';
  return jsonb_build_object(
    'ok', true,
    'customer_found', true,
    'has_appointment', true,
    'first_name', split_part(v_customer.full_name, ' ', 1),
    'date', to_char(v_local, 'DD/MM/YYYY'),
    'weekday', (array['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'])[extract(dow from v_local)::int + 1],
    'time', to_char(v_local, 'HH24:MI'),
    'treatment', v_row.treatment,
    'therapist', split_part(coalesce(v_row.therapist, ''), ' ', 1));
end;
$$;

revoke execute on function public.agent_create_ticket(text, text, text) from public;
revoke execute on function public.agent_next_appointment(text) from public;
-- Callable with the publishable key; the x-agent-key check inside is the real gate.
grant execute on function public.agent_create_ticket(text, text, text) to anon, authenticated;
grant execute on function public.agent_next_appointment(text) to anon, authenticated;
