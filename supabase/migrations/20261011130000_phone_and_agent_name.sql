-- Stage 34 (bug hunt): phone and agent name edge cases.

-- "+972 054-782-1390" became "00547821390" and was rejected. Same rule as normalizePhone in src/lib/format.ts.
create or replace function public.normalize_phone(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '00972%' then
    d := '0' || substr(d, 6);
  elsif d like '972%' then
    d := '0' || substr(d, 4);
  end if;
  -- "+972 054-..." keeps the trunk 0 after the country code
  if d like '00%' then
    d := substr(d, 2);
  end if;
  if d ~ '^0(5|7)\d{8}$' or d ~ '^0[2-489]\d{7}$' then
    return d;
  end if;
  return null;
end;
$$;

-- A one-letter name ("ש") failed the customers CHECK (char_length >= 2) and the agent could not open the ticket.
-- The name the customer gave is still kept in tickets.reported_name.
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
    values (case when char_length(v_name) >= 2 then v_name else 'לקוחה מהסוכן' end, v_phone, 'ai_agent')
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
