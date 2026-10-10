-- אורה CRM · תקלות באינטגרציה עם הסוכן (שאלה 5: "תהליך שגיאה נפרד, והתראה לבן אדם")
-- n8n reports failures here (its error workflow, or a failed CloudChat handoff); the dashboard shows the last 24 hours.

create table public.integration_incidents (
  id bigint generated always as identity primary key,
  source text not null,
  node text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index integration_incidents_created_idx on public.integration_incidents (created_at desc);

alter table public.integration_incidents enable row level security;
create policy integration_incidents_select on public.integration_incidents for select to authenticated using (public.is_active_staff());
grant select on public.integration_incidents to authenticated;

create or replace function public.agent_report_incident(p_source text, p_node text, p_message text, p_details jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not private.agent_key_ok() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  insert into public.integration_incidents (source, node, message, details)
  values (left(coalesce(nullif(btrim(p_source), ''), 'n8n'), 200),
          left(nullif(btrim(coalesce(p_node, '')), ''), 200),
          left(coalesce(nullif(btrim(p_message), ''), 'שגיאה בלי הודעה'), 1000),
          coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'incident_id', v_id);
end;
$$;

revoke execute on function public.agent_report_incident(text, text, text, jsonb) from public;
-- Callable with the publishable key; the x-agent-key check inside is the real gate.
grant execute on function public.agent_report_incident(text, text, text, jsonb) to anon, authenticated;
