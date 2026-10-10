# פונקציות ומשתנים · סוכן השירות של קליניקת אורה

"ה-AI מפעיל, ה-flow מבצע." הסוכן מנהל את השיחה, וכל פעולה אמיתית נעשית בפונקציה. לכל פונקציה שלושה חלקים: Prompt (מתי), Parameters (מה אוספים), Workflow (מה מבוצע).

## משתנים (User Fields)

נשמרים לכל לקוחה, כי הם יוצאים למערכת חיצונית (ה-CRM) או משמשים לבקרה.

| שדה | סוג | מה נשמר | נכתב על ידי |
|---|---|---|---|
| `ora_name` | Text | שם מלא כפי שנמסר | פרמטר בפונקציות (Save value to) |
| `ora_phone` | Text | טלפון כפי שנמסר | פרמטר בפונקציות |
| `ora_request` | Text | תיאור הפנייה | `open_service_ticket` |
| `ora_request_type` | Text | סוג הפנייה (תיאום תור / שאלה / בעיה אחרי טיפול / תלונה / אחר) | `open_service_ticket` |
| `ora_intent` | Text | הכוונה האחרונה שזוהתה: `open_ticket` / `human_request` / `next_appointment` | ה-Workflow של כל פונקציה |
| `ora_crm_result` | Text | תשובת ה-CRM המלאה (JSON, כולל מספר הפנייה), לבקרה | Workflow |

## פונקציה 1: `open_service_ticket`

**Function Prompt (מתי):**
Use this function when the customer needs follow-up from the clinic staff: a problem or question after a treatment, a request to book, move or cancel an appointment, a complaint, or any question the knowledge base cannot answer and the customer wants an answer to. Collect full name, phone and a description first, one question per message, and confirm them in one line before calling. Do not use it for general questions you can answer from the knowledge base.

| Name | Required | Description | List of values | Save value to |
|---|---|---|---|---|
| `customer_name` | ✓ | Customer's full name as they wrote it | | `ora_name` |
| `customer_phone` | ✓ | Customer's phone number, Israeli format, e.g. 054-1234567 | | `ora_phone` |
| `request_description` | ✓ | The customer's actual problem or request from this conversation, in their own words, one or two sentences. Never a generic or invented text | | `ora_request` |
| `request_type` | | Type of request | תיאום תור, שאלה, בעיה אחרי טיפול, תלונה, אחר | `ora_request_type` |

**Workflow (`Roey_ora_open_ticket`, לפי הסדר ב-CloudChat):**
1. (שאלה 5) External Request ← POST ל-n8n. התשובה כולה (`ok`, `ticket_number`, `message`) נשמרת ב-`ora_crm_result`.
2. AI Function Result = `{{ora_crm_result}}`. הסוכן מאשר פנייה רק כשחזרו `ok: true` ומספר (סעיף 6 בפרומפט). אין שדה נפרד למספר הפנייה.
3. Set Custom Field: `ora_intent` = `open_ticket`.

## פונקציה 2: `request_human`

**Function Prompt (מתי):**
Use this function when the customer asks to talk to a human, is angry or frustrated, or the topic is sensitive or outside your scope, after at most one soft attempt to help. Collect full name and phone first, one question per message. Pass a one-sentence summary of what the customer needs.

| Name | Required | Description | Save value to |
|---|---|---|---|
| `customer_name` | ✓ | Customer's full name | `ora_name` |
| `customer_phone` | ✓ | Customer's phone number | `ora_phone` |
| `summary` | ✓ | One or two sentences in Hebrew for the staff: what the customer needs from a human and why (e.g. 'כועסת שחיכתה שעה ולא חזרו אליה'). Gender-neutral or feminine, never with slashes like 'ביקש/ה'. | `ora_request` |

**Workflow:**
1. (שאלה 5) אותה קריאה ל-n8n כמו פתיחת פנייה, עם תיאור "בקשה לשיחה עם נציגה: {סיכום}" ו-`request_type: "בקשת נציגה"`. לפי הסוג, ה-CRM פותח את הקריאה בעדיפות **דחופה**, והיא מופיעה בבאנר "ביקשו נציגה" במסך הראשי. n8n גם פותח את השיחה ב"איזור הצ'אטים" של CloudChat, מוסיף לה תגית ומשייך אותה לנציגה התורנית, כך שהיא מופיעה אצלה ברשימת "שלי".
2. AI Function Result = `{{ora_crm_result}}`.
3. Set Custom Field: `ora_intent` = `human_request`.

## פונקציה 3: `get_next_appointment` (שאלה 5)

**Function Prompt (מתי):**
Use this function when the customer asks about their next or upcoming appointment ("מתי התור הבא שלי?"). Use only a phone number the customer typed in this conversation (in web chat anyone can type any number); ask for it once if missing. Answer only with what the function returns. Never guess an appointment.

| Name | Required | Description | Save value to |
|---|---|---|---|
| `customer_phone` | ✓ | The customer's phone number | `ora_phone` |

**Workflow:**
1. External Request ← POST ל-n8n, התשובה ל-`ora_crm_result`.
2. AI Function Result: `customer_found`, `has_appointment`, `weekday`, `date`, `time`, `treatment`, `message`.
3. Set Custom Field: `ora_intent` = `next_appointment`.

## בשלב שאלה 4 בלבד (לפני החיבור ל-CRM)

הפונקציות שומרות את הפרטים בשדות הסוכן (Save value to), ו-AI Function Result מחזיר `{"ok": true, "saved": true}`, כך שהפנייה נשמרת בשדות של הלקוחה ב-CloudChat. בשאלה 5 נוספת הקריאה ל-n8n בין שמירת השדות לבין ההחזרה לסוכן.

## Memory בפרמטרים (שלב 29)

| פונקציה | פרמטר | Memory | למה |
|---|---|---|---|
| `open_service_ticket` | `customer_name`, `customer_phone` | כן | לא שואלים שוב באותה שיחה |
| `open_service_ticket` | `request_description`, `request_type` | לא | פנייה שנייה היא נושא אחר |
| `request_human` | `customer_name`, `customer_phone` | כן | כמו למעלה |
| `request_human` | `summary` | לא | סיכום חדש לכל בקשה |
| `get_next_appointment` | `customer_phone` | לא | כלל הפרטיות: רק מספר שהוקלד עכשיו |
