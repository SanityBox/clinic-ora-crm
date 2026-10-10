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
  ('מאיה טל', '0585550115', 'instagram', 'לקוחת בדיקה לסוכן: בלי תור'),
  ('רוני גל', '0585550116', 'facebook', 'לקוחת בדיקה לסוכן: תור מבוטל קרוב ותור עתידי רחוק'),
  ('שירה דהן', '0585550117', 'website', 'לקוחת בדיקה לסוכן: רק תור מבוטל')
on conflict (phone) do nothing;

do $$
declare
  v_liat uuid := (select id from public.staff where email = 'liat@clinic-ora.co.il');
  v_neta uuid := (select id from public.staff where email = 'neta@clinic-ora.co.il');
  v_rotem uuid := (select id from public.staff where email = 'rotem@clinic-ora.co.il');
  -- agent test cases, kept out of the random pool: 052-555-0101 has exactly one future appointment,
  -- 058-555-0115 none, 058-555-0116 a cancelled one before a scheduled one, 058-555-0117 only a cancelled one
  v_pool uuid[] := array(select id from public.customers
                         where phone not in ('0525550101', '0585550115', '0585550116', '0585550117') order by phone);
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

  -- "התור הבא" מדלג על תור מבוטל: ל-058-555-0116 תור מבוטל בעוד 3 ימים ותור עתידי בעוד כ-20 יום,
  -- ול-058-555-0117 רק תור מבוטל בעוד 5 ימים
  delete from public.appointments a using public.customers c
   where c.id = a.customer_id and c.phone in ('0585550116', '0585550117') and a.starts_at > now();
  insert into public.appointments (customer_id, treatment_id, staff_id, starts_at, duration_minutes, status, cancel_reason, notes)
  -- weekdays only (Sunday-Thursday), so the slot is inside opening hours
  select c.id, x.treat, v_neta, ((current_date + x.days + case extract(dow from current_date + x.days)::int when 5 then 2 when 6 then 1 else 0 end)
         + x.at) at time zone 'Asia/Jerusalem', t.duration_minutes, x.status::appointment_status,
         x.reason::cancel_reason, 'דמו'
  from (values ('0585550116', 3, time '10:00', 4, 'cancelled', 'customer'),
               ('0585550116', 20, time '12:30', 5, 'scheduled', null),
               ('0585550117', 5, time '16:00', 4, 'cancelled', 'customer')) as x(phone, days, at, treat, status, reason)
  join public.customers c on c.phone = x.phone
  join public.treatments t on t.id = x.treat;
end $$;
