-- נתוני דמו לקליניקת אורה. בלי סודות: המשתמשות נוצרות ב-Supabase Auth ונמצאות כאן לפי אימייל.
-- התאריכים יחסיים ל-current_date, כדי ש"תורים היום" ו"התור הבא" לא יתיישנו. אפשר להריץ שוב.

insert into public.customers (full_name, phone, source, notes) values
  ('נועה ברק', '0525550101', 'instagram', 'לקוחת בדיקה לסוכן: יש לה תור עתידי'),
  ('מיכל אברהם', '0525550102', 'facebook', null),
  ('שירן דהן', '0525550103', 'referral', 'הגיעה בהמלצת נועה'),
  ('יעל פרץ', '0545550104', 'website', 'רגישות לחומצות'),
  ('רוני שמעוני', '0545550105', 'whatsapp', null),
  ('הדס גולן', '0545550106', 'instagram', null),
  ('טל מזרחי', '0505550107', 'instagram', null),
  ('אורית ביטון', '0505550108', 'referral', 'מעדיפה תורים בבוקר'),
  ('ליה אוחיון', '0505550109', 'facebook', null),
  ('דנה רוזן', '0535550110', 'website', null),
  ('ענבל חדד', '0535550111', 'instagram', null),
  ('קרן וקנין', '0535550112', 'other', null),
  ('סיון נחום', '0585550113', 'referral', null),
  ('גלית אשכנזי', '0585550114', 'whatsapp', null),
  ('מאיה טל', '0585550115', 'instagram', 'לקוחת בדיקה לסוכן: בלי תור')
on conflict (phone) do nothing;

do $$
declare
  v_liat uuid := (select id from public.staff where email = 'liat@clinic-ora.co.il');
  v_neta uuid := (select id from public.staff where email = 'neta@clinic-ora.co.il');
  v_rotem uuid := (select id from public.staff where email = 'rotem@clinic-ora.co.il');
  -- 052-555-0101 has exactly one future appointment and 058-555-0115 none: both are agent test cases
  v_pool uuid[] := array(select id from public.customers
                         where phone not in ('0525550101', '0585550115') order by phone);
  v_day date;
  v_i int := 0;
  v_slots time[];
  v_staff uuid[];
  v_treat int[];
  v_next date;
begin
  delete from public.appointments where notes = 'דמו' and starts_at > now();

  for v_day in select d::date from generate_series(current_date, current_date + 75, '1 day') d loop
    continue when extract(dow from v_day) = 6;  -- שבת
    if extract(dow from v_day) = 5 then         -- שישי עד 13:00
      v_slots := array['09:30', '10:45', '12:00']::time[];
    else
      v_slots := array['10:00', '12:30', '16:00']::time[];
    end if;
    v_staff := array[v_liat, v_neta, v_rotem];
    v_treat := array[6 + (v_i % 2), 4 + (v_i % 2), 1 + (v_i % 3)];
    for k in 1..3 loop
      insert into public.appointments (customer_id, treatment_id, staff_id, starts_at, duration_minutes, status, notes)
      select v_pool[1 + ((v_i * 3 + k) % array_length(v_pool, 1))], v_treat[k], v_staff[k],
             (v_day + v_slots[k]) at time zone 'Asia/Jerusalem', t.duration_minutes, 'scheduled', 'דמו'
      from public.treatments t where t.id = v_treat[k];
    end loop;
    v_i := v_i + 1;
  end loop;

  -- התור הבא של 052-555-0101: יום חול בעוד כ-60 יום, 11:30, לייזר אצל ליאת
  v_next := current_date + 60;
  while extract(dow from v_next) in (5, 6) loop v_next := v_next + 1; end loop;
  delete from public.appointments a using public.customers c
   where c.id = a.customer_id and c.phone = '0525550101' and a.status = 'scheduled' and a.starts_at > now();
  insert into public.appointments (customer_id, treatment_id, staff_id, starts_at, duration_minutes, status, notes)
  select c.id, 6, v_liat, (v_next + time '11:30') at time zone 'Asia/Jerusalem', 60, 'scheduled', 'דמו'
  from public.customers c where c.phone = '0525550101';
end $$;
