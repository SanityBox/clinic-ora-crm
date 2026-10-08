# אינטגרציה: סוכן CloudChat ↔ n8n ↔ CRM

```
CloudChat (AI Function) ──POST + x-roey-key──▶ n8n webhook ──▶ Code: נרמול ובדיקת קלט
                                                      │
                                                      ▼
                         Supabase RPC (x-agent-key, מפתח מכספת n8n) ──▶ תשובה בעברית לסוכן
```

- workflow ב-n8n: `Roey - קליניקת אורה · סוכן ↔ CRM` (קובץ: [n8n-workflow.json](n8n-workflow.json), בלי סודות: רק מזהי credentials).
- שני מסלולים:
  - `POST /webhook/roey-ora-create-ticket` עם `{name, phone, description, request_type, source}` → `agent_create_ticket`: מאתר לקוחה לפי טלפון או יוצר חדשה (מקור "סוכן AI"), ופותח קריאה בסטטוס "חדשה".
  - `POST /webhook/roey-ora-next-appointment` עם `{phone}` → `agent_next_appointment`: התור העתידי הקרוב שלא בוטל.
- אבטחה בשתי שכבות: header auth על ה-webhook, ובבסיס הנתונים בדיקת sha256 של `x-agent-key` מול `private.integration_keys`. בלי מפתח, הפונקציה זורקת `unauthorized`.
- הסוכן מקבל `ok:true` ומספר קריאה רק אחרי שהשמירה הצליחה. בכל כשל (קלט חסר, CRM לא זמין) חוזר `ok:false` עם הודעה, והסוכן לא מבטיח שנשמר.

## בדיקות שבוצעו (08.10.2026, curl מול השרת החי)

| בדיקה | תוצאה |
|---|---|
| בלי header של מפתח | 403 |
| תור הבא ללקוחה עם תור (`052-555-0101`) | יום שלישי 20/10/2026 11:30, טיפול לייזר, נטע ✓ |
| לקוחה בלי תור עתידי (`+972 58-555-0115`, פורמט בינלאומי) | `has_appointment:false` ✓ |
| טלפון שלא קיים | `customer_found:false` ✓ |
| טלפון לא תקין | `invalid_input` ✓ |
| קריאה ללקוחה קיימת | נוצרה קריאה 1011, `customer_created:false` ✓ |
| קריאה ממספר חדש | נוצרה קריאה 1012 ולקוחה חדשה ✓ |
| קריאה בלי תיאור | `invalid_input`, לא נשמר ✓ |
