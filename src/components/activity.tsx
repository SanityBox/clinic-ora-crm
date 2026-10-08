import { History } from "lucide-react";
import { displayValue, fieldLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { Ltr } from "@/components/ui";

export type ActivityRow = {
  id: number;
  entity_type: "customer" | "appointment" | "ticket";
  action: "created" | "updated";
  changes: Record<string, { from: string | null; to: string | null }>;
  actor_label: string;
  created_at: string;
};

const entityName = { customer: "כרטיס הלקוחה", appointment: "תור", ticket: "קריאה" } as const;

/** ★2 activity log: who did what and when, with old → new values (PRD 1.5, 5.4). */
export function ActivityList({ rows }: { rows: ActivityRow[] }) {
  if (!rows.length) {
    return <p className="py-4 text-sm text-ink-soft">אין עדיין פעילות.</p>;
  }
  return (
    <ol className="flex flex-col">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-3 border-b border-line py-2.5 last:border-0">
          <History size={16} className="mt-1 shrink-0 text-ink-soft" aria-hidden />
          <div className="min-w-0 text-sm">
            <div>
              <span className="font-medium">{r.actor_label}</span>{" "}
              {r.action === "created" ? "יצרה" : "עדכנה"} {entityName[r.entity_type]}
              <span className="text-ink-soft">
                {" · "}
                <Ltr>{formatDateTime(r.created_at)}</Ltr>
              </span>
            </div>
            {r.action === "updated" && (
              <ul className="mt-0.5 text-ink-soft">
                {Object.entries(r.changes).map(([field, change]) => (
                  <li key={field}>
                    {fieldLabel[field] ?? field}: {displayValue(field, change.from)} ← {displayValue(field, change.to)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
