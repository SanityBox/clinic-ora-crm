// Maps database errors to the Hebrew messages defined in PRD 11.2. Never shows a technical message to the user.
export type Overlap = { id: string; kind: "staff" | "customer"; when: string; customer: string; treatment: string; staff: string };

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  existingCustomer?: { id: string; name: string };
  overlaps?: Overlap[];
} | null;

type PgError = { code?: string; message?: string; details?: string | null } | null;

export function dbErrorMessage(error: PgError): ActionState {
  const code = error?.code;
  const msg = error?.message ?? "";
  if (code === "22023" || msg.includes("invalid_phone")) {
    return { fieldErrors: { phone: "מספר הטלפון לא תקין. דוגמה: 054-7821390" } };
  }
  if (code === "42501" || msg.includes("row-level security")) {
    if (msg.includes("last_admin")) return { error: "חייבת להישאר לפחות מנהלת פעילה אחת" };
    if (msg.includes("cannot_demote_self")) return { error: "אי אפשר להוריד את עצמך מתפקיד מנהלת או להשבית את עצמך" };
    return { error: "אין הרשאה לפעולה הזו" };
  }
  if (msg.includes("appointments_cancel_reason_matches")) {
    return { fieldErrors: { cancel_reason: "יש לבחור סיבת ביטול" } };
  }
  if (msg.includes("tickets_in_progress_has_assignee")) {
    return { fieldErrors: { assignee_id: "קריאה בטיפול חייבת אחראית" } };
  }
  if (code === "23514") return { error: "אחד השדות לא תקין. כדאי לבדוק ולנסות שוב." };
  return { error: "משהו השתבש והשינוי לא נשמר. אפשר לנסות שוב." };
}

export function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function optional(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}
