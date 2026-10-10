-- אורה CRM · שלב 27ב: "התור הבא" = תור בסטטוס "עתידי" שמועדו אחרי עכשיו (BR-08, FR-05)
-- Before: "not cancelled and in the future", so a future appointment marked "completed" still showed as the next one,
-- in the customer card and to the agent. Same definition in the view, the card and agent_next_appointment.

create or replace view public.customer_overview
with (security_invoker = true)
as
select
  c.*,
  na.starts_at as next_appointment_at,
  na.treatment_name as next_treatment,
  coalesce(ot.open_count, 0)::integer as open_tickets
from public.customers c
left join lateral (
  select a.starts_at, t.name as treatment_name
  from public.appointments a
  join public.treatments t on t.id = a.treatment_id
  where a.customer_id = c.id
    and a.status = 'scheduled'
    and a.starts_at > now()
  order by a.starts_at
  limit 1
) na on true
left join lateral (
  select count(*) as open_count
  from public.tickets tk
  where tk.customer_id = c.id
    and tk.status <> 'closed'
) ot on true;

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
    and a.status = 'scheduled'
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
