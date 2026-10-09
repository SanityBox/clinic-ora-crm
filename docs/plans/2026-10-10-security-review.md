# תוכנית · סקירת אבטחה (שאלות 3 ו-5)

**היקף:** הרשאות ב-server actions, פערי RLS ו-IDOR, סודות, אימות ה-webhook, ולידציה, הפניות פתוחות (open redirect), XSS וכותרות אבטחה. נעזרתי בצ'קליסט של הסקיל `vibesec` וב-advisors של Supabase.

**ממצאים ותיקונים:**

| # | ממצא | חומרה | תיקון |
|---|---|---|---|
| 1 | `login/actions.ts`: בדיקת `next` חסמה רק `//`. הכתובת `/\evil.com` עברה, ודפדפנים מפרשים אותה כ-`//evil.com`, כלומר הפניה לאתר חיצוני אחרי התחברות. | בינונית | regex `SAFE_PATH`: מתחיל ב-`/` אחד, אחריו לא `/` ולא `\`, ובלי backslash או רווחים. 10 מקרי בדיקה עברו. |
| 2 | אין כותרות אבטחה. אפשר להטמיע את האתר ב-iframe (clickjacking). | בינונית | `next.config.ts`: `X-Frame-Options: DENY`, CSP עם `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy` ו-`Permissions-Policy`. נבדק ב-`/login`. |
| 3 | advisor: הגנה מסיסמאות שדלפו (HaveIBeenPwned) כבויה. | נמוכה | הגדרה של Supabase Auth שזמינה רק בתוכנית בתשלום. מתועד כ"ידוע" ב-QA. |

**נבדק ותקין:**
- כל server action קורא ל-`requireStaff`, `requireWriter` או `requireAdmin` לפני כתיבה, וה-RLS אוכף את אותו הדבר שוב בבסיס הנתונים.
- `team/actions.ts`: התפקיד נבדק מול רשימה סגורה, ויש גם טריגר `staff_guard`.
- אין `dangerouslySetInnerHTML`.
- אין service role בקוד.
- המזהים הם UUID. מספר הקריאה רציף, אבל הגישה נקבעת ב-RLS ולא לפי המספר.
- ה-webhook ב-n8n דורש header key, והפונקציות בבסיס הנתונים בודקות hash של מפתח נפרד. בלי מפתח מתקבל 403.

**בדיקה:** `tsc` ו-`lint` נקיים. ב-`/login` חוזרות 5 הכותרות. מקרי ה-regex עוברים.
