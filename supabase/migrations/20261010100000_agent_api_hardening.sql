-- אורה CRM · חיזוק ממשק הסוכן (docs/plans/2026-10-10-agent-api-hardening.md)

drop function if exists public.agent_create_ticket(text, text, text);

create or replace function public.agent_create_ticket(
  p_name text, p_phone text, p_description text, p_request_type text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_type text := nullif(btrim(coalesce(p_request_type, '')), '');
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
  -- the agent once sent the clinic's own WhatsApp number (it is in the knowledge base) as the customer's
  if v_phone in ('0547821390', '097745120') then
    return jsonb_build_object('ok', false, 'error', 'clinic_phone');
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
  else
    -- n8n retries a POST whose response was slow: return the ticket that was already opened
    select * into v_ticket from public.tickets
    where customer_id = v_customer.id and source = 'ai_agent'
      and description = left(v_desc, 2000) and created_at > now() - interval '10 minutes'
    order by created_at desc limit 1;
    if found then
      return jsonb_build_object(
        'ok', true, 'duplicate', true,
        'ticket_id', v_ticket.id, 'ticket_number', v_ticket.ticket_number,
        'status', 'חדשה', 'priority', v_ticket.priority,
        'customer_id', v_customer.id, 'customer_created', false);
    end if;
  end if;

  insert into public.tickets (customer_id, description, status, source, reported_name, priority)
  values (v_customer.id, left(v_desc, 2000), 'new', 'ai_agent', v_name,
          case when v_type = 'בקשת נציגה' or v_desc like '[בקשת נציגה]%' then 'urgent'
               else 'normal' end::public.ticket_priority)
  returning * into v_ticket;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'ticket_id', v_ticket.id,
    'ticket_number', v_ticket.ticket_number,
    'status', 'חדשה',
    'priority', v_ticket.priority,
    'customer_id', v_customer.id,
    'customer_created', v_created);
end;
$$;

-- PRD 10.2: the minimum needed to answer. No first name or therapist, the chat has no proof of identity.
create or replace function public.agent_next_appointment(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_customer_id uuid;
  v_row record;
  v_local timestamp;
begin
  if not private.agent_key_ok() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select id into v_customer_id from public.customers where phone = v_phone;
  if not found then
    return jsonb_build_object('ok', true, 'customer_found', false, 'has_appointment', false);
  end if;

  select a.starts_at, t.name as treatment
  into v_row
  from public.appointments a
  join public.treatments t on t.id = a.treatment_id
  where a.customer_id = v_customer_id
    and a.status <> 'cancelled'
    and a.starts_at > now()
  order by a.starts_at
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'customer_found', true, 'has_appointment', false);
  end if;

  v_local := v_row.starts_at at time zone 'Asia/Jerusalem';
  return jsonb_build_object(
    'ok', true,
    'customer_found', true,
    'has_appointment', true,
    'date', to_char(v_local, 'DD/MM/YYYY'),
    'weekday', (array['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'])[extract(dow from v_local)::int + 1],
    'time', to_char(v_local, 'HH24:MI'),
    'treatment', v_row.treatment);
end;
$$;

revoke execute on function public.agent_create_ticket(text, text, text, text) from public;
revoke execute on function public.agent_next_appointment(text) from public;
-- Callable with the publishable key; the x-agent-key check inside is the real gate.
grant execute on function public.agent_create_ticket(text, text, text, text) to anon, authenticated;
grant execute on function public.agent_next_appointment(text) to anon, authenticated;
