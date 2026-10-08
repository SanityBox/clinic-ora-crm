-- אורה CRM · שלב 2: מבנה הנתונים (PRD סעיף 9)
-- Closed lists are enums so reports stay trustworthy (PRD BR-05, BR-09).

create type public.staff_role as enum ('admin', 'staff', 'viewer');
create type public.customer_source as enum ('instagram', 'facebook', 'website', 'referral', 'whatsapp', 'ai_agent', 'other');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled');
create type public.cancel_reason as enum ('customer', 'clinic', 'no_show');
create type public.ticket_status as enum ('new', 'in_progress', 'closed');
create type public.ticket_priority as enum ('normal', 'urgent');
create type public.ticket_source as enum ('phone', 'whatsapp', 'instagram', 'facebook', 'website', 'walk_in', 'ai_agent');

-- BR-01: one canonical phone format, e.g. 0547821390. Returns null when the input is not an Israeli number.
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
  if d ~ '^0(5|7)\d{8}$' or d ~ '^0[2-489]\d{7}$' then
    return d;
  end if;
  return null;
end;
$$;

create table public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.staff_role not null default 'viewer',
  specialty text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) >= 2),
  phone text not null unique check (phone ~ '^0\d{8,9}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source public.customer_source,
  marketing_consent boolean not null default false,
  notes text,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.treatments (
  id integer generated always as identity primary key,
  name text not null unique,
  price integer not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  treatment_id integer not null references public.treatments (id),
  staff_id uuid references public.staff (id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  status public.appointment_status not null default 'scheduled',
  cancel_reason public.cancel_reason,
  notes text,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- BR-07: a reason exists exactly when the appointment is cancelled
  constraint appointments_cancel_reason_matches check ((status = 'cancelled') = (cancel_reason is not null))
);

create sequence public.ticket_number_seq start 1001;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number integer not null unique default nextval('public.ticket_number_seq'),
  customer_id uuid not null references public.customers (id) on delete cascade,
  subject text,
  description text not null check (char_length(btrim(description)) > 0),
  status public.ticket_status not null default 'new',
  assignee_id uuid references public.staff (id) on delete set null,
  priority public.ticket_priority not null default 'normal',
  source public.ticket_source,
  reported_name text,
  created_by uuid references public.staff (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- BR-09: a ticket in progress always has an owner
  constraint tickets_in_progress_has_assignee check (status <> 'in_progress' or assignee_id is not null)
);

alter sequence public.ticket_number_seq owned by public.tickets.ticket_number;

create table public.activity_log (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('customer', 'appointment', 'ticket')),
  entity_id uuid not null,
  customer_id uuid references public.customers (id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  changes jsonb not null default '{}'::jsonb,
  actor_id uuid references public.staff (id) on delete set null,
  actor_label text not null,
  created_at timestamptz not null default now()
);

create index customers_full_name_idx on public.customers (full_name);
create index appointments_customer_starts_idx on public.appointments (customer_id, starts_at);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_staff_idx on public.appointments (staff_id);
create index tickets_status_assignee_idx on public.tickets (status, assignee_id);
create index tickets_customer_idx on public.tickets (customer_id);
create index activity_log_customer_idx on public.activity_log (customer_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id, created_at desc);

-- Customer list with the two values every screen asks for: next appointment (BR-08) and open tickets.
create view public.customer_overview
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
    and a.status <> 'cancelled'
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
