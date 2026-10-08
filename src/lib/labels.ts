// Hebrew display labels for every closed list in the database (PRD 9.1) and the chip colour of each value (PRD 6.2).
// Table and field names stay English; everything the user reads is Hebrew.

export type Tone = "blue" | "amber" | "green" | "gray" | "red" | "brand";

export const appointmentStatus = {
  scheduled: { label: "עתידי", tone: "blue" },
  completed: { label: "בוצע", tone: "green" },
  cancelled: { label: "בוטל", tone: "gray" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export const cancelReason = {
  customer: "ביטול של הלקוחה",
  clinic: "ביטול של הקליניקה",
  no_show: "לא הגיעה",
} as const;

export const ticketStatus = {
  new: { label: "חדשה", tone: "blue" },
  in_progress: { label: "בטיפול", tone: "amber" },
  closed: { label: "נסגרה", tone: "green" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export const ticketPriority = {
  normal: "רגילה",
  urgent: "דחופה",
} as const;

export const ticketSource = {
  phone: "טלפון",
  whatsapp: "וואטסאפ",
  instagram: "אינסטגרם",
  facebook: "פייסבוק",
  website: "אתר",
  walk_in: "פרונטלי",
  ai_agent: "סוכן AI",
} as const;

export const customerSource = {
  instagram: "אינסטגרם",
  facebook: "פייסבוק",
  website: "אתר",
  referral: "פה לאוזן",
  whatsapp: "וואטסאפ",
  ai_agent: "סוכן AI",
  other: "אחר",
} as const;

export const roleLabel = {
  admin: "מנהלת",
  staff: "מטפלת",
  viewer: "צפייה בלבד",
} as const;

export const fieldLabel: Record<string, string> = {
  full_name: "שם",
  phone: "טלפון",
  email: "אימייל",
  source: "מקור",
  marketing_consent: "הסכמה לדיוור",
  notes: "הערות",
  treatment_id: "טיפול",
  staff_id: "מטפלת",
  starts_at: "מועד",
  duration_minutes: "משך",
  status: "סטטוס",
  cancel_reason: "סיבת ביטול",
  subject: "נושא",
  description: "תיאור",
  assignee_id: "אחראית",
  priority: "עדיפות",
};

// Translates raw enum values stored in the activity log into the Hebrew the user saw on screen.
const valueLabels: Record<string, Record<string, string>> = {
  status: {
    ...Object.fromEntries(Object.entries(appointmentStatus).map(([k, v]) => [k, v.label])),
    ...Object.fromEntries(Object.entries(ticketStatus).map(([k, v]) => [k, v.label])),
  },
  cancel_reason: cancelReason,
  priority: ticketPriority,
  marketing_consent: { true: "כן", false: "לא" },
};

export function displayValue(field: string, value: string | null): string {
  if (value === null || value === "") return "—";
  if (field === "source") {
    return (customerSource as Record<string, string>)[value] ?? (ticketSource as Record<string, string>)[value] ?? value;
  }
  return valueLabels[field]?.[value] ?? value;
}

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined): string {
  if (!key) return "—";
  return (map as Record<string, string>)[key] ?? key;
}
