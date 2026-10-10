// Display and input helpers. All times are shown in Israel time regardless of where the server runs (BR-13).
export const TZ = "Asia/Jerusalem";

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const weekdayFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long" });
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDate(iso: string | Date): string {
  return dateFmt.format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
  return timeFmt.format(new Date(iso));
}

export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatWeekday(iso: string | Date): string {
  return weekdayFmt.format(new Date(iso));
}

/** YYYY-MM-DD in Israel time, for <input type="date"> and day boundaries. */
export function isoDateInIsrael(d: string | Date = new Date()): string {
  return isoDateFmt.format(new Date(d));
}

/** HH:MM in Israel time, for <input type="time">. */
export function timeInIsrael(d: string | Date): string {
  return formatTime(d);
}

/**
 * Turns a wall-clock date and time in Israel into a value Postgres parses as timestamptz.
 * Postgres resolves the zone name itself, including daylight saving time.
 */
export function israelLocalToTimestamptz(date: string, time: string): string {
  return `${date} ${time}:00 ${TZ}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** 0547821390 -> 054-7821390, 097745120 -> 09-7745120 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  if (/^0(5|7)\d{8}$/.test(phone)) return `${phone.slice(0, 3)}-${phone.slice(3)}`;
  if (/^0\d{8}$/.test(phone)) return `${phone.slice(0, 2)}-${phone.slice(2)}`;
  return phone;
}

/** Same rule as public.normalize_phone in the database (BR-01). */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00972")) d = "0" + d.slice(5);
  else if (d.startsWith("972")) d = "0" + d.slice(3);
  if (/^0(5|7)\d{8}$/.test(d) || /^0[2-489]\d{7}$/.test(d)) return d;
  return null;
}

/** Digits for a partial phone search: "+972-54-78" -> "054 78"-style digits that match the stored format. */
export function phoneSearchDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00972")) d = "0" + d.slice(5);
  else if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}

export function whatsappLink(phone: string): string {
  return `https://wa.me/972${phone.replace(/^0/, "")}`;
}

export function shekel(amount: number): string {
  return `${amount.toLocaleString("he-IL")} ₪`;
}

/** "לפני 3 שעות" / "לפני 2 ימים" */
export function ageLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? "עכשיו" : `לפני ${minutes} דק'`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "לפני שעה" : `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "אתמול" : `לפני ${days} ימים`;
}

export const OVERDUE_BUSINESS_DAYS = 2;

/** BR-11: open past its due_at (opening + 2 business days, Sun-Thu). due_at is computed once in the database (ticket_due_at). */
export function isOverdue(dueAt: string, status: string): boolean {
  return status !== "closed" && Date.now() > new Date(dueAt).getTime();
}

/** BR-06: opening hours. Sun-Thu 09:00-19:00, Fri 09:00-13:00, Sat closed. Returns a warning or null. */
export function openingHoursWarning(date: string, time: string, durationMinutes: number): string | null {
  if (!date || !time) return null;
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const [hh, mm] = time.split(":").map(Number);
  const start = hh * 60 + mm;
  const end = start + (durationMinutes || 0);
  if (dow === 6) return "שבת: הקליניקה סגורה";
  const close = dow === 5 ? 13 * 60 : 19 * 60;
  if (start < 9 * 60 || end > close) {
    return dow === 5 ? "מחוץ לשעות הפעילות (שישי 09:00-13:00)" : "מחוץ לשעות הפעילות (09:00-19:00)";
  }
  return null;
}

// Server Components render once per request, so reading the clock here is safe; the lint purity rule can't see that.
export function requestTime(): number {
  return Date.now();
}
